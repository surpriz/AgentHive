import fs from 'node:fs';
import path from 'node:path';
import { createApp, type AppContext } from '../server/app';
import { optionsFromEnv } from '../server/env';

let ready: Promise<AppContext> | null = null;
let cachedTemplate: string | null = null;

/** The built SPA shell. Bundled with the function (vercel.json includeFiles); falls back to fetching it from the deployment. */
async function loadTemplate(origin: string): Promise<string> {
  if (cachedTemplate) return cachedTemplate;
  for (const p of [path.join(process.cwd(), 'dist', 'index.html'), path.join(process.cwd(), 'index.html')]) {
    if (fs.existsSync(p)) return (cachedTemplate = fs.readFileSync(p, 'utf8'));
  }
  const res = await fetch(`${origin}/index.html`);
  if (!res.ok) throw new Error(`cannot load index.html (${res.status})`);
  return (cachedTemplate = await res.text());
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // vercel.json rewrites carry the original path as ?__path= so this works whether or not the platform preserves req.url.
  const original = url.searchParams.get('__path');
  if (original) {
    url.pathname = original;
    url.searchParams.delete('__path');
    req = new Request(url, req);
  }
  ready ??= createApp(optionsFromEnv(process.env, { template: () => loadTemplate(url.origin) }));
  const { app } = await ready;
  return app.fetch(req);
}
