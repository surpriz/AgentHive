import type { Agent } from '../../types';
import { CodeBlock } from '../ui/CodeBlock';
import { buildClaudeJson, buildCliInstall, buildCursorRules, buildManifestYaml } from '../../lib/manifest';

export function ManifestTab({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">A2A / MCP manifest</h3>
        <CodeBlock label="agent.yaml" lang="yaml" code={buildManifestYaml(agent)} maxHeight="26rem" />
      </section>

      <section className="space-y-3">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-dim">Quick install</h3>
        <CodeBlock label="agent-cli" lang="sh" code={buildCliInstall(agent)} />
        <CodeBlock label="~/.claude.json  ·  Claude Code" lang="json" code={buildClaudeJson(agent)} />
        <CodeBlock label=".cursorrules  ·  Cursor" lang="md" code={buildCursorRules(agent)} />
      </section>

      <p className="font-mono text-[11px] text-dim">
        Requires <span className="text-muted">AGENTHIVE_TOKEN</span>. Free tier: 1,000 runs / month.
      </p>
    </div>
  );
}
