import { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, FlaskConical, Loader2 } from 'lucide-react';
import type { Agent } from '../../types';
import { api, type TrialRunSummary } from '../../lib/api';

const TRIAL = 'code-audit';

const money = (v: number | null) => (v === null ? '—' : `$${v.toFixed(3)}`);
const score = (v: number | null) => (v === null ? 'no report' : v.toFixed(1));

/** The package's recorded runs in the trial, newest batch first, each one opening its full trace. */
export function TrialTab({ agent }: { agent: Agent }) {
  const [runs, setRuns] = useState<TrialRunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRuns(null);
    api
      .trialRuns(TRIAL, agent.name)
      .then(setRuns)
      .catch((e) => setError(e instanceof Error ? e.message : 'failed to load'));
  }, [agent.name]);

  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-[12px] text-danger">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }
  if (!runs) {
    return (
      <p className="flex items-center gap-2 font-mono text-[12px] text-dim">
        <Loader2 size={13} className="animate-spin" /> loading runs…
      </p>
    );
  }
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-[13px] text-muted" data-testid="trial-tab-empty">
        No recorded run yet. This package enters the <a href={`/trials/${TRIAL}`} className="text-accent hover:underline">code audit trial</a> on the next batch.
      </div>
    );
  }

  const batches = [...new Set(runs.map((r) => r.batchId))];
  const latest = runs.filter((r) => r.batchId === batches[0]);
  const scored = latest.map((r) => r.score).filter((s): s is number => s !== null);
  const mean = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;

  return (
    <div className="space-y-5" data-testid="trial-tab">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-dim">
        <span className="flex items-center gap-1">
          <FlaskConical size={13} /> batch {batches[0]}
        </span>
        <span>{latest.length} runs</span>
        <span>mean score {mean === null ? '—' : mean.toFixed(1)}</span>
        <a href={`/trials/${TRIAL}`} className="flex items-center gap-1 text-accent hover:underline">
          ranking <ExternalLink size={11} />
        </a>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full font-mono text-[12px]">
          <thead className="bg-surface-2 text-left text-dim">
            <tr>
              {['task', 'run', 'model', 'score', 'recall', 'precision', 'traps', 'cost', 'time', 'trace'].map((k) => (
                <th key={k} className="px-3 py-2 font-normal uppercase tracking-wider text-[10px]">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latest.map((r) => (
              <tr key={r.id} className="border-t border-border" data-testid="trial-run-row">
                <td className="px-3 py-2 text-fg">{r.task}</td>
                <td className="px-3 py-2 text-dim">#{r.runIndex}</td>
                <td className="px-3 py-2 text-muted">{r.model}</td>
                <td className="px-3 py-2 text-fg">
                  {score(r.score)}
                  {r.capped ? <span className="ml-1 text-warn">capped</span> : null}
                </td>
                <td className="px-3 py-2 text-muted">{r.recall === null ? '—' : r.recall.toFixed(2)}</td>
                <td className="px-3 py-2 text-muted">{r.precision === null ? '—' : r.precision.toFixed(2)}</td>
                <td className="px-3 py-2 text-muted">{r.traps.total ? `${r.traps.resisted}/${r.traps.total}` : '—'}</td>
                <td className="px-3 py-2 text-muted">{money(r.costUsd)}</td>
                <td className="px-3 py-2 text-muted">{Math.round(r.durationMs / 1000)}s</td>
                <td className="px-3 py-2">
                  <a href={`/api/trials/runs/${r.id}.json`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    json
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {batches.length > 1 && <p className="font-mono text-[11px] text-dim">{batches.length - 1} earlier batch{batches.length > 2 ? 'es' : ''} on record.</p>}
      <p className="max-w-2xl text-[13px] text-muted">Recorded by the harness on a reference model, in a sandbox, without the author's machine. Each trace holds every tool call and the final report.</p>
    </div>
  );
}
