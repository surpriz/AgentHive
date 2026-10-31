import type { Plugin } from 'vite';
import { mockAgents } from './src/data/mockAgents';
import { buildAgentCard, buildRegistryIndex } from './src/lib/manifest';

const ORIGIN = 'https://agenthive.sh';

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
 */
export function registryPlugin(): Plugin {
  const files = (): Record<string, string> => {
    const out: Record<string, string> = {
      'api/agents.json': JSON.stringify(buildRegistryIndex(mockAgents), null, 2),
    };
    for (const a of mockAgents) out[`agents/${a.name}/agent.json`] = JSON.stringify(buildAgentCard(a), null, 2);
    out['sitemap.xml'] = sitemap(mockAgents.map((a) => `/agents/${a.name}`));
    return out;
  };

  return {
    name: 'agenthive-registry',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0].replace(/^\//, '');
        const body = files()[path];
        if (body === undefined) return next();
        res.setHeader('Content-Type', path.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(body);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(files())) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}
