import fs from 'node:fs';
import path from 'node:path';
import { waitUntil } from '@vercel/functions';
import { createApp, type AppContext } from './app';
import { optionsFromEnv } from './env';

let ready: Promise<AppContext> | null = null;
let cachedTemplate: string | null = null;

/** The built SPA shell: read from the deployment when bundled, otherwise fetched once from the same origin. */
async function loadTemplate(origin: string): Promise<string> {
  if (cachedTemplate) return cachedTemplate;
  for (const p of [path.join(process.cwd(), 'dist', '_shell.html'), path.join(process.cwd(), 'dist', 'index.html'), path.join(process.cwd(), 'index.html')]) {
    if (fs.existsSync(p)) return (cachedTemplate = fs.readFileSync(p, 'utf8'));
  }
  const res = await fetch(`${origin}/_shell.html`);
  if (!res.ok) throw new Error(`cannot load index.html (${res.status})`);
  return (cachedTemplate = await res.text());
}

/** Query params vercel.json rewrites add: the original path we ask for, plus the named route params the platform appends. */
const REWRITE_PARAMS = ['__path', 'ahp', 'ahname'];

/**
 * Vercel hands the web handler a relative `req.url` (original path, with the
 * rewrite's query merged in). Rebuild an absolute URL from the forwarding
 * headers and restore the original path when the request landed on the
 * function's own path.
 */
export function resolveRequestUrl(rawUrl: string, headers: Headers): URL {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost';
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const url = new URL(rawUrl, `${proto}://${host}`);
  const original = url.searchParams.get('__path');
  if (original && (url.pathname === '/api/index' || url.pathname === '/api/index.mjs')) url.pathname = original;
  for (const p of REWRITE_PARAMS) url.searchParams.delete(p);
  return url;
}

async function handler(req: Request): Promise<Response> {
  const url = resolveRequestUrl(req.url, req.headers);
  const request = url.href === req.url ? req : new Request(url, req);
  ready ??= createApp(optionsFromEnv(process.env, { template: () => loadTemplate(url.origin), background: (p) => waitUntil(p.catch((e) => console.error('background task failed', e))) }));
  const { app } = await ready;
  return app.fetch(request);
}

// Vercel only uses the web-standard (Request → Response) signature for named HTTP method exports;
// a default export would be invoked Node-style with (req, res).
/** Vercel: benchmark runs continue after the response, up to this many seconds. */
export const maxDuration = 60;

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS, handler as HEAD };
