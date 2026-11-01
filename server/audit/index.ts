import { promises as dns } from 'node:dns';
import { createSafeFetch } from './net';
import type { Manifest } from '../manifest';
import type { AuditContext, Check, CheckRun, Finding, Report } from './types';
import { gradeOf, scoreOf } from './grade';
import { withTimeout } from './util';
import { secretsCheck } from './checks/secrets';
import { endpointCheck } from './checks/endpoint';
import { permissionsCheck } from './checks/permissions';
import { dependenciesCheck } from './checks/dependencies';
import { completenessCheck } from './checks/completeness';

export * from './types';
export { gradeOf, scoreOf } from './grade';

export const CHECKS: Check[] = [secretsCheck, endpointCheck, permissionsCheck, dependenciesCheck, completenessCheck];

export const SEVERITY_ORDER: Finding['severity'][] = ['blocker', 'high', 'medium', 'low'];

export function defaultContext(overrides: Partial<AuditContext> = {}): AuditContext {
  const now = () => Date.now();
  const callTimeoutMs = overrides.callTimeoutMs ?? 4000;
  return {
    fetch: createSafeFetch({ timeoutMs: callTimeoutMs }),
    lookup: (host) => dns.lookup(host, { all: true }),
    callTimeoutMs,
    deadline: now() + 8000,
    now,
    ...overrides,
  };
}

/** A verification that did not happen can never raise the grade: skipped or failed network checks cap it. */
const UNVERIFIED_CAP: Record<string, { grade: 'AA'; reason: string }> = {
  endpoint: { grade: 'AA', reason: 'endpoint could not be verified' },
  dependencies: { grade: 'AA', reason: 'dependencies not checked' },
};

/** Runs every check; a check that throws becomes an error entry plus a low finding and a cap, never a crash. */
export async function runAudit(manifest: Manifest, ctx: AuditContext = defaultContext()): Promise<Report> {
  const findings: Finding[] = [];
  const caps: Report['caps'] = [];
  const checks: CheckRun[] = [];
  for (const check of CHECKS) {
    const start = ctx.now();
    if (check.network && ctx.now() > ctx.deadline) {
      checks.push({ id: check.id, status: 'skipped', ms: 0, note: 'audit time budget exhausted' });
      findings.push({ check: check.id, severity: 'low', message: `${check.id} check did not run (time budget)` });
      if (UNVERIFIED_CAP[check.id]) caps.push(UNVERIFIED_CAP[check.id]);
      continue;
    }
    try {
      // Each network check gets its own budget so one publisher-controlled host cannot starve the next check.
      const res = check.network ? await withTimeout(check.run(manifest, ctx), ctx.callTimeoutMs * 3, `${check.id} check`) : await check.run(manifest, ctx);
      findings.push(...res.findings);
      caps.push(...(res.caps ?? []));
      checks.push({ id: check.id, status: res.skipped ? 'skipped' : 'ok', ms: ctx.now() - start, note: res.skipped });
    } catch (e) {
      checks.push({ id: check.id, status: 'error', ms: ctx.now() - start, note: (e as Error).message });
      findings.push({ check: check.id, severity: 'low', message: `${check.id} check did not complete` });
      if (UNVERIFIED_CAP[check.id]) caps.push(UNVERIFIED_CAP[check.id]);
    }
  }
  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  const blocked = findings.some((f) => f.severity === 'blocker');
  const score = blocked ? 0 : scoreOf(findings);
  return { engine: 'v1', auditedAt: new Date(ctx.now()).toISOString(), score, grade: blocked ? 'B' : gradeOf(score, caps), caps, blocked, findings, checks };
}

/** Report shown for the seed agents, which were never audited. */
export function illustrativeReport(grade: Report['grade'], publishedAt: string): Report {
  return { engine: 'v1', auditedAt: publishedAt, score: { AAA: 95, AA: 80, A: 60, B: 40 }[grade], grade, caps: [], blocked: false, findings: [], checks: [], illustrative: true };
}
