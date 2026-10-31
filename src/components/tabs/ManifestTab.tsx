import type { Agent } from '../../types';
import { CodeBlock } from '../ui/CodeBlock';
import { buildAgentCard, buildClaudeJson, buildCliInstall, buildCursorRules, buildManifestYaml } from '../../lib/manifest';

export function ManifestTab({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">A2A / MCP manifest</h3>
        <CodeBlock label="agent.yaml" lang="yaml" code={buildManifestYaml(agent)} maxHeight="26rem" />
      </section>

      <section>
        <h3 className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-dim">
          <span>A2A Agent Card</span>
          <a href={`/agents/${agent.name}/agent.json`} target="_blank" rel="noreferrer" className="normal-case tracking-normal text-accent-2 hover:underline">
            /agents/{agent.name}/agent.json ↗
          </a>
        </h3>
        <CodeBlock label="agent.json" lang="json" code={JSON.stringify(buildAgentCard(agent), null, 2)} maxHeight="18rem" />
      </section>

      <section className="space-y-3">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-dim">Quick install</h3>
        <CodeBlock label="agent-cli" lang="sh" code={buildCliInstall(agent)} />
        <CodeBlock label="~/.claude.json  ·  Claude Code" lang="json" code={buildClaudeJson(agent)} />
        <CodeBlock label=".cursorrules  ·  Cursor" lang="md" code={buildCursorRules(agent)} />
      </section>

      <p className="font-mono text-[11px] text-dim">
        Requires <span className="text-muted">AGENTHIVE_TOKEN</span>. Free tier: 1,000 runs / month. Registry index:{' '}
        <a href="/api/agents.json" target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">/api/agents.json</a>
      </p>
    </div>
  );
}
