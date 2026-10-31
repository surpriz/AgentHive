import { Activity, Coins, Timer, BarChart3, CheckCircle2 } from 'lucide-react';
import type { Agent } from '../../types';
import { CodeBlock } from '../ui/CodeBlock';
import { fmtCost, fmtLatency, fmtPct, fmtRuns } from '../../lib/format';

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
        <Metric icon={<Activity size={12} className="text-ok" />} label="Success" value={fmtPct(agent.successRate)} hint={agent.successRate === null ? "not yet benchmarked" : "benchmark, 500 runs"} />
        <Metric icon={<Coins size={12} className="text-accent" />} label="Cost / run" value={fmtCost(agent.costPerRun)} hint="avg, 30d" />
        <Metric icon={<Timer size={12} className="text-accent-2" />} label="Latency" value={fmtLatency(agent.avgLatencyMs)} hint="p50" />
        <Metric icon={<BarChart3 size={12} className="text-violet" />} label="Runs" value={fmtRuns(agent.runs30d)} hint="last 30 days" />
      </div>

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
