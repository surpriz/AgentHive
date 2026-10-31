import { Search, FileCode2, Download, FlaskConical } from 'lucide-react';
import { Modal } from './ui/Modal';
import { CodeBlock } from './ui/CodeBlock';

const STEPS = [
  {
    icon: <Search size={16} />,
    title: '1. Find an agent',
    body: 'Search the catalog here, from your terminal, or from inside Claude Code and Cursor through the AgentHive MCP server. Every agent is filtered by framework, category and security grade.',
    code: 'agent-cli search postgres',
  },
  {
    icon: <FileCode2 size={16} />,
    title: '2. Read the manifest before you trust it',
    body: 'Each agent ships one manifest: tools it calls, permissions it asks for, input and output schemas, benchmark success rate and audit grade. The same file is served as an A2A agent card for machines.',
    code: 'agent-cli manifest pg-query-optimizer',
  },
  {
    icon: <Download size={16} />,
    title: '3. Install it where you already work',
    body: 'One command writes the MCP entry into Claude Code, a project .mcp.json or Cursor. No runtime to host, no SDK to learn: your editor talks to the agent directly.',
    code: 'agent-cli add pg-query-optimizer --target claude',
  },
] as const;

export function HowItWorksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="How AgentHive works">
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-5">
        <p className="text-[13.5px] leading-relaxed text-muted">
          AgentHive is a registry for AI agents, the way npm is a registry for packages. Agents built with LangGraph, CrewAI, AutoGen, MCP or A2A are
          described by one manifest, graded, and installable in a single command.
        </p>

        <ol className="space-y-4">
          {STEPS.map((s) => (
            <li key={s.title} className="rounded-lg border border-border bg-surface-2 p-3.5">
              <div className="flex items-center gap-2 font-mono text-[13px] font-semibold text-fg">
                <span className="text-accent">{s.icon}</span>
                {s.title}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.body}</p>
              <div className="mt-2.5">
                <CodeBlock code={s.code} lang="bash" />
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3.5" role="note">
          <div className="flex items-center gap-2 font-mono text-[12px] font-semibold text-warn">
            <FlaskConical size={14} />
            What is real in v0, and what is not
          </div>
          <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-fg/80">
            <li>
              <span className="text-ok">Real:</span> the catalog, every manifest and agent card, the JSON registry endpoints, the CLI and the MCP server.
            </li>
            <li>
              <span className="text-warn">Simulated:</span> the sandbox replays a scripted trace and never calls a model. The &ldquo;Push Agent&rdquo; flow stores
              the agent in your browser only.
            </li>
            <li>
              <span className="text-dim">Next:</span> a run gateway that executes agents for real, with logs, quotas and benchmarks computed from actual runs.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
