import type { Agent, Filters } from '../types';

export const EMPTY_FILTERS: Filters = { query: '', framework: 'All', category: 'All', grade: 'All' };

export function filterAgents(agents: Agent[], f: Filters): Agent[] {
  const q = f.query.trim().toLowerCase();
  return agents.filter((a) => {
    if (f.framework !== 'All' && a.framework !== f.framework) return false;
    if (f.category !== 'All' && a.category !== f.category) return false;
    if (f.grade !== 'All' && a.grade !== f.grade) return false;
    if (!q) return true;
    const haystack = [a.name, a.tagline, a.author, a.category, a.framework, ...a.tools, ...a.tags]
      .join(' ')
      .toLowerCase();
    return q.split(/\s+/).every((term) => haystack.includes(term));
  });
}

export function isFiltered(f: Filters): boolean {
  return f.query.trim() !== '' || f.framework !== 'All' || f.category !== 'All' || f.grade !== 'All';
}
