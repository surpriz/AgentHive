import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { createDb, PGLITE_URL, type Db } from './db/client';
import { agents } from './db/schema';
import { user as userTable } from './db/auth-schema';
import { seedIfEmpty } from './db/seed';
import { createAuth, type Auth, type AuthEnv } from './auth';
import { parseManifest } from './manifest';
import { latestAudit, publishManifest, reauditAgent } from './publish';
import { defaultContext, illustrativeReport, type AuditContext } from './audit';
import { createSafeFetch } from './audit/net';
import { ensureSecret, ensureSystemUser, measuredMetrics, recentRuns, rotateSecret, runAgent, runnableReason, verifyRunSignature, RUN_LIMITS } from './gateway';
import { latestBenchmark, runBenchmark, type BenchmarkTrigger } from './benchmark';
import { rowToAgent } from './registry';
import { buildAgentCard, buildManifestYaml, buildRegistryIndex } from '../src/lib/manifest';
import { renderAgentHtml } from '../src/lib/seo';
import type { Agent } from '../src/types';

export interface AppOptions {
  databaseUrl: string;
  /** Public origin used in generated URLs, e.g. https://agenthive.sh */
  origin: string;
  auth: AuthEnv;
  /** Returns the SPA index.html; used to pre-render /agents/<name>. */
  template?: () => Promise<string>;
  /** Apply migrations on boot. Default: only for pglite. */
  migrate?: boolean;
  /** Audit engine context factory; tests inject fakes, production uses real fetch/dns with budgets. */
  auditContext?: () => AuditContext;
  /** Outbound fetch for the run gateway; tests inject a fake upstream. Defaults to the pinned safe fetch. */
  gatewayFetch?: typeof fetch;
  /** Runs work after the response is sent (Vercel waitUntil). Default: await inline. */
  background?: (p: Promise<unknown>) => void;
  /** Bearer token protecting /api/cron/*. Unset disables the cron routes. */
  cronSecret?: string;
}

export interface AppContext {
  app: Hono;
  db: Db;
  auth: Auth;
  /** Only in pglite mode: an API key for a test user, so e2e tests can publish. */
  testApiKey?: string;
}

interface Viewer {
  id: string;
  login: string;
  name: string;
  image: string | null;
  via: 'session' | 'api-key';
}

/** Local/e2e only. Exists solely when the database is in-memory. */
export const TEST_USER = { email: 'test@agenthive.local', password: 'test-password-123', login: 'testuser' } as const;

const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';
const PUBLISH_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };
const REAUDIT_WINDOW_MS = 60 * 60 * 1000;
export const GRADING_URL = 'https://github.com/surpriz/AgentHive/blob/main/docs/GRADING.md';

export async function createApp(opts: AppOptions): Promise<AppContext> {
  const isPglite = opts.databaseUrl.startsWith('pglite://');
  const { db, migrate } = await createDb(opts.databaseUrl);
  if (opts.migrate ?? isPglite) await migrate();
  await seedIfEmpty(db);
  await ensureSystemUser(db);

  const devLogin = isPglite && process.env.NODE_ENV !== 'production';
  const auth = createAuth(db, { ...opts.auth, passwordLogin: devLogin });
  const app = new Hono();
  const publishHits = new Map<string, number[]>();
  const reauditAt = new Map<string, number>();
  const auditCtx = opts.auditContext ?? (() => defaultContext());
  const gatewayFetch = opts.gatewayFetch ?? createSafeFetch({ timeoutMs: RUN_LIMITS.upstreamTimeoutMs });
  const background = opts.background ?? ((p) => p.catch((e) => console.error('background task failed', e)));
  const benchmarkAt = new Map<string, number>();
  const benchmarkAgent = async (agentId: string, trigger: BenchmarkTrigger) => {
    const row = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
    return row ? runBenchmark(db, { fetch: gatewayFetch }, row, trigger) : null;
  };

  /** Non-seed agents get numbers measured over the gateway; seeds keep their illustrative ones. */
  const withMeasured = async (rows: (typeof agents.$inferSelect)[]): Promise<Agent[]> => {
    const measured = rows.some((r) => !r.isSeed) ? await measuredMetrics(db) : new Map();
    return rows.map((r) => {
      const a = rowToAgent(r);
      if (r.isSeed) return a;
      const m = measured.get(r.id);
      return { ...a, runs30d: m?.runs30d ?? 0, successRate: m?.successRate ?? null, avgLatencyMs: m?.avgLatencyMs ?? null, costPerRun: null };
    });
  };
  const loadAgents = async (): Promise<Agent[]> => withMeasured(await db.select().from(agents).orderBy(asc(agents.isSeed), asc(agents.createdAt)));
  const loadAgent = async (name: string): Promise<Agent | null> => {
    const row = await db.query.agents.findFirst({ where: eq(agents.name, name) });
    return row ? (await withMeasured([row]))[0] : null;
  };

  const viewer = async (c: Context): Promise<Viewer | null> => {
    const authz = c.req.header('authorization');
    const bearer = authz?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? c.req.header('x-api-key');
    if (bearer) {
      const res = await auth.api.verifyApiKey({ body: { key: bearer } });
      if (!res.valid || !res.key) return null;
      const u = await db.query.user.findFirst({ where: eq(userTable.id, res.key.referenceId) });
      return u ? { id: u.id, login: u.login ?? u.name, name: u.name, image: u.image ?? null, via: 'api-key' } : null;
    }
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return null;
    const u = session.user as typeof session.user & { login?: string | null };
    return { id: u.id, login: u.login ?? u.name, name: u.name, image: u.image ?? null, via: 'session' };
  };

  const requireViewer = async (c: Context, next: Next) => {
    const v = await viewer(c);
    if (!v) return c.json({ error: 'unauthenticated', hint: 'sign in, or send Authorization: Bearer <api key>' }, 401);
    c.set('viewer', v);
    await next();
  };

  const publicJson = (c: Context, body: unknown, status: 200 | 404 = 200) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Cache-Control', status === 200 ? PUBLIC_CACHE : 'no-store');
    return c.json(body as Record<string, unknown>, status);
  };

  // ---- auth -------------------------------------------------------------
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  // ---- public registry ---------------------------------------------------
  app.get('/api/config', (c) => c.json({ github: Boolean(opts.auth.github), devLogin, devUser: devLogin ? TEST_USER : undefined }));

  app.get('/api/catalog.json', async (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Cache-Control', 'no-cache');
    return c.json({ apiVersion: 'agenthive.sh/v1', agents: await loadAgents() });
  });

  app.get('/api/agents.json', async (c) => publicJson(c, buildRegistryIndex(await loadAgents(), opts.origin)));

  app.get('/agents/:name/agent.json', async (c) => {
    const a = await loadAgent(c.req.param('name'));
    return a ? publicJson(c, buildAgentCard(a, opts.origin)) : publicJson(c, { error: 'not found' }, 404);
  });

  app.get('/agents/:name/agent.yaml', async (c) => {
    const a = await loadAgent(c.req.param('name'));
    c.header('Access-Control-Allow-Origin', '*');
    if (!a) return c.text('not found', 404);
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.text(buildManifestYaml(a, opts.origin), 200, { 'Content-Type': 'application/yaml; charset=utf-8' });
  });

  app.get('/agents/:name/audit.json', async (c) => {
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    if (!row) return publicJson(c, { error: 'not found' }, 404);
    const a = rowToAgent(row);
    const report = row.isSeed ? illustrativeReport(a.grade === 'pending' ? 'B' : a.grade, a.publishedAt) : await latestAudit(db, row.id);
    return publicJson(c, { agent: a.name, version: a.version, grade: a.grade, score: a.score, criteria: `${opts.origin}/docs/grading`, report: report ?? null });
  });

  app.get('/agents/:name/benchmark.json', async (c) => {
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    if (!row) return publicJson(c, { error: 'not found' }, 404);
    const a = rowToAgent(row);
    return publicJson(c, { agent: a.name, version: a.version, illustrative: row.isSeed, benchmark: row.isSeed ? a.benchmark : await latestBenchmark(db, row.id), runnable: runnableReason(row) === null, reason: runnableReason(row) });
  });

  // Daily continuous benchmark, protected by CRON_SECRET (Vercel cron sends it as a bearer token).
  app.get('/api/cron/benchmark', async (c) => {
    if (!opts.cronSecret || c.req.header('authorization') !== `Bearer ${opts.cronSecret}`) return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(agents).where(eq(agents.isSeed, false));
    const runnable = rows.filter((r) => runnableReason(r) === null);
    background(
      (async () => {
        for (const r of runnable) await runBenchmark(db, { fetch: gatewayFetch }, r, 'cron');
      })(),
    );
    return c.json({ scheduled: runnable.length });
  });

  app.get('/docs/grading', (c) => c.redirect(GRADING_URL, 302));

  // Public test upstream: point a manifest's endpoint here to try the gateway end to end.
  app.post('/api/v1/echo', async (c) => {
    const body = await c.req.text();
    if (Buffer.byteLength(body, 'utf8') > RUN_LIMITS.requestBytes) return c.json({ error: 'too large' }, 413);
    let input: unknown;
    try {
      input = JSON.parse(body || 'null');
    } catch {
      return c.json({ error: 'echo expects JSON' }, 400);
    }
    const h = (k: string) => c.req.header(k) ?? null;
    const ts = h('x-agenthive-timestamp');
    const sig = h('x-agenthive-signature');
    const agentRef = h('x-agenthive-agent');
    let signatureValid: boolean | null = null;
    if (ts && sig && agentRef) {
      const row = await db.query.agents.findFirst({ where: eq(agents.name, agentRef.split('@')[0] ?? ''), columns: { gatewaySecret: true } });
      signatureValid = row?.gatewaySecret ? verifyRunSignature(row.gatewaySecret, ts, body, sig) : null;
    }
    return c.json({ echo: input, received: { runId: h('x-agenthive-run-id'), caller: h('x-agenthive-caller'), agent: agentRef, timestamp: ts, signatureValid }, from: 'agenthive.sh/api/v1/echo' });
  });

  app.get('/sitemap.xml', async (c) => {
    const urls = ['/', ...(await loadAgents()).map((a) => `/agents/${a.name}`)]
      .map((p) => `  <url><loc>${opts.origin}${p}</loc><changefreq>daily</changefreq></url>`)
      .join('\n');
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 200, {
      'Content-Type': 'application/xml; charset=utf-8',
    });
  });

  app.get('/agents/:name', async (c) => {
    if (!opts.template) return c.notFound();
    const template = await opts.template();
    const a = await loadAgent(c.req.param('name'));
    c.header('Cache-Control', a ? PUBLIC_CACHE : 'no-store');
    return c.html(a ? renderAgentHtml(template, a, opts.origin) : template, a ? 200 : 404);
  });

  // ---- authenticated -----------------------------------------------------
  const v1 = new Hono<{ Variables: { viewer: Viewer } }>();
  v1.use('*', requireViewer);

  v1.get('/me', async (c) => {
    const me = c.get('viewer');
    const mine = (await db.select().from(agents).where(eq(agents.ownerId, me.id)).orderBy(asc(agents.name))).map(rowToAgent);
    return c.json({ user: { id: me.id, login: me.login, name: me.name, image: me.image }, via: me.via, agents: mine });
  });

  v1.post('/agents', async (c) => {
    const me = c.get('viewer');
    const now = Date.now();
    const hits = (publishHits.get(me.id) ?? []).filter((t) => now - t < PUBLISH_LIMIT.windowMs);
    if (hits.length >= PUBLISH_LIMIT.max) return c.json({ error: 'rate limited', retryAfterMs: PUBLISH_LIMIT.windowMs - (now - hits[0]) }, 429);
    hits.push(now);
    publishHits.set(me.id, hits);

    // Always the raw text: parseManifest enforces the byte cap before parsing JSON or YAML.
    const parsed = parseManifest(await c.req.text());
    if (!parsed.ok) return c.json({ error: 'invalid manifest', issues: parsed.issues }, 422);

    const res = await publishManifest(db, { userId: me.id, login: me.login }, parsed.manifest, auditCtx());
    if (!res.ok) return c.json(res.code === 'AUDIT_BLOCKED' ? { error: res.message, code: res.code, audit: res.audit } : { error: res.message, code: res.code }, res.status);
    const entry = buildRegistryIndex([res.agent], opts.origin).agents[0];
    const benchmarkQueued = runnableReason({ isSeed: false, transport: res.agent.transport, endpoint: res.agent.endpoint } as Parameters<typeof runnableReason>[0]) === null;
    if (benchmarkQueued) background(benchmarkAgent(res.agent.id, 'publish'));
    return c.json({ agent: res.agent, entry, audit: res.audit, benchmarkQueued, url: `${opts.origin}/agents/${res.agent.name}` }, res.created ? 201 : 200);
  });

  v1.post('/agents/:name/audit', async (c) => {
    const me = c.get('viewer');
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.ownerId !== me.id) return c.json({ error: 'only the owner can re-run the audit' }, 403);
    if (row.isSeed) return c.json({ error: 'seed agents are illustrative and not audited' }, 409);
    const last = reauditAt.get(row.id) ?? 0;
    if (Date.now() - last < REAUDIT_WINDOW_MS) return c.json({ error: 'audit already ran recently', retryAfterMs: REAUDIT_WINDOW_MS - (Date.now() - last) }, 429);
    reauditAt.set(row.id, Date.now());
    const report = await reauditAgent(db, row.id, auditCtx());
    if (!report) return c.json({ error: 'no manifest stored for this agent' }, 500);
    const fresh = await db.query.agents.findFirst({ where: eq(agents.id, row.id) });
    return c.json({ agent: fresh ? rowToAgent(fresh) : null, audit: report });
  });

  v1.post('/run/:name', async (c) => {
    const me = c.get('viewer');
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    if (!row) return c.json({ error: 'not found' }, 404);
    const body = await c.req.text();
    const out = await runAgent(db, { fetch: gatewayFetch }, row, { id: me.id, login: me.login, via: me.via }, body);
    if (out.kind === 'rejected') return c.json({ error: out.error, ...(out.retryAfterMs ? { retryAfterMs: out.retryAfterMs } : {}) }, out.status);
    c.header('x-agenthive-run-id', out.runId);
    c.header('x-agenthive-latency-ms', String(Math.round(out.latencyMs)));
    if (out.kind === 'failed') return c.json({ error: out.error, runId: out.runId }, out.status);
    return c.body(out.body, out.status as 200, { 'content-type': 'application/json; charset=utf-8' });
  });

  v1.get('/runs', async (c) => c.json({ runs: await recentRuns(db, { callerId: c.get('viewer').id }) }));

  const ownedAgent = async (c: Context<{ Variables: { viewer: Viewer } }>) => {
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name') ?? '') });
    if (!row) return { error: c.json({ error: 'not found' }, 404) };
    if (row.ownerId !== c.get('viewer').id) return { error: c.json({ error: 'only the owner can do this' }, 403) };
    return { row };
  };

  v1.get('/agents/:name/runs', async (c) => {
    const r = await ownedAgent(c);
    if ('error' in r) return r.error;
    return c.json({ runnable: runnableReason(r.row) === null, reason: runnableReason(r.row), runs: await recentRuns(db, { agentId: r.row.id }) });
  });

  v1.post('/agents/:name/benchmark', async (c) => {
    const r = await ownedAgent(c);
    if ('error' in r) return r.error;
    const reason = runnableReason(r.row);
    if (reason) return c.json({ error: reason }, 409);
    const last = benchmarkAt.get(r.row.id) ?? 0;
    if (Date.now() - last < REAUDIT_WINDOW_MS) return c.json({ error: 'benchmark already ran recently', retryAfterMs: REAUDIT_WINDOW_MS - (Date.now() - last) }, 429);
    benchmarkAt.set(r.row.id, Date.now());
    const report = await runBenchmark(db, { fetch: gatewayFetch }, r.row, 'owner');
    return c.json({ benchmark: report });
  });

  v1.get('/agents/:name/secret', async (c) => {
    const r = await ownedAgent(c);
    if ('error' in r) return r.error;
    if (c.get('viewer').via !== 'session') return c.json({ error: 'the gateway secret is only shown from the dashboard' }, 403);
    return c.json({ secret: await ensureSecret(db, r.row.id), recipe: 'hex(hmac_sha256(secret, `${x-agenthive-timestamp}.${raw body}`)) == x-agenthive-signature' });
  });

  v1.post('/agents/:name/secret/rotate', async (c) => {
    const r = await ownedAgent(c);
    if ('error' in r) return r.error;
    if (c.get('viewer').via !== 'session') return c.json({ error: 'the gateway secret is only managed from the dashboard' }, 403);
    return c.json({ secret: await rotateSecret(db, r.row.id) });
  });

  v1.get('/keys', async (c) => {
    if (c.get('viewer').via !== 'session') return c.json({ error: 'keys are managed from the dashboard' }, 403);
    const { apiKeys } = await auth.api.listApiKeys({ headers: c.req.raw.headers });
    return c.json({ keys: apiKeys.map((k) => ({ id: k.id, name: k.name, start: k.start, prefix: k.prefix, createdAt: k.createdAt, lastRequest: k.lastRequest, enabled: k.enabled })) });
  });

  v1.post('/keys', async (c) => {
    if (c.get('viewer').via !== 'session') return c.json({ error: 'keys are managed from the dashboard' }, 403);
    const { name } = (await c.req.json().catch(() => ({}))) as { name?: unknown };
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 64) return c.json({ error: 'name required (1–64 chars)' }, 400);
    const created = await auth.api.createApiKey({ body: { name: name.trim() }, headers: c.req.raw.headers });
    return c.json({ key: created.key, id: created.id, name: created.name, start: created.start }, 201);
  });

  v1.delete('/keys/:id', async (c) => {
    if (c.get('viewer').via !== 'session') return c.json({ error: 'keys are managed from the dashboard' }, 403);
    await auth.api.deleteApiKey({ body: { keyId: c.req.param('id') }, headers: c.req.raw.headers });
    return c.body(null, 204);
  });

  app.route('/api/v1', v1);

  app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'not found' }, 404) : c.text('not found', 404)));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal error' }, 500);
  });

  // ---- test fixtures (in-memory database only) -----------------------------
  let testApiKey: string | undefined;
  if (devLogin) {
    const signedUp = await auth.api.signUpEmail({ body: { email: TEST_USER.email, password: TEST_USER.password, name: 'Test User' } });
    await db.update(userTable).set({ login: TEST_USER.login, emailVerified: true }).where(eq(userTable.id, signedUp.user.id));
    const created = await auth.api.createApiKey({ body: { name: 'e2e', userId: signedUp.user.id } });
    testApiKey = created.key;
  }

  return { app, db, auth, testApiKey };
}

export { PGLITE_URL };
