import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { mockAgents } from './src/data/mockAgents';
import { buildAgentCard, buildManifestYaml, buildRegistryIndex } from './src/lib/manifest';
import { renderAgentHtml, SITE_ORIGIN } from './src/lib/seo';

const ORIGIN = SITE_ORIGIN;

function sitemap(paths: string[]): string {
  const urls = ['/', ...paths]
    .map((p) => `  <url><loc>${ORIGIN}${p}</loc><changefreq>daily</changefreq></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Serves (dev) and emits (build) the machine-readable registry:
 *   /api/agents.json              index of every agent
 *   /agents/<name>/agent.json     A2A agent card per agent
 *   /agents/<name>/agent.yaml     AgentHive manifest per agent
 *
 * Also pre-renders /agents/<name>/index.html from the built index.html with
 * per-agent title, description, Open Graph and JSON-LD, so link previews and
 * crawlers see the agent instead of the home page. Unknown names still fall
 * through to the SPA (vercel.json rewrite) and get the in-app 404 banner.
 */
export function registryPlugin(): Plugin {
  const files = (): Record<string, string> => {
    const out: Record<string, string> = {
      'api/agents.json': JSON.stringify(buildRegistryIndex(mockAgents), null, 2),
    };
    for (const a of mockAgents) {
      out[`agents/${a.name}/agent.json`] = JSON.stringify(buildAgentCard(a), null, 2);
      out[`agents/${a.name}/agent.yaml`] = buildManifestYaml(a);
    }
    out['sitemap.xml'] = sitemap(mockAgents.map((a) => `/agents/${a.name}`));
    return out;
  };

  const agentFromPath = (p: string) => {
    const m = /^agents\/([a-z0-9][a-z0-9-]*)\/?$/.exec(p);
    return m ? mockAgents.find((a) => a.name === m[1]) : undefined;
  };

  let root = process.cwd();

  return {
    name: 'agenthive-registry',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        const p = url.split('?')[0].replace(/^\//, '');
        const body = files()[p];
        if (body !== undefined) {
          const type = p.endsWith('.xml') ? 'application/xml' : p.endsWith('.yaml') ? 'application/yaml' : 'application/json';
          res.setHeader('Content-Type', `${type}; charset=utf-8`);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(body);
          return;
        }
        const agent = agentFromPath(p);
        if (!agent || req.headers.accept?.includes('text/html') === false) return next();
        try {
          const template = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
          const html = await server.transformIndexHtml(url, renderAgentHtml(template, agent, ORIGIN));
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (e) {
          next(e);
        }
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(files())) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
    writeBundle(options) {
      const outDir = options.dir ?? path.join(root, 'dist');
      const indexPath = path.join(outDir, 'index.html');
      if (!fs.existsSync(indexPath)) return;
      const template = fs.readFileSync(indexPath, 'utf8');
      for (const a of mockAgents) {
        const dir = path.join(outDir, 'agents', a.name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), renderAgentHtml(template, a, ORIGIN));
      }
    },
  };
}
