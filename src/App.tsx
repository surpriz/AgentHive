import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { AgentGrid } from './components/AgentGrid';
import { AgentDetailModal } from './components/AgentDetailModal';
import { PublishModal } from './components/PublishModal';
import { mockAgents } from './data/mockAgents';
import { EMPTY_FILTERS, filterAgents } from './lib/filters';
import type { Agent, Filters, PublishPayload } from './types';

function agentFromPayload(p: PublishPayload): Agent {
  let tools: string[] = ['HTTP Client'];
  let capabilities: string[] = ['example.run'];
  try {
    const m = JSON.parse(p.manifest) as { tools?: unknown; capabilities?: unknown };
    if (Array.isArray(m.tools) && m.tools.every((t) => typeof t === 'string')) tools = m.tools as string[];
    if (Array.isArray(m.capabilities) && m.capabilities.every((t) => typeof t === 'string')) capabilities = m.capabilities as string[];
  } catch {
    /* validated upstream */
  }
  return {
    id: `${p.name}-${Date.now()}`,
    name: p.name,
    version: '0.1.0',
    author: 'you',
    tagline: p.description,
    framework: p.framework,
    category: p.category,
    grade: 'A',
    successRate: 96.0,
    costPerRun: 0.004,
    avgLatencyMs: 3100,
    runs30d: 25,
    tools,
    tags: [p.category.toLowerCase(), p.framework.toLowerCase(), 'new'],
    readme: `${p.description}\n\nSystem prompt:\n${p.systemPrompt}\n\nPublished from agent-cli. Provisional grade A pending full audit.`,
    useCases: ['Freshly pushed. Add use cases in your README.'],
    inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { output: { type: 'string' } } },
    capabilities,
    model: 'claude-sonnet-5-5',
    license: 'MIT',
    publishedAt: new Date().toISOString().slice(0, 10),
  };
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const visible = useMemo(() => filterAgents(agents, filters), [agents, filters]);

  const closeDetail = useCallback(() => setSelected(null), []);
  const closePublish = useCallback(() => setPublishOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !typing && !selected && !publishOpen) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, publishOpen]);

  const onPublished = (p: PublishPayload) => {
    const a = agentFromPayload(p);
    setAgents((prev) => [a, ...prev]);
    setNewIds((prev) => new Set(prev).add(a.id));
    setFilters(EMPTY_FILTERS);
  };

  const stats = useMemo(() => {
    const runs = agents.reduce((s, a) => s + a.runs30d, 0);
    const frameworks = new Set(agents.map((a) => a.framework)).size;
    return { runs, frameworks };
  }, [agents]);

  return (
    <div className="min-h-screen grid-bg">
      <Navbar onPush={() => setPublishOpen(true)} nodeCount={agents.length} />

      <main className="mx-auto max-w-7xl px-4 pb-20">
        <section className="py-10 sm:py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> v0 · public registry · open-core
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-fg sm:text-5xl">
            The registry for <span className="text-accent">interoperable</span> AI agents.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            Discover, audit, run and publish agents across LangGraph, CrewAI, AutoGen, MCP and A2A. One manifest, any runtime.
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[12px] text-dim">
            <div><dt className="inline">agents </dt><dd className="inline text-fg">{agents.length}</dd></div>
            <div><dt className="inline">frameworks </dt><dd className="inline text-fg">{stats.frameworks}</dd></div>
            <div><dt className="inline">runs / 30d </dt><dd className="inline text-fg">{stats.runs.toLocaleString('en-US')}</dd></div>
            <div><dt className="inline">audited </dt><dd className="inline text-ok">100%</dd></div>
          </dl>
        </section>

        <div className="space-y-6">
          <FilterBar filters={filters} onChange={setFilters} count={visible.length} total={agents.length} />
          <AgentGrid agents={visible} onOpen={setSelected} newIds={newIds} onReset={() => setFilters(EMPTY_FILTERS)} />
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 font-mono text-[11px] text-dim sm:flex-row sm:items-center">
          <span>agenthive.sh · the GitHub of agents · V0 catalog + MCP + CLI</span>
          <span>next: managed runtime · reasoning logs · pay-as-you-go · A2A mesh</span>
        </div>
      </footer>

      <AgentDetailModal agent={selected} onClose={closeDetail} />
      <PublishModal open={publishOpen} onClose={closePublish} onPublished={onPublished} />
    </div>
  );
}
