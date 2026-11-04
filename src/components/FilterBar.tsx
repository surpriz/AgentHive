import { Search, X, RotateCcw } from 'lucide-react';
import { CATEGORIES, FRAMEWORKS, GRADES } from '../types';
import type { Filters } from '../types';
import { isFiltered } from '../lib/filters';

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | 'All';
  onChange: (v: T | 'All') => void;
}) {
  const all: (T | 'All')[] = ['All', ...options];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-dim">{label}</span>
      {all.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={`rounded-md border px-2 py-0.5 text-[12px] transition ${
              active
                ? 'border-accent/60 bg-accent/10 text-accent'
                : 'border-border bg-surface text-muted hover:border-border-strong hover:text-fg'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function FilterBar({
  filters,
  onChange,
  count,
  total,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  count: number;
  total: number;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const active = isFiltered(filters);

  return (
    <section className="space-y-3" aria-label="Search and filters">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => set('query', e.target.value)}
          placeholder='Search agents… try "SQL", "Compliance", "Refactoring"'
          className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-24 font-mono text-[13px] text-fg placeholder:text-dim focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          aria-label="Search agents"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {filters.query && (
            <button type="button" onClick={() => set('query', '')} className="rounded p-1 text-dim hover:text-fg" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-dim sm:inline">/</kbd>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
        <ChipGroup label="Framework" options={FRAMEWORKS} value={filters.framework} onChange={(v) => set('framework', v)} />
        <ChipGroup label="Category" options={CATEGORIES} value={filters.category} onChange={(v) => set('category', v)} />
        <ChipGroup label="Grade" options={GRADES} value={filters.grade} onChange={(v) => set('grade', v)} />
        <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted">
          <input type="checkbox" checked={filters.testedOnly} onChange={(e) => set('testedOnly', e.target.checked)} className="accent-[var(--color-accent)]" />
          tested only
        </label>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] text-dim">
        <span>
          <span className="text-fg">{count}</span> / {total} agents
        </span>
        {active && (
          <button type="button" onClick={() => onChange({ query: '', framework: 'All', category: 'All', grade: 'All', testedOnly: false })} className="inline-flex items-center gap-1 text-muted hover:text-fg">
            <RotateCcw size={11} /> reset filters
          </button>
        )}
      </div>
    </section>
  );
}
