import { promises as dns } from 'node:dns';
import { createSafeFetch } from './net';
import { isV2, type Manifest } from '../manifest';
import type { AuditContext, AuditSubject, Check, CheckRun, Finding, Report } from './types';
import { gradeOf, scoreOf } from './grade';
import { withTimeout } from './util';
import { secretsCheck } from './checks/secrets';
import { endpointCheck } from './checks/endpoint';
import { permissionsCheck } from './checks/permissions';
import { dependenciesCheck } from './checks/dependencies';
import { completenessCheck } from './checks/completeness';
import { bricksCheck } from './checks/bricks';
import { vulnerabilitiesCheck } from './checks/vulnerabilities';
import { scriptsCheck } from './checks/scripts';

export * from './types';
export { gradeOf, scoreOf } from './grade';

/** Hosted agents: manifest, endpoint and source repository. */
export const CHECKS: Check[] = [secretsCheck, endpointCheck, permissionsCheck, dependenciesCheck, completenessCheck];
/** Declarative packages: files, pinned bricks and their known vulnerabilities. */
export const CHECKS_V2: Check[] = [secretsCheck, bricksCheck, vulnerabilitiesCheck, permissionsCheck, scriptsCheck, completenessCheck];

export const SEVERITY_ORDER: Finding['severity'][] = ['blocker', 'high', 'medium', 'low'];

export function defaultContext(overrides: Partial<AuditContext> = {}): AuditContext {
  const now = () => Date.now();
  const callTimeoutMs = overrides.callTimeoutMs ?? 2500;
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
  bricks: { grade: 'AA', reason: 'bricks could not be resolved' },
  vulnerabilities: { grade: 'AA', reason: 'bricks not checked for known vulnerabilities' },
};

/** Runs every check; a check that throws becomes an error entry plus a low finding and a cap, never a crash. */
export async function runAudit(input: Manifest | AuditSubject, ctx: AuditContext = defaultContext()): Promise<Report> {
  const subject: AuditSubject = 'manifest' in input && !('apiVersion' in input) ? input : { manifest: input as Manifest };
  const v2 = isV2(subject.manifest);
  const findings: Finding[] = [];
  const caps: Report['caps'] = [];
  const checks: CheckRun[] = [];

  const runOne = async (check: Check): Promise<{ run: CheckRun; findings: Finding[]; caps: Report['caps'] }> => {
    const start = ctx.now();
    if (check.network && ctx.now() > ctx.deadline) {
      return {
        run: { id: check.id, status: 'skipped', ms: 0, note: 'audit time budget exhausted' },
        findings: [{ check: check.id, severity: 'low', message: `${check.id} check did not run (time budget)` }],
        caps: UNVERIFIED_CAP[check.id] ? [UNVERIFIED_CAP[check.id]] : [],
      };
    }
    try {
      // Network checks run concurrently, each with its own budget: a slow publisher-controlled host cannot starve the vulnerability check.
      const res = check.network ? await withTimeout(check.run(subject, ctx), ctx.callTimeoutMs * 2 + 500, `${check.id} check`) : await check.run(subject, ctx);
      return { run: { id: check.id, status: res.skipped ? 'skipped' : 'ok', ms: ctx.now() - start, note: res.skipped }, findings: res.findings, caps: res.caps ?? [] };
    } catch (e) {
      return {
        run: { id: check.id, status: 'error', ms: ctx.now() - start, note: (e as Error).message },
        findings: [{ check: check.id, severity: 'low', message: `${check.id} check did not complete` }],
        caps: UNVERIFIED_CAP[check.id] ? [UNVERIFIED_CAP[check.id]] : [],
      };
    }
  };

  const results = await Promise.all((v2 ? CHECKS_V2 : CHECKS).map(runOne));
  for (const r of results) {
    checks.push(r.run);
    findings.push(...r.findings);
    caps.push(...r.caps);
  }
  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  const blocked = findings.some((f) => f.severity === 'blocker');
  const score = blocked ? 0 : scoreOf(findings);
  return { engine: v2 ? 'v2' : 'v1', auditedAt: new Date(ctx.now()).toISOString(), score, grade: blocked ? 'B' : gradeOf(score, caps), caps, blocked, findings, checks };
}

/**
 * A context whose network answers are canned: package registries say every
 * version exists, OSV reports nothing. For local boots and e2e runs, where the
 * checks must not depend on the network.
 */
export function offlineContext(): AuditContext {
  const ok = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith('https://registry.npmjs.org/') || url.startsWith('https://pypi.org/')) return ok('{}');
    if (url.startsWith('https://api.osv.dev/')) return ok(JSON.stringify({ results: [] }));
    return new Response('', { status: 404 });
  }) as typeof fetch;
  return defaultContext({ fetch: fetchImpl, lookup: async () => [{ address: '203.0.113.1', family: 4 }] });
}
