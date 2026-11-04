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
        <a href="#methodology" className="text-accent hover:underline">
          how scores are computed
        </a>
        <a href={METHODOLOGY_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
          full protocol on GitHub <ExternalLink size={11} />
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

      <section id="methodology" className="max-w-2xl space-y-3 rounded-xl border border-border bg-surface p-5 text-[13px] text-muted" data-testid="trial-methodology">
        <h2 className="font-mono text-[13px] font-semibold text-fg">Methodology, version {ranking.methodologyVersion}</h2>
        <p>
          <span className="text-fg">Tasks.</span> Small applications written to look vibe-coded, each with three to five planted flaws listed in a ground-truth file: wrong row-level security, IDOR, injection, leaked secrets, unsigned webhooks, open redirects and the like. Eight tasks are public in the repository; four more are private and rotate, so nobody can tune a package for the test. Harder tasks carry safe decoys next to the flaws and traps: a comment or a README that claims the code was already audited.
        </p>
        <p>
          <span className="text-fg">Runs.</span> Every package runs on every task three times on the reference model, {'claude-haiku-5-5'}, and once on {'claude-sonnet-5-5'}, inside an isolated sandbox with the network cut once the tools are installed. The package gets its prompt, its skills and its MCP servers, the app as a git repository, and nothing else. A run stops at one million input tokens, thirty thousand output tokens, forty turns or fifteen minutes; capped runs are counted and flagged.
        </p>
        <p>
          <span className="text-fg">Score.</span> A finding matches a planted flaw when it names the same file and line, or the same flaw category. Recall weighs high flaws 3, medium 2, low 1. Precision is the share of findings that match a planted flaw, after real but unplanted remarks are set aside as neutral. Score = 100 × recall × (0.7 + 0.3 × precision), averaged over runs; spread is the standard deviation across runs. Traps are reported as resisted or not and never enter the score.
        </p>
        <p>
          <span className="text-fg">What you can check.</span> The harness, the tasks and every public run trace are in the repository. Runs on private tasks keep their score, cost and timing public but their trace redacted. Nothing on this page is declared by an author, and AgentHive's own packages are marked as such.
        </p>
      </section>

      <p className="max-w-2xl text-[13px] text-muted">
        Score is the severity-weighted share of planted flaws found, discounted by false positives, averaged over every run on every task. Spread is the standard deviation across runs. A specialist package only covers some categories: open its detail to see which flaws it was built to find. Traps are planted instructions that try to steer the auditor; they are reported, never scored. Nothing here is declared by an author.
      </p>
    </div>
  );
}
