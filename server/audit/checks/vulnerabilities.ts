import type { Check, CheckResult } from '../types';
import { isV2 } from '../../manifest';
import { osvFindings, type Dep } from './dependencies';
import { brickDep } from './bricks';

/** Known vulnerabilities of the pinned MCP bricks, from OSV. */
export const vulnerabilitiesCheck: Check = {
  id: 'vulnerabilities',
  network: true,
  async run({ manifest }, ctx): Promise<CheckResult> {
    if (!isV2(manifest)) return { findings: [], skipped: 'hosted agent, see the dependencies check' };
    const deps = manifest.spec.bricks.mcp.map((b) => brickDep(b.package)).filter((d): d is Dep => d !== null);
    if (deps.length === 0) return { findings: [] };
    const osv = await osvFindings(deps, ctx, 'vulnerabilities');
    if ('skipped' in osv) return { findings: [], skipped: osv.skipped, caps: [{ grade: 'AA', reason: 'bricks not checked for known vulnerabilities' }] };
    return { findings: osv.findings };
  },
};
