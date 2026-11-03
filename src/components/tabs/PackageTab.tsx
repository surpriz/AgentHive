import { useEffect, useState } from 'react';
import { Loader2, Puzzle, Server, SlidersHorizontal, FileText } from 'lucide-react';
import type { Agent } from '../../types';
import { api } from '../../lib/api';
import type { PackageDoc } from '../../lib/retrieval';
import { CodeBlock } from '../ui/CodeBlock';

export function usePackage(agent: Agent) {
  const [pkg, setPkg] = useState<PackageDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPkg(null);
    setError(null);
    api
      .package(agent.name)
      .then((p) => !cancelled && setPkg(p))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'failed to load the package'));
    return () => {
      cancelled = true;
    };
  }, [agent.name, agent.version]);
  return { pkg, error };
}

/** The whole package as text: what the user's tool will read. Nothing is hidden. */
export function PackageTab({ agent }: { agent: Agent }) {
  const { pkg, error } = usePackage(agent);
  if (error) return <p className="font-mono text-[12px] text-danger">{error}</p>;
  if (!pkg) return <p className="flex items-center gap-2 font-mono text-[12px] text-dim"><Loader2 size={13} className="animate-spin" /> loading package…</p>;
  const skills = Object.entries(pkg.files).filter(([p]) => p.startsWith('skills/'));
  const examples = Object.entries(pkg.files).filter(([p]) => p.startsWith('examples/'));
  return (
    <div className="space-y-6">
      <p className="font-mono text-[11px] text-dim">
        {pkg.name}@{pkg.version} · {Object.keys(pkg.files).length} files · sha256 {pkg.sha256?.slice(0, 12) ?? '—'} ·{' '}
        <a href={`/agents/${agent.name}/package.json`} target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">package.json ↗</a>
      </p>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-dim"><FileText size={12} /> prompt.md</h3>
        <CodeBlock label="prompt.md" lang="md" code={pkg.files['prompt.md'] ?? ''} maxHeight="28rem" />
      </section>

      {pkg.settings.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-dim"><SlidersHorizontal size={12} /> settings · {pkg.settings.length}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border font-mono text-[12px]">
            {pkg.settings.map((s) => (
              <li key={s.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="text-fg">{`{{${s.name}}}`}</span>
                <span className="text-dim">{s.type}{s.values ? ` (${s.values.join(' | ')})` : ''}{s.min !== undefined || s.max !== undefined ? ` [${s.min ?? ''}..${s.max ?? ''}]` : ''}</span>
                {s.default !== undefined && <span className="text-muted">default {String(s.default)}</span>}
                {s.description && <span className="w-full font-sans text-[12px] text-muted sm:w-auto">{s.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pkg.bricks.mcp.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-dim"><Server size={12} /> MCP servers · {pkg.bricks.mcp.length}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border text-[12.5px]">
            {pkg.bricks.mcp.map((m) => (
              <li key={m.name} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 font-mono">
                  <span className="text-fg">{m.name}</span>
                  <span className="text-dim">{m.package}</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-warn">
                  {m.permissions.filesystem !== 'none' ? `filesystem ${m.permissions.filesystem}` : 'no filesystem'} · {m.permissions.network.length ? `network ${m.permissions.network.join(', ')}` : 'no network'}
                  {m.env.length ? <span className="text-dim"> · env {m.env.join(', ')}</span> : null}
                  {m.args.length ? <span className="text-dim"> · args {m.args.join(' ')}</span> : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] text-muted">An MCP server is code that runs on your machine. These are pinned to the exact version shown and checked against known vulnerabilities, nothing more.</p>
        </section>
      )}

      {skills.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-dim"><Puzzle size={12} /> skills · {pkg.bricks.skills.length}</h3>
          {skills.map(([path, content]) => (
            <CodeBlock key={path} label={path} lang="md" code={content} maxHeight="20rem" />
          ))}
        </section>
      )}

      {examples.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-dim">examples · {examples.length}</h3>
          {examples.map(([path, content]) => (
            <CodeBlock key={path} label={path} lang={path.endsWith('.json') ? 'json' : 'md'} code={content} maxHeight="14rem" />
          ))}
        </section>
      )}
    </div>
  );
}
