import type { Check, CheckResult, Finding } from '../types';
import { withTimeout } from '../util';
import { isV2, NPM_PACKAGE_RE, PYPI_PACKAGE_RE } from '../../manifest';
import type { Dep } from './dependencies';

/** Turns a brick reference into a queryable (ecosystem, name, version); null when it does not match either form. */
export function brickDep(pkg: string): Dep | null {
  const n = NPM_PACKAGE_RE.exec(pkg);
  if (n) return { ecosystem: 'npm', name: n[1], version: n[2] };
  const p = PYPI_PACKAGE_RE.exec(pkg);
  if (p) return { ecosystem: 'PyPI', name: p[1].toLowerCase(), version: p[2] };
  return null;
}

function registryUrl(d: Dep): string {
  return d.ecosystem === 'npm' ? `https://registry.npmjs.org/${d.name}/${d.version}` : `https://pypi.org/pypi/${d.name}/${d.version}/json`;
}

/** Every MCP brick must resolve to the exact pinned version on its registry, so what the card shows is what gets installed. */
export const bricksCheck: Check = {
  id: 'bricks',
  network: true,
  async run({ manifest }, ctx): Promise<CheckResult> {
    if (!isV2(manifest)) return { findings: [], skipped: 'hosted agent, no bricks' };
    const bricks = manifest.spec.bricks.mcp;
    if (bricks.length === 0) return { findings: [] };
    const findings: Finding[] = [];
    const caps: { grade: 'AA'; reason: string }[] = [];
    const results = await Promise.all(
      bricks.map(async (b) => {
        const dep = brickDep(b.package);
        if (!dep) return { b, status: 'invalid' as const };
        try {
          const res = await withTimeout(ctx.fetch(registryUrl(dep), { headers: { accept: 'application/json' } }), ctx.callTimeoutMs, b.name);
          return { b, status: res.status === 200 ? ('ok' as const) : res.status === 404 ? ('missing' as const) : ('error' as const), note: `${res.status}` };
        } catch (e) {
          return { b, status: 'error' as const, note: (e as Error).message };
        }
      }),
    );
    for (const r of results) {
      if (r.status === 'ok') continue;
      if (r.status === 'invalid') findings.push({ check: 'bricks', severity: 'high', message: `brick ${r.b.name}: ${r.b.package} is not a pinned npm or PyPI reference` });
      else if (r.status === 'missing') findings.push({ check: 'bricks', severity: 'high', message: `brick ${r.b.name}: ${r.b.package} does not exist on its registry`, hint: 'Pin a version that is actually published.' });
      else {
        findings.push({ check: 'bricks', severity: 'low', message: `brick ${r.b.name}: could not be resolved (${r.note})` });
        caps.push({ grade: 'AA', reason: `brick ${r.b.name} could not be resolved` });
      }
    }
    return { findings, caps };
  },
};
