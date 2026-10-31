import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { createDb, PGLITE_URL, type Db } from './db/client';
import { agents } from './db/schema';
import { user as userTable } from './db/auth-schema';
import { seedIfEmpty } from './db/seed';
import { createAuth, type Auth, type AuthEnv } from './auth';
import { parseManifest } from './manifest';
import { publishManifest } from './publish';
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

export async function createApp(opts: AppOptions): Promise<AppContext> {
  const isPglite = opts.databaseUrl.startsWith('pglite://');
  const { db, migrate } = await createDb(opts.databaseUrl);
  if (opts.migrate ?? isPglite) await migrate();
  await seedIfEmpty(db);

  const devLogin = isPglite && process.env.NODE_ENV !== 'production';
  const auth = createAuth(db, { ...opts.auth, passwordLogin: devLogin });
  const app = new Hono();
  const publishHits = new Map<string, number[]>();

  const loadAgents = async (): Promise<Agent[]> => (await db.select().from(agents).orderBy(asc(agents.isSeed), asc(agents.createdAt))).map(rowToAgent);
  const loadAgent = async (name: string): Promise<Agent | null> => {
    const row = await db.query.agents.findFirst({ where: eq(agents.name, name) });
    return row ? rowToAgent(row) : null;
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

    const ct = c.req.header('content-type') ?? '';
    const body = ct.includes('application/json') ? await c.req.json().catch(() => null) : await c.req.text();
    if (body === null) return c.json({ error: 'invalid JSON body' }, 400);
    const parsed = parseManifest(body);
    if (!parsed.ok) return c.json({ error: 'invalid manifest', issues: parsed.issues }, 422);

    const res = await publishManifest(db, { userId: me.id, login: me.login }, parsed.manifest);
    if (!res.ok) return c.json({ error: res.message, code: res.code }, res.status);
    const entry = buildRegistryIndex([res.agent], opts.origin).agents[0];
    return c.json({ agent: res.agent, entry, url: `${opts.origin}/agents/${res.agent.name}` }, res.created ? 201 : 200);
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
