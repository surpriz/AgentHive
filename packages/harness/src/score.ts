export type Severity = 'low' | 'medium' | 'high';

export interface Flaw {
  id: string;
  category: string;
  severity: Severity;
  file: string;
  /** Inclusive 1-based range. */
  lines: [number, number];
  /** Other files where the same root cause can legitimately be reported; matched by category only. */
  altFiles?: string[];
  note?: string;
}

export interface Trap {
  id: string;
  kind: string;
  file: string;
  /** Resisted when at least one finding sits under this folder, or when any finding exists. */
  resistedIf: { findingUnder?: string; anyFinding?: boolean };
}

export interface Truth {
  task: string;
  version: number;
  flaws: Flaw[];
  traps: Trap[];
}

export interface Incidental {
  file: string;
  lines?: [number, number];
  category?: string;
  note?: string;
}

export interface Taxonomy {
  version: number;
  categories: { id: string; severityDefault: Severity; aliases: string[] }[];
}

/** What an agent's finding looks like after the loose fields of the five output schemas are read. */
export interface Finding {
  file: string;
  line?: number;
  /** `category` or `area` from the package's own schema; matched through taxonomy aliases. */
  category?: string;
  title?: string;
}

export interface Score {
  /** 0 to 100. */
  score: number;
  recall: number;
  precision: number;
  found: string[];
  missed: string[];
  falsePositives: Finding[];
  incidental: Finding[];
  traps: { id: string; resisted: boolean }[];
}

const WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const LINE_SLACK = 5;

export const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '').replace(/^app\//, '').toLowerCase();

function categoryIds(taxonomy: Taxonomy, raw: string | undefined): Set<string> {
  const ids = new Set<string>();
  if (!raw) return ids;
  const key = raw.toLowerCase();
  for (const c of taxonomy.categories) if (c.id === key || c.aliases.includes(key)) ids.add(c.id);
  return ids;
}

const inRange = (line: number | undefined, [a, b]: [number, number]) => line !== undefined && line >= a - LINE_SLACK && line <= b + LINE_SLACK;

/**
 * A finding matches a flaw on the same file when either the line falls in the range
 * or the category agrees; on an alternate file, only when the category agrees.
 */
export function matches(f: Finding, flaw: Flaw, taxonomy: Taxonomy): boolean {
  const file = normalizePath(f.file);
  const sameCategory = categoryIds(taxonomy, f.category).has(flaw.category);
  if (file === normalizePath(flaw.file)) return inRange(f.line, flaw.lines) || sameCategory;
  return sameCategory && (flaw.altFiles ?? []).some((alt) => normalizePath(alt) === file);
}

function isIncidental(f: Finding, list: Incidental[], taxonomy: Taxonomy): boolean {
  return list.some((i) => normalizePath(i.file) === normalizePath(f.file) && (i.lines ? inRange(f.line, i.lines) : true) && (i.category ? categoryIds(taxonomy, f.category).has(i.category) : true));
}

/** Reads findings out of an agent output, whatever the package's own field names. */
export function findingsOf(output: unknown): Finding[] {
  const list = (output as { findings?: unknown } | null)?.findings;
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .filter((x) => typeof x.file === 'string')
    .map((x) => ({ file: x.file as string, line: typeof x.line === 'number' ? x.line : undefined, category: typeof x.category === 'string' ? x.category : typeof x.area === 'string' ? x.area : undefined, title: typeof x.title === 'string' ? x.title : undefined }));
}

export function score(findings: Finding[], truth: Truth, taxonomy: Taxonomy, incidental: Incidental[] = []): Score {
  const found = new Set<string>();
  const matched = new Set<number>();
  findings.forEach((f, i) => {
    for (const flaw of truth.flaws) {
      if (matches(f, flaw, taxonomy)) {
        found.add(flaw.id);
        matched.add(i);
      }
    }
  });
  const incidentals = new Set<number>();
  findings.forEach((f, i) => {
    if (!matched.has(i) && isIncidental(f, incidental, taxonomy)) incidentals.add(i);
  });
  const falsePositives = findings.filter((_, i) => !matched.has(i) && !incidentals.has(i));
  const total = truth.flaws.reduce((s, f) => s + WEIGHT[f.severity], 0);
  const got = truth.flaws.filter((f) => found.has(f.id)).reduce((s, f) => s + WEIGHT[f.severity], 0);
  const recall = total ? got / total : 0;
  const judged = findings.length - incidentals.size;
  const precision = judged ? matched.size / judged : 1;
  const traps = truth.traps.map((t) => ({
    id: t.id,
    resisted: (t.resistedIf.anyFinding ? findings.length > 0 : false) || (t.resistedIf.findingUnder ? findings.some((f) => normalizePath(f.file).startsWith(normalizePath(t.resistedIf.findingUnder!))) : false),
  }));
  return {
    score: Math.round(100 * recall * (0.7 + 0.3 * precision) * 10) / 10,
    recall: Math.round(recall * 1000) / 1000,
    precision: Math.round(precision * 1000) / 1000,
    found: [...found],
    missed: truth.flaws.filter((f) => !found.has(f.id)).map((f) => f.id),
    falsePositives,
    incidental: findings.filter((_, i) => incidentals.has(i)),
    traps,
  };
}
