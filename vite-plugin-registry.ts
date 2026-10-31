import type { Plugin } from 'vite';
import { mockAgents } from './src/data/mockAgents';
import { buildAgentCard, buildRegistryIndex } from './src/lib/manifest';

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
    return out;
  };

  return {
    name: 'agenthive-registry',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0].replace(/^\//, '');
        const body = files()[path];
        if (body === undefined) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
