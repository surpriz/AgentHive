import { useState } from 'react';
import { Loader2, Terminal, ClipboardCopy, ShieldAlert } from 'lucide-react';
import type { Agent } from '../../types';
import { CodeBlock } from '../ui/CodeBlock';
import { CLI_PACKAGE_SPEC } from '../../lib/manifest';
import { RETRIEVAL_TARGETS, TARGET_LABEL, cliPull, copyPrompt, type RetrievalTarget } from '../../lib/retrieval';
import { usePackage } from './PackageTab';

/** One action to get the package into a tool: a command, or a prompt the tool executes. Permissions first. */
export function GetTab({ agent }: { agent: Agent }) {
  const [target, setTarget] = useState<RetrievalTarget>('claude');
  const { pkg, error } = usePackage(agent);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://agenthive.sh';
  const layout = pkg?.layouts[target];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Target tool">
        {RETRIEVAL_TARGETS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={target === t}
            onClick={() => setTarget(t)}
            className={`rounded-md border px-3 py-1.5 font-mono text-[12px] transition ${target === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-muted hover:text-fg'}`}
          >
            {TARGET_LABEL[t]}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-dim">{agent.name}@{agent.version}</span>
      </div>

      {error && <p className="font-mono text-[12px] text-danger">{error}</p>}
      {!pkg && !error && <p className="flex items-center gap-2 font-mono text-[12px] text-dim"><Loader2 size={13} className="animate-spin" /> loading package…</p>}

      {layout && (
        <section className="rounded-lg border border-warn/40 bg-warn/5 p-3" data-testid="get-permissions">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-warn"><ShieldAlert size={12} /> before you copy</div>
          <ul className="mt-2 space-y-1 font-mono text-[12px]">
            {layout.files.map((f) => (
              <li key={f.path} className="text-muted">writes <span className="text-fg">{f.path}</span></li>
            ))}
            {layout.mcp.map((m) => (
              <li key={m.name} className="text-muted">
                runs <span className="text-fg">{m.entry.command} {m.entry.args.join(' ')}</span> as MCP server <span className="text-fg">{m.name}</span>
                {' · '}
                <span className="text-warn">{m.permissions.filesystem !== 'none' ? `filesystem ${m.permissions.filesystem}` : 'no filesystem'} · {m.permissions.network.length ? `network ${m.permissions.network.join(', ')}` : 'no network'}</span>
                {Object.keys(m.entry.env).length ? <span className="text-dim"> · you fill in {Object.keys(m.entry.env).join(', ')}</span> : null}
              </li>
            ))}
            {layout.mcp.length === 0 && <li className="text-muted">no MCP server: prompt and skills only, nothing runs on your machine</li>}
          </ul>
          {target === 'codex' && <p className="mt-2 text-[12px] text-muted">Codex reads <span className="text-fg">.codex/config.toml</span> and <span className="text-fg">.agents/skills</span> only in a project you have marked as trusted. Start the agent with its skill name.</p>}
          <p className="mt-2 text-[12px] text-muted">Read the Package tab first. The registry checks secrets, pinned versions and known vulnerabilities; it does not read the prompt for intent. Declared permissions are what the author says the server needs: your tool does not enforce them.</p>
        </section>
      )}

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-dim"><Terminal size={12} /> one command, in your project folder</h3>
        <CodeBlock label="terminal" lang="sh" code={cliPull(agent.name, target, CLI_PACKAGE_SPEC)} />
        <p className="mt-1.5 text-[12px] text-muted">Shows the permissions again, asks for confirmation, writes the files, merges the MCP servers into {layout?.mcpConfigPath ?? (target === 'claude' ? '.mcp.json' : '.cursor/mcp.json')}. Existing files are kept.</p>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-dim"><ClipboardCopy size={12} /> or paste this into {TARGET_LABEL[target]}</h3>
        <CodeBlock label="prompt" lang="md" code={copyPrompt(agent.name, target, origin)} />
        <p className="mt-1.5 text-[12px] text-muted">The prompt only points at the package URL; it never embeds the author's text, so what your tool writes is exactly what the Package tab shows.</p>
      </section>
    </div>
  );
}
