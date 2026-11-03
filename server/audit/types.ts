import type { Manifest, PackageFiles } from '../manifest';

export type Severity = 'blocker' | 'high' | 'medium' | 'low';
export type CheckId = 'secrets' | 'endpoint' | 'permissions' | 'dependencies' | 'completeness' | 'bricks' | 'vulnerabilities' | 'scripts';
export type AuditGrade = 'AAA' | 'AA' | 'A' | 'B';
export type Cap = 'AA' | 'A';

export interface Finding {
  check: CheckId;
  severity: Severity;
  message: string;
  hint?: string;
}

export interface CheckRun {
  id: CheckId;
  status: 'ok' | 'skipped' | 'error';
  ms: number;
  /** Why it was skipped, or the error message. */
  note?: string;
}

export interface Report {
  /** `v1`: hosted agents (endpoint, source repo). `v2`: declarative packages (bricks, files). */
  engine: 'v1' | 'v2';
  auditedAt: string;
  score: number;
  grade: AuditGrade;
  /** Highest grade allowed and why, when something could not be verified. */
  caps: { grade: Cap; reason: string }[];
  blocked: boolean;
  findings: Finding[];
  checks: CheckRun[];
  /** Seeds carry hand-written grades, never a real audit. */
  illustrative?: boolean;
}

export interface DnsLookup {
  (hostname: string): Promise<{ address: string; family: number }[]>;
}

export interface AuditContext {
  fetch: typeof fetch;
  lookup: DnsLookup;
  /** Per network call, ms. */
  callTimeoutMs: number;
  /** Whole audit, ms. Checks that would start after the deadline are skipped. */
  deadline: number;
  now: () => number;
}

export interface CheckResult {
  findings: Finding[];
  caps?: { grade: Cap; reason: string }[];
  /** Set when the check could not do its job (network, parse); the run is marked skipped with this note. */
  skipped?: string;
}

/** What a check looks at: the manifest, plus the package files for v2. */
export interface AuditSubject {
  manifest: Manifest;
  files?: PackageFiles;
}

export interface Check {
  id: CheckId;
  /** Whether the check touches the network: only those are subject to the deadline. */
  network: boolean;
  run(subject: AuditSubject, ctx: AuditContext): Promise<CheckResult>;
}
