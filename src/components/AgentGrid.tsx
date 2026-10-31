import { SearchX } from 'lucide-react';
import type { Agent } from '../types';
import { AgentCard } from './AgentCard';

export function AgentGrid({
  agents,
  onOpen,
  newIds,
  onReset,
}: {
  agents: Agent[];
  onOpen: (a: Agent) => void;
  newIds: Set<string>;
  onReset: () => void;
}) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
        <SearchX size={28} className="mb-3 text-dim" />
        <p className="font-mono text-sm text-muted">No agents match these filters.</p>
        <button type="button" onClick={onReset} className="mt-3 rounded-md border border-border px-3 py-1.5 font-mono text-[12px] text-muted hover:border-border-strong hover:text-fg">
          reset filters
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} onOpen={onOpen} isNew={newIds.has(a.id)} />
      ))}
    </div>
  );
}
