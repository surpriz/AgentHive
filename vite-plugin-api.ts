import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { getRequestListener } from '@hono/node-server';
import { createApp, type AppContext } from './server/app';
import { optionsFromEnv } from './server/env';

/** Paths the Hono app owns. Everything else stays with Vite (assets, SPA fallback). */
const API_RE = /^\/(api\/|sitemap\.xml$|docs\/(grading|leaderboard)$|agents\/[a-z0-9][a-z0-9-]*(\/(agent\.(json|yaml)|audit\.json|benchmark\.json|package\.json))?\/?$)/;
/** Pages the app serves with a static snapshot when a document is requested. */
const PAGE_RE = /^\/(leaderboard|dashboard)?\/?(\?|$)/;

/**
 * Mounts the registry API inside the Vite dev server so `pnpm dev` is the
 * full stack: same Hono app the Vercel function runs, same database driver
 * selection (DATABASE_URL, defaults to in-memory PGlite).
 */
export function apiPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'agenthive-api',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      let ready: Promise<AppContext> | null = null;
      const boot = () =>
        (ready ??= createApp(
          optionsFromEnv(process.env, {
            template: async () => server.transformIndexHtml('/', fs.readFileSync(path.join(root, 'index.html'), 'utf8')),
            // In-memory database: the catalog shows the repository's own agents, published at boot.
            ...((process.env.DATABASE_URL ?? 'pglite://memory').startsWith('pglite://') ? { localAgentsDir: path.join(root, 'agents') } : {}),
          }),
        ).then((ctx) => {
          if (ctx.testApiKey) server.config.logger.info(`  ➜  test api key: ${ctx.testApiKey}`);
          return ctx;
        }));

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/';
        const isDocument = (req.headers.accept ?? '').includes('text/html');
        if (!API_RE.test(url) && !(PAGE_RE.test(url) && isDocument)) return next();
        // Only pre-render pages for document requests; let Vite handle module/HMR traffic.
        if (/^\/agents\/[a-z0-9-]+\/?(\?|$)/.test(url) && !isDocument) return next();
        try {
          const { app } = await boot();
          await getRequestListener(app.fetch)(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}
