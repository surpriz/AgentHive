import { Hono } from 'hono';
import { stringify as stringifyYaml } from 'yaml';
import type { Context, Next } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { createDb, PGLITE_URL, type Db } from './db/client';
import { agents, runs } from './db/schema';
import { user as userTable } from './db/auth-schema';
import { publishLocalAgents } from './dev/localAgents';
import { withSnapshot } from './ssr';
import { agentSnapshot, homeSnapshot, leaderboardSnapshot, trialSnapshot } from '../src/ssr/snapshot';
import { createAuth, type Auth, type AuthEnv, purgeUnverifiedUsers, signupCookie } from './auth';
import { parseManifest, isV2, validatePackageFiles, MAX_PACKAGE_BYTES } from './manifest';
import { latestAudit, publishManifest, reauditAgent, latestVersion } from './publish';
import { defaultContext, offlineContext, type AuditContext } from './audit';
import { createSafeFetch } from './audit/net';
import { deliverWebhook, ensureSecret, ensureSystemUser, ensureWebhookSecret, getRun, measuredMetrics, precheckRun, recentRuns, rotateSecret, rotateWebhookSecret, runAgent, runnableReason, sweepRuns, verifyRunSignature, RUN_LIMITS } from './gateway';
import { randomUUID } from 'node:crypto';
import { latestBenchmark, runBenchmark, type BenchmarkTrigger } from './benchmark';
import { computeLeaderboard, rankHistory, snapshotLeaderboard } from './leaderboard';
import { RESULT_LIMITS, recordTrialResult, resultPostSchema, trialRanking, trialRun, trialRuns } from './trials';
import { rowToAgent } from './registry';
import { buildAgentCard, buildManifestYaml, buildRegistryIndex } from '../src/lib/manifest';
import { buildLayout, type PackageDoc } from '../src/lib/retrieval';
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
  /** Shared secret the batch runner signs trial results with; results are refused without it. */
  trialSecret?: string;
  /** In-memory database only: a folder of package directories published under the test user at boot, with offline checks. */
  localAgentsDir?: string;
  /** Password login without verification plus a test user and key. Default: in-memory database outside production. */
  devLogin?: boolean;
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
/** A password sign-up that never verifies its email is deleted after this, freeing the address. */
const UNVERIFIED_TTL_MS = 24 * 60 * 60 * 1000;
export const GRADING_URL = 'https://github.com/surpriz/AgentHive/blob/main/docs/GRADING.md';

export async function createApp(opts: AppOptions): Promise<AppContext> {
  const isPglite = opts.databaseUrl.startsWith('pglite://');
  const { db, migrate } = await createDb(opts.databaseUrl);
  if (opts.migrate ?? isPglite) await migrate();
  await ensureSystemUser(db);

  const devLogin = opts.devLogin ?? (isPglite && process.env.NODE_ENV !== 'production');
  const auth = createAuth(db, { ...opts.auth, passwordLogin: devLogin });
  const app = new Hono();
  const publishHits = new Map<string, number[]>();
  const reauditAt = new Map<string, number>();
  const auditCtx = opts.auditContext ?? (() => defaultContext());
  const gatewayFetch = opts.gatewayFetch ?? createSafeFetch({ timeoutMs: RUN_LIMITS.upstreamTimeoutMs });
  const background = opts.background ?? ((p) => p.catch((e) => console.error('background task failed', e)));
  const benchmarkAgent = async (agentId: string, trigger: BenchmarkTrigger) => {
    const row = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
    return row ? runBenchmark(db, { fetch: gatewayFetch }, row, trigger) : null;
  };

  /** Numbers on a card are measured over the gateway, never declared. */
  const withMeasured = async (rows: (typeof agents.$inferSelect)[]): Promise<Agent[]> => {
    const measured = rows.length > 0 ? await measuredMetrics(db) : new Map();
    return rows.map((r) => {
      const a = rowToAgent(r);
      const m = measured.get(r.id);
      return { ...a, runs30d: m?.runs30d ?? 0, successRate: m?.successRate ?? null, avgLatencyMs: m?.avgLatencyMs ?? null, costPerRun: null };
    });
  };
  const loadAgents = async (): Promise<Agent[]> => withMeasured(await db.select().from(agents).orderBy(asc(agents.createdAt)));
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
  // A successful password sign-up marks this browser, so its own verification click keeps the chosen password (see createAuth).
  app.post('/api/auth/sign-up/email', async (c) => {
    const res = await auth.handler(c.req.raw);
    if (res.status !== 200) return res;
    const body = (await res.clone().json().catch(() => null)) as { user?: { id?: string } } | null;
    if (!body?.user?.id) return res;
    const headers = new Headers(res.headers);
    headers.append('set-cookie', signupCookie(body.user.id, opts.auth.secret, opts.auth.baseURL.startsWith('https://')));
    return new Response(res.body, { status: res.status, headers });
  });
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  // ---- public registry ---------------------------------------------------
  app.get('/api/config', (c) => c.json({ github: Boolean(opts.auth.github), google: Boolean(opts.auth.google), email: Boolean(opts.auth.email), devLogin, devUser: devLogin ? TEST_USER : undefined }));

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
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    c.header('Access-Control-Allow-Origin', '*');
    if (!row) return c.text('not found', 404);
    c.header('Cache-Control', PUBLIC_CACHE);
    // A package is served as the author published it; a hosted agent gets the registry's enriched rendering.
    const body = row.apiVersion === 'v2' ? stringifyYaml((await latestVersion(db, row.id))?.manifest ?? {}) : buildManifestYaml((await withMeasured([row]))[0], opts.origin);
    return c.text(body, 200, { 'Content-Type': 'application/yaml; charset=utf-8' });
  });

  app.get('/agents/:name/package.json', async (c) => {
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    if (!row) return publicJson(c, { error: 'not found' }, 404);
    if (row.apiVersion !== 'v2') return publicJson(c, { error: 'not a package: this agent is hosted by its author', url: `${opts.origin}/agents/${row.name}` }, 404);
    const v = await latestVersion(db, row.id);
    if (!v) return publicJson(c, { error: 'no version stored' }, 404);
    const a = rowToAgent(row);
    const base = { name: a.name, version: a.version, author: a.author, apiVersion: 'v2' as const, goal: a.goal ?? null, license: a.license, value: a.value, tagline: a.tagline, settings: a.settings ?? [], bricks: a.bricks ?? { skills: [], mcp: [] }, files: v.files ?? {}, sha256: v.sha256 ?? null, publishedAt: a.publishedAt, url: `${opts.origin}/agents/${a.name}` };
    const doc: PackageDoc = { ...base, layouts: { claude: buildLayout(base, 'claude'), cursor: buildLayout(base, 'cursor') } };
    return publicJson(c, doc);
  });

  app.get('/agents/:name/audit.json', async (c) => {
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    if (!row) return publicJson(c, { error: 'not found' }, 404);
    const a = rowToAgent(row);
    const report = await latestAudit(db, row.id);
    return publicJson(c, { agent: a.name, version: a.version, grade: a.grade, score: a.score, criteria: `${opts.origin}/docs/grading`, report: report ?? null });
  });

  app.get('/agents/:name/benchmark.json', async (c) => {
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    if (!row) return publicJson(c, { error: 'not found' }, 404);
    const a = rowToAgent(row);
    return publicJson(c, { agent: a.name, version: a.version, benchmark: await latestBenchmark(db, row.id), runnable: runnableReason(row) === null, reason: runnableReason(row) });
  });

  // Daily continuous benchmark, protected by CRON_SECRET (Vercel cron sends it as a bearer token).
  app.get('/api/cron/benchmark', async (c) => {
    if (!opts.cronSecret || c.req.header('authorization') !== `Bearer ${opts.cronSecret}`) return c.json({ error: 'forbidden' }, 403);
    const rows = await db.select().from(agents);
    const runnable = rows.filter((r) => runnableReason(r) === null);
    background(
      (async () => {
        for (const r of runnable) {
          try {
            await runBenchmark(db, { fetch: gatewayFetch }, r, 'cron');
          } catch (e) {
            console.error(`cron benchmark failed for ${r.name}`, e);
          }
        }
        try {
          await snapshotLeaderboard(db);
        } catch (e) {
          console.error('leaderboard snapshot failed', e);
        }
        try {
          await sweepRuns(db);
        } catch (e) {
          console.error('run sweep failed', e);
        }
        try {
          await purgeUnverifiedUsers(db, UNVERIFIED_TTL_MS);
        } catch (e) {
          console.error('unverified purge failed', e);
        }
      })(),
    );
    return c.json({ scheduled: runnable.length });
  });

  app.get('/api/leaderboard.json', async (c) => {
    const board = await computeLeaderboard(db);
    const category = c.req.query('category');
    if (category) {
      if (!(category in board.categories)) return publicJson(c, { error: 'unknown category' }, 404);
      return publicJson(c, { ...board, categories: { [category]: board.categories[category] } });
    }
    return publicJson(c, board);
  });

  app.get('/api/leaderboard/history.json', async (c) => {
    const name = c.req.query('agent') ?? '';
    const row = await db.query.agents.findFirst({ where: eq(agents.name, name) });
    if (!row) return publicJson(c, { error: 'not found' }, 404);
    const days = Math.min(365, Math.max(1, Number(c.req.query('days') ?? 30) || 30));
    return publicJson(c, { agent: row.name, category: row.category, history: await rankHistory(db, row, days) });
  });

  // Trial results, posted by the batch runner with the gateway's HMAC scheme over a shared secret.
  app.post('/api/trials/:trial/results', async (c) => {
    if (!opts.trialSecret) return c.json({ error: 'trials are not accepting results' }, 503);
    const body = await c.req.text();
    if (body.length > RESULT_LIMITS.bodyBytes) return c.json({ error: 'too large' }, 413);
    const ts = c.req.header('x-agenthive-timestamp') ?? '';
    const sig = c.req.header('x-agenthive-signature') ?? '';
    if (!verifyRunSignature(opts.trialSecret, ts, body, sig)) return c.json({ error: 'bad signature' }, 401);
    let parsed: ReturnType<typeof resultPostSchema.safeParse>;
    try {
      parsed = resultPostSchema.safeParse(JSON.parse(body));
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    if (!parsed.success) return c.json({ error: 'invalid record', issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })) }, 422);
    const out = await recordTrialResult(db, c.req.param('trial'), parsed.data.batchId, parsed.data.record);
    if (!out.ok) return c.json({ error: out.message }, out.status);
    return c.json({ id: out.id, replaced: out.replaced }, out.replaced ? 200 : 201);
  });

  app.get('/api/trials/:file{[a-z0-9-]+\\.json}', async (c) => {
    const ranking = await trialRanking(db, c.req.param('file').replace(/\.json$/, ''));
    return ranking ? publicJson(c, ranking) : publicJson(c, { error: 'unknown trial' }, 404);
  });

  app.get('/api/trials/:trial/runs.json', async (c) => {
    const agent = c.req.query('agent') ?? '';
    if (!agent) return publicJson(c, { error: 'agent required' }, 404);
    return publicJson(c, { trial: c.req.param('trial'), agent, runs: await trialRuns(db, c.req.param('trial'), agent) });
  });

  app.get('/api/trials/runs/:file{[a-f0-9-]+\\.json}', async (c) => {
    const run = await trialRun(db, c.req.param('file').replace(/\.json$/, ''));
    return run ? publicJson(c, run) : publicJson(c, { error: 'not found' }, 404);
  });

  app.get('/docs/grading', (c) => c.redirect(GRADING_URL, 302));
  app.get('/docs/leaderboard', (c) => c.redirect('https://github.com/surpriz/AgentHive/blob/main/docs/LEADERBOARD.md', 302));

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
    return c.html(a ? withSnapshot(renderAgentHtml(template, a, opts.origin), agentSnapshot(a)) : template, a ? 200 : 404);
  });

  // The SPA shell with a static snapshot of the page, for readers without JavaScript.
  app.get('/', async (c) => {
    if (!opts.template) return c.notFound();
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.html(withSnapshot(await opts.template(), homeSnapshot(await loadAgents())));
  });
  app.get('/leaderboard', async (c) => {
    if (!opts.template) return c.notFound();
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.html(withSnapshot(await opts.template(), leaderboardSnapshot(await computeLeaderboard(db))));
  });
  app.get('/trials/:slug{[a-z0-9-]+}', async (c) => {
    if (!opts.template) return c.notFound();
    const ranking = await trialRanking(db, c.req.param('slug'));
    if (!ranking) return c.notFound();
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.html(withSnapshot(await opts.template(), trialSnapshot(ranking)));
  });
  app.get('/dashboard', async (c) => {
    if (!opts.template) return c.notFound();
    c.header('Cache-Control', 'no-store');
    return c.html(await opts.template());
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
    if (isV2(parsed.manifest)) return c.json({ error: 'packages are published with their files', issues: [{ path: 'apiVersion', message: 'apiVersion agenthive.sh/v2 goes through POST /api/v1/packages with { manifest, files }' }] }, 422);

    const res = await publishManifest(db, { userId: me.id, login: me.login }, parsed.manifest, auditCtx());
    if (!res.ok) return c.json(res.code === 'AUDIT_BLOCKED' ? { error: res.message, code: res.code, audit: res.audit } : { error: res.message, code: res.code }, res.status);
    const entry = buildRegistryIndex([res.agent], opts.origin).agents[0];
    const benchmarkQueued = runnableReason({ transport: res.agent.transport, endpoint: res.agent.endpoint } as Parameters<typeof runnableReason>[0]) === null;
    if (benchmarkQueued) background(benchmarkAgent(res.agent.id, 'publish'));
    return c.json({ agent: res.agent, entry, audit: res.audit, benchmarkQueued, url: `${opts.origin}/agents/${res.agent.name}` }, res.created ? 201 : 200);
  });

  /** Publishes a declarative package: `{ manifest: <yaml or json text>, files: { path: text } }`. */
  v1.post('/packages', async (c) => {
    const me = c.get('viewer');
    const now = Date.now();
    const hits = (publishHits.get(me.id) ?? []).filter((t) => now - t < PUBLISH_LIMIT.windowMs);
    if (hits.length >= PUBLISH_LIMIT.max) return c.json({ error: 'rate limited', retryAfterMs: PUBLISH_LIMIT.windowMs - (now - hits[0]) }, 429);
    hits.push(now);
    publishHits.set(me.id, hits);

    const raw = await c.req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_PACKAGE_BYTES + 512 * 1024) return c.json({ error: 'package too large' }, 413);
    let body: { manifest?: unknown; files?: unknown };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return c.json({ error: 'body must be JSON: { manifest, files }' }, 400);
    }
    if (typeof body.manifest !== 'string' && (typeof body.manifest !== 'object' || body.manifest === null)) return c.json({ error: 'manifest must be the agent.yaml text or object' }, 422);
    const parsed = parseManifest(body.manifest);
    if (!parsed.ok) return c.json({ error: 'invalid manifest', issues: parsed.issues }, 422);
    if (!isV2(parsed.manifest)) return c.json({ error: 'not a package manifest', issues: [{ path: 'apiVersion', message: 'packages use apiVersion agenthive.sh/v2; hosted agents go through POST /api/v1/agents' }] }, 422);
    const issues = validatePackageFiles(parsed.manifest, body.files ?? {});
    if (issues.length) return c.json({ error: 'invalid package', issues }, 422);

    const res = await publishManifest(db, { userId: me.id, login: me.login }, parsed.manifest, auditCtx(), body.files as Record<string, string>);
    if (!res.ok) return c.json(res.code === 'AUDIT_BLOCKED' ? { error: res.message, code: res.code, audit: res.audit } : { error: res.message, code: res.code }, res.status);
    const entry = buildRegistryIndex([res.agent], opts.origin).agents[0];
    return c.json({ agent: res.agent, entry, audit: res.audit, benchmarkQueued: false, url: `${opts.origin}/agents/${res.agent.name}`, packageUrl: `${opts.origin}/agents/${res.agent.name}/package.json` }, res.created ? 201 : 200);
  });

  v1.post('/agents/:name/audit', async (c) => {
    const me = c.get('viewer');
    const row = await db.query.agents.findFirst({ where: eq(agents.name, c.req.param('name')) });
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.ownerId !== me.id) return c.json({ error: 'only the owner can re-run the audit' }, 403);
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
    const caller = { id: me.id, login: me.login, via: me.via };
    const wantsAsync = /^(1|true|yes)$/i.test(c.req.header('x-agenthive-async') ?? '');
    const webhookUrl = c.req.header('x-agenthive-webhook') ?? null;
    if (webhookUrl && !wantsAsync) return c.json({ error: 'a webhook needs an async run (x-agenthive-async: 1)' }, 400);
    if (wantsAsync) {
      const rejected = await precheckRun(db, { fetch: gatewayFetch }, row, caller, body, webhookUrl);
      if (rejected) return c.json({ error: rejected.error, ...(rejected.retryAfterMs ? { retryAfterMs: rejected.retryAfterMs } : {}) }, rejected.status);
      const runId = randomUUID();
      await db.insert(runs).values({ id: runId, agentId: row.id, agentVersion: row.latestVersion, callerId: me.id, callerLogin: me.login, via: me.via, status: 'queued', latencyMs: 0, requestBytes: Buffer.byteLength(body, 'utf8'), mode: 'async', webhookUrl });
      background(
        (async () => {
          await runAgent(db, { fetch: gatewayFetch }, row, caller, body, { mode: 'async', runId, webhookUrl });
          if (webhookUrl) await deliverWebhook(db, { fetch: gatewayFetch }, runId, me.id);
        })(),
      );
      c.header('x-agenthive-run-id', runId);
      return c.json({ runId, status: 'queued', statusUrl: `${opts.origin}/api/v1/runs/${runId}` }, 202);
    }
    const out = await runAgent(db, { fetch: gatewayFetch }, row, caller, body);
    if (out.kind === 'rejected') return c.json({ error: out.error, ...(out.retryAfterMs ? { retryAfterMs: out.retryAfterMs } : {}) }, out.status);
    c.header('x-agenthive-run-id', out.runId);
    c.header('x-agenthive-latency-ms', String(Math.round(out.latencyMs)));
    if (out.kind === 'failed') return c.json({ error: out.error, runId: out.runId }, out.status);
    return c.body(out.body, out.status as 200, { 'content-type': 'application/json; charset=utf-8' });
  });

  v1.get('/runs', async (c) => c.json({ runs: await recentRuns(db, { callerId: c.get('viewer').id }) }));

  v1.get('/runs/:id', async (c) => {
    const view = await getRun(db, c.req.param('id'), c.get('viewer').id);
    return view ? c.json(view) : c.json({ error: 'not found' }, 404);
  });

  v1.get('/webhooks/secret', async (c) => {
    if (c.get('viewer').via !== 'session') return c.json({ error: 'the webhook secret is only shown from the dashboard' }, 403);
    return c.json({ secret: await ensureWebhookSecret(db, c.get('viewer').id), recipe: 'hex(hmac_sha256(secret, `${x-agenthive-timestamp}.${raw body}`)) == x-agenthive-signature' });
  });

  v1.post('/webhooks/secret/rotate', async (c) => {
    if (c.get('viewer').via !== 'session') return c.json({ error: 'the webhook secret is only managed from the dashboard' }, 403);
    return c.json({ secret: await rotateWebhookSecret(db, c.get('viewer').id) });
  });

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
    const report = await runBenchmark(db, { fetch: gatewayFetch }, r.row, 'owner');
    if (report.skipped && report.total === 0) return c.json({ error: report.skipped, retryAfterMs: 60_000 }, 429);
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
    if (opts.localAgentsDir) await publishLocalAgents(db, { userId: signedUp.user.id, login: TEST_USER.login }, opts.localAgentsDir, offlineContext());
  }

  return { app, db, auth, testApiKey };
}

export { PGLITE_URL };
