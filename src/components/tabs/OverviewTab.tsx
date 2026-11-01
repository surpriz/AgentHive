import { useEffect, useState } from 'react';
import { Activity, Coins, Timer, BarChart3, CheckCircle2, XCircle, FlaskConical, Loader2 } from 'lucide-react';
import { api, type BenchmarkReport } from '../../lib/api';
import type { Agent } from '../../types';
import { CodeBlock } from '../ui/CodeBlock';
import { fmtLatency, fmtPct, fmtRuns } from '../../lib/format';

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-dim">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-fg">{value}</div>
      {hint && <div className="font-mono text-[10px] text-dim">{hint}</div>}
    </div>
  );
}

export function OverviewTab({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric icon={<Activity size={12} className="text-ok" />} label="Success" value={fmtPct(agent.benchmark?.passRate ?? null)} hint={agent.isSeed ? "illustrative" : agent.benchmark ? `benchmark, ${agent.benchmark.ranAt.slice(0, 10)}` : "no benchmark yet"} />
        <Metric icon={<Coins size={12} className="text-accent" />} label="Availability" value={fmtPct(agent.successRate)} hint={agent.isSeed ? "illustrative" : agent.successRate === null ? "after 20 gateway runs" : "ok runs over 30d"} />
        <Metric icon={<Timer size={12} className="text-accent-2" />} label="Latency" value={fmtLatency(agent.avgLatencyMs)} hint={agent.isSeed ? "illustrative" : "mean of ok runs, 30d"} />
        <Metric icon={<BarChart3 size={12} className="text-violet" />} label="Runs" value={fmtRuns(agent.runs30d)} hint={agent.isSeed ? "illustrative" : "through the gateway, 30d"} />
      </div>

      {!agent.isSeed && <BenchmarkSection agent={agent} />}

      <section>
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">README</h3>
        <div className="space-y-3 text-[13.5px] leading-relaxed text-fg/85">
          {agent.readme.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">Use cases</h3>
        <ul className="space-y-1.5">
          {agent.useCases.map((u) => (
            <li key={u} className="flex items-start gap-2 text-[13px] text-muted">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" />
              {u}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <CodeBlock label="input.schema.json" lang="json" code={JSON.stringify(agent.inputSchema, null, 2)} />
        <CodeBlock label="output.schema.json" lang="json" code={JSON.stringify(agent.outputSchema, null, 2)} />
      </section>

      <section className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border p-3 font-mono text-[12px] sm:grid-cols-4">
        <div><span className="text-dim">model</span><br />{agent.model}</div>
        <div><span className="text-dim">license</span><br />{agent.license}</div>
        <div><span className="text-dim">published</span><br />{agent.publishedAt}</div>
        <div><span className="text-dim">tools</span><br />{agent.tools.length}</div>
      </section>
    </div>
  );
}

function BenchmarkSection({ agent }: { agent: Agent }) {
  const [data, setData] = useState<{ runnable: boolean; reason: string | null; benchmark: BenchmarkReport | null } | null>(null);
  useEffect(() => {
    api.benchmark(agent.name).then((r) => setData({ runnable: r.runnable, reason: r.reason, benchmark: (r.benchmark as BenchmarkReport | null) ?? null })).catch(() => setData({ runnable: false, reason: 'unavailable', benchmark: null }));
  }, [agent.name]);
  return (
    <section data-testid="benchmark-section">
      <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-dim">
        <FlaskConical size={12} /> Benchmark
      </h3>
      {!data ? (
        <p className="flex items-center gap-2 font-mono text-[12px] text-dim"><Loader2 size={12} className="animate-spin" /> loading…</p>
      ) : !data.runnable ? (
        <p className="text-[12.5px] text-muted">Not benchmarked: {data.reason}.</p>
      ) : !data.benchmark || !('results' in data.benchmark) ? (
        <p className="text-[12.5px] text-muted">No benchmark yet. It runs after each publish, daily, and on demand from the dashboard. Declare cases in <span className="font-mono text-fg">spec.tests</span> to measure more than liveness.</p>
      ) : (
        <div className="space-y-2">
          <p className="font-mono text-[11.5px] text-dim">
            {data.benchmark.passed}/{data.benchmark.total} passed · {data.benchmark.passRate}% · {data.benchmark.ranAt.slice(0, 16).replace('T', ' ')} · trigger {data.benchmark.trigger} · v{data.benchmark.version}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {data.benchmark.results.map((r) => (
              <li key={r.name} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]">
                {r.passed ? <CheckCircle2 size={13} className="shrink-0 text-ok" /> : <XCircle size={13} className="shrink-0 text-danger" />}
                <span className="text-fg">{r.name}</span>
                <span className="font-mono text-[10px] uppercase text-dim">{r.kind}</span>
                {r.reason && <span className="truncate text-[12px] text-muted">· {r.reason}</span>}
                <span className="ml-auto shrink-0 font-mono text-[11px] text-dim">{r.status ?? '—'} · {r.latencyMs}ms</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
