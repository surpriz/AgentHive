import type { AuditGrade, Cap, Finding, Severity } from './types';

export const PENALTY: Record<Exclude<Severity, 'blocker'>, number> = { high: 25, medium: 10, low: 3 };
export const THRESHOLDS: { grade: AuditGrade; min: number }[] = [
  { grade: 'AAA', min: 90 },
  { grade: 'AA', min: 75 },
  { grade: 'A', min: 55 },
  { grade: 'B', min: 0 },
];

const ORDER: AuditGrade[] = ['B', 'A', 'AA', 'AAA'];

export function scoreOf(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) if (f.severity !== 'blocker') score -= PENALTY[f.severity];
  return Math.max(0, score);
}

export function gradeOf(score: number, caps: { grade: Cap }[]): AuditGrade {
  let grade = THRESHOLDS.find((t) => score >= t.min)!.grade;
  for (const c of caps) if (ORDER.indexOf(c.grade) < ORDER.indexOf(grade)) grade = c.grade;
  return grade;
}
