import { Activity, Coins, Wrench } from 'lucide-react';
import type { Agent } from '../types';
import { FrameworkBadge, GradeBadge, Badge } from './ui/Badge';
import { fmtCost, fmtPct } from '../lib/format';

const MAX_TOOLS = 4;

export function AgentCard({ agent, onOpen, isNew }: { agent: Agent; onOpen: (a: Agent) => void; isNew?: boolean }) {
  const visibleTools = agent.tools.slice(0, MAX_TOOLS);
  const extra = agent.tools.length - visibleTools.length;

  return (
    <button
      type="button"
      onClick={() => onOpen(agent)}
      className="group relative flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:glow-accent focus-visible:border-accent/60 animate-fade-up"
      aria-label={`Open ${agent.name}`}
    >
      {isNew && (
        <span className="absolute -top-2 right-3 rounded-full border border-accent/50 bg-bg px-2 py-0.5 font-mono text-[10px] text-accent">just pushed</span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-[14px] font-semibold text-fg group-hover:text-accent">{agent.name}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-dim">
            v{agent.version} <span className="mx-1">·</span> by <span className="text-muted">{agent.author}</span>
          </p>
        </div>
        <GradeBadge grade={agent.grade} title={agent.isSeed ? 'Illustrative seed grade' : agent.grade === 'pending' ? 'Audit pending' : `Security grade, computed by the registry · ${agent.score}/100`} />
      </div>

      <div className="space-y-1">
        <p className="line-clamp-2 text-[13px] leading-snug text-fg/90">{agent.value}</p>
        <p className="line-clamp-2 text-[12px] leading-snug text-dim">{agent.tagline}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <FrameworkBadge framework={agent.framework} />
        <Badge mono={false}>{agent.category}</Badge>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-[12px]">
        <div className="flex items-center gap-1.5 text-muted" title={agent.isSeed ? 'Illustrative benchmark' : agent.benchmark ? `Registry benchmark, ${agent.benchmark.ranAt.slice(0, 10)}` : 'No benchmark yet'}>
          <Activity size={13} className="text-ok" />
          <span className="text-fg">{fmtPct(agent.benchmark?.passRate ?? null)}</span> success
        </div>
        <div className="flex items-center gap-1.5 text-muted" title="Average cost per execution">
          <Coins size={13} className="text-accent" />
          <span className="text-fg">{fmtCost(agent.costPerRun)}</span> / run
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-hidden font-mono text-[11px] text-dim">
        <Wrench size={12} className="shrink-0" />
        <span className="truncate">
          [{visibleTools.join(', ')}
          {extra > 0 && `, +${extra}`}]
        </span>
      </div>
    </button>
  );
}
