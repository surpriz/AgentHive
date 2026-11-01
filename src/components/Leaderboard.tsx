import { useEffect, useState } from 'react';
import { Trophy, ArrowUp, ArrowDown, Minus, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { CATEGORIES } from '../types';
import { api, type Leaderboard as Board, type LeaderboardEntry } from '../lib/api';
import { agentPath } from '../lib/router';
import { GradeBadge } from './ui/Badge';

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

export function Leaderboard({ onOpen }: { onOpen: (name: string) => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('all');

  useEffect(() => {
    api.leaderboard().then(setBoard).catch((e) => setError(e instanceof Error ? e.message : 'failed to load'));
  }, []);

  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-[12px] text-danger">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }
  if (!board) {
    return (
      <p className="flex items-center gap-2 font-mono text-[12px] text-dim">
        <Loader2 size={13} className="animate-spin" /> loading leaderboard…
      </p>
    );
  }
  const shown = category === 'all' ? CATEGORIES.filter((c) => board.categories[c]?.length) : [category];
  const ranked = Object.values(board.categories).flat().length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Category">
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`rounded-full border px-2.5 py-1 text-[12px] transition ${category === c ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-fg'}`}
          >
            {c === 'all' ? 'All categories' : c}
            {c !== 'all' && board.categories[c]?.length ? <span className="ml-1 font-mono text-[10px] text-dim">{board.categories[c].length}</span> : null}
          </button>
        ))}
      </div>

      {ranked === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-[13px] text-muted" data-testid="leaderboard-empty">
          No agent is ranked yet. An agent enters the leaderboard once it has a computed grade and a benchmark for its current version. Publish one with a real endpoint and declared test cases to be first.
        </div>
      )}

      {shown.map((cat) => {
        const entries = board.categories[cat] ?? [];
        if (entries.length === 0 && category !== 'all') {
          return (
            <p key={cat} className="rounded-xl border border-dashed border-border p-6 text-[13px] text-muted">
              Nobody ranked in {cat} yet.
            </p>
          );
        }
        if (entries.length === 0) return null;
        return (
          <section key={cat} data-testid={`board-${cat}`}>
            <h2 className="mb-2 flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-dim">
              <Trophy size={13} className="text-accent" /> {cat}
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="font-mono text-[10px] uppercase tracking-wider text-dim">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">agent</th>
                    <th className="px-3 py-2">grade</th>
                    <th className="px-3 py-2 text-right">score</th>
                    <th className="px-3 py-2 text-right">benchmark</th>
                    <th className="px-3 py-2 text-right">audit</th>
                    <th className="px-3 py-2 text-right">availability</th>
                    <th className="px-3 py-2 text-right">runs 30d</th>
                    <th className="px-3 py-2 text-right">move</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <Row key={e.name} e={e} onOpen={onOpen} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {board.illustrative.length > 0 && (
        <section>
          <h2 className="mb-2 font-mono text-[12px] uppercase tracking-wider text-dim">illustrative seeds · not ranked</h2>
          <p className="mb-2 text-[12.5px] text-muted">Shipped with the registry to show the format; their numbers were never measured.</p>
          <ul className="flex flex-wrap gap-2">
            {board.illustrative.map((s) => (
              <li key={s.name}>
                <a href={agentPath(s.name)} onClick={(ev) => { ev.preventDefault(); onOpen(s.name); }} className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 font-mono text-[12px] text-muted hover:text-fg">
                  {s.name} <GradeBadge grade={s.grade as 'AAA'} title="Illustrative seed grade" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="font-mono text-[11px] text-dim">
        {board.formula} · generated {board.generatedAt.slice(0, 16).replace('T', ' ')} UTC ·{' '}
        <a href="/docs/leaderboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
          how ranks are computed <ExternalLink size={11} />
        </a>
      </p>
    </div>
  );
}

function Row({ e, onOpen }: { e: LeaderboardEntry; onOpen: (name: string) => void }) {
  const move = e.delta === null ? <span className="text-accent-2">new</span> : e.delta > 0 ? <span className="inline-flex items-center gap-0.5 text-ok"><ArrowUp size={12} />{e.delta}</span> : e.delta < 0 ? <span className="inline-flex items-center gap-0.5 text-danger"><ArrowDown size={12} />{-e.delta}</span> : <span className="text-dim"><Minus size={12} /></span>;
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-2">
      <td className="px-3 py-2 font-mono text-dim">{e.rank}</td>
      <td className="px-3 py-2">
        <button type="button" onClick={() => onOpen(e.name)} className="text-left">
          <span className="block font-mono text-[13px] font-semibold text-fg">{e.name}</span>
          <span className="block max-w-[360px] truncate text-[12px] text-muted">{e.value}</span>
          <span className="block font-mono text-[10px] text-dim">by {e.author} · v{e.version}</span>
        </button>
      </td>
      <td className="px-3 py-2"><GradeBadge grade={e.grade as 'AAA'} title={`Computed grade · ${e.components.audit}/100`} /></td>
      <td className="px-3 py-2 text-right font-mono font-semibold text-accent">{e.score}</td>
      <td className="px-3 py-2 text-right font-mono text-fg" title={e.benchmarkCases > 0 ? `${e.benchmarkCases} author-declared cases` : 'probes only, capped at 50'}>{pct(e.components.benchmark)}{e.benchmarkCases === 0 && <span className="ml-1 text-[10px] text-dim">probes</span>}</td>
      <td className="px-3 py-2 text-right font-mono text-fg">{e.components.audit}</td>
      <td className="px-3 py-2 text-right font-mono text-fg">{pct(e.components.availability)}</td>
      <td className="px-3 py-2 text-right font-mono text-muted">{e.runs30d}</td>
      <td className="px-3 py-2 text-right font-mono text-[12px]">{move}</td>
    </tr>
  );
}
