import { Fragment, useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, FlaskConical, Loader2 } from 'lucide-react';
import { api, type TrialRanking } from '../lib/api';

const METHODOLOGY_URL = 'https://github.com/surpriz/AgentHive/blob/main/trials/code-audit/README.md';

const money = (v: number | null) => (v === null ? '—' : `$${v.toFixed(3)}`);
const num = (v: number | null, d = 1) => (v === null ? '—' : v.toFixed(d));
const when = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : 'never');

export function TrialPage({ slug, onOpen }: { slug: string; onOpen: (name: string) => void }) {
  const [ranking, setRanking] = useState<TrialRanking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    setRanking(null);
    api.trial(slug).then(setRanking).catch((e) => setError(e instanceof Error ? e.message : 'failed to load'));
  }, [slug]);

  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-[12px] text-danger">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }
  if (!ranking) {
    return (
      <p className="flex items-center gap-2 font-mono text-[12px] text-dim">
        <Loader2 size={13} className="animate-spin" /> loading trial…
      </p>
    );
  }

  return (
    <div className="space-y-6" data-testid="trial-page">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-dim">
        <span className="flex items-center gap-1">
          <FlaskConical size={13} /> methodology v{ranking.methodologyVersion}
        </span>
        <span>last batch {when(ranking.lastBatchAt)}</span>
        <a href={METHODOLOGY_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
          how scores are computed <ExternalLink size={11} />
        </a>
      </div>

      {ranking.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-[13px] text-muted" data-testid="trial-empty">
          No batch has run yet. The first ranking appears after the harness has run every package on every task of this trial.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full font-mono text-[12px]">
            <thead className="bg-surface-2 text-left text-dim">
              <tr>
                {['#', 'agent', 'model', 'score', 'spread', 'cost / run', 'time', 'traps', 'runs', 'detail'].map((k) => (
                  <th key={k} className="px-3 py-2 font-normal uppercase tracking-wider text-[10px]">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.rows.map((r, i) => (
                <Fragment key={`${r.agent}-${r.model}`}>
                <tr className="border-t border-border" data-testid="trial-row">
                  <td className="px-3 py-2 text-dim">{i + 1}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => onOpen(r.agent)} className="text-accent hover:underline">
                      {r.agent}
                    </button>
                    <span className="ml-1 text-dim">v{r.version}</span>
                  </td>
                  <td className="px-3 py-2 text-muted">{r.model}</td>
                  <td className="px-3 py-2 text-fg">{num(r.score)}</td>
                  <td className="px-3 py-2 text-muted">±{num(r.spread)}</td>
                  <td className="px-3 py-2 text-muted">{money(r.costUsd)}</td>
                  <td className="px-3 py-2 text-muted">{r.seconds === null ? '—' : `${r.seconds}s`}</td>
                  <td className="px-3 py-2 text-muted">{r.traps.total ? `${r.traps.resisted}/${r.traps.total}` : '—'}</td>
                  <td className="px-3 py-2 text-muted">
                    {r.runs} on {r.tasks} tasks{r.capped ? <span className="ml-1 text-warn">({r.capped} capped)</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="text-dim hover:text-fg">
                      {open === i ? 'hide' : 'by category'}
                    </button>
                  </td>
                </tr>
                {open === i && (
                  <tr className="border-t border-border bg-surface-2/40" data-testid="trial-row-categories">
                    <td colSpan={10} className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                        {Object.entries(r.categories)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([cat, c]) => (
                            <span key={cat} className={c.found === c.total ? 'text-ok' : c.found === 0 ? 'text-danger' : 'text-warn'}>
                              {cat} {c.found}/{c.total}
                            </span>
                          ))}
                        {Object.keys(r.categories).length === 0 && <span className="text-dim">no category detail in this batch</span>}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="max-w-2xl text-[13px] text-muted">
        Score is the severity-weighted share of planted flaws found, discounted by false positives, averaged over every run on every task. Spread is the standard deviation across runs. A specialist package only covers some categories: open its detail to see which flaws it was built to find. Traps are planted instructions that try to steer the auditor; they are reported, never scored. Nothing here is declared by an author.
      </p>
    </div>
  );
}
