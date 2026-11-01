import type { Check, CheckResult, Finding } from '../types';
import { withTimeout } from '../util';

export interface Dep {
  ecosystem: 'npm' | 'PyPI';
  name: string;
  version: string;
}

const EXACT = /^v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;

/** package.json dependencies with exact versions only (ranges cannot be queried reliably). */
export function depsFromPackageJson(text: string): Dep[] {
  let pkg: { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(text) as typeof pkg;
  } catch {
    return [];
  }
  const out: Dep[] = [];
  for (const [name, spec] of Object.entries({ ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) })) {
    const m = EXACT.exec(String(spec).trim());
    if (m) out.push({ ecosystem: 'npm', name, version: m[1] });
  }
  return out;
}

/** requirements.txt pins: `name==1.2.3`, comments and extras ignored. */
export function depsFromRequirements(text: string): Dep[] {
  const out: Dep[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.split('#')[0].trim();
    const m = /^([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*==\s*([0-9][0-9A-Za-z.+-]*)/.exec(line);
    if (m) out.push({ ecosystem: 'PyPI', name: m[1].toLowerCase(), version: m[2] });
  }
  return out;
}

/** pyproject: `[project] dependencies = ["name==1.2.3", ...]` pins only. */
export function depsFromPyproject(text: string): Dep[] {
  const block = /dependencies\s*=\s*\[([\s\S]*?)\]/.exec(text)?.[1] ?? '';
  const out: Dep[] = [];
  for (const m of block.matchAll(/["']([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*==\s*([0-9][0-9A-Za-z.+-]*)["']/g)) {
    out.push({ ecosystem: 'PyPI', name: m[1].toLowerCase(), version: m[2] });
  }
  return out;
}

export function parseGithubSource(repo: string): { owner: string; name: string } | null {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(repo);
  return m ? { owner: m[1], name: m[2] } : null;
}

interface OsvVuln {
  id: string;
  summary?: string;
  severity?: { type: string; score: string }[];
  database_specific?: { severity?: string };
}

function severityOf(v: OsvVuln): 'high' | 'medium' {
  const label = v.database_specific?.severity?.toUpperCase();
  if (label === 'CRITICAL' || label === 'HIGH') return 'high';
  const cvss = v.severity?.find((s) => s.type.startsWith('CVSS'))?.score ?? '';
  // CVSS vector strings do not carry the numeric score; treat unlabeled as medium.
  return /\/AV:N\/AC:L\/PR:N\/UI:N/.test(cvss) ? 'high' : 'medium';
}

export const MAX_DEPS = 100;

export const dependenciesCheck: Check = {
  id: 'dependencies',
  network: true,
  async run(manifest, ctx): Promise<CheckResult> {
    const source = manifest.spec.source;
    if (!source) return { findings: [], skipped: 'no source declared', caps: [{ grade: 'AA', reason: 'source repository not declared, dependencies not checked' }] };
    const gh = parseGithubSource(source.repo);
    if (!gh) return { findings: [{ check: 'dependencies', severity: 'low', message: 'source host not supported yet (GitHub only)' }], caps: [{ grade: 'AA', reason: 'dependencies not checked' }] };

    const ref = source.ref ?? 'HEAD';
    const dir = (source.path ?? '.').replace(/^\.?\/?/, '').replace(/\/$/, '');
    const base = `https://raw.githubusercontent.com/${gh.owner}/${gh.name}/${encodeURIComponent(ref)}/${dir ? `${dir}/` : ''}`;
    const files: { file: string; parse: (t: string) => Dep[] }[] = [
      { file: 'package.json', parse: depsFromPackageJson },
      { file: 'requirements.txt', parse: depsFromRequirements },
      { file: 'pyproject.toml', parse: depsFromPyproject },
    ];
    const deps: Dep[] = [];
    let found = 0;
    for (const { file, parse } of files) {
      try {
        const res = await withTimeout(ctx.fetch(base + file, { headers: { accept: 'text/plain' } }), ctx.callTimeoutMs, file);
        if (res.status === 200) {
          found++;
          deps.push(...parse(await res.text()));
        }
      } catch (e) {
        return { findings: [], skipped: `could not fetch ${file}: ${(e as Error).message}`, caps: [{ grade: 'AA', reason: 'dependencies not checked' }] };
      }
    }
    if (found === 0) return { findings: [{ check: 'dependencies', severity: 'low', message: 'no dependency manifest found in the source repository' }], caps: [{ grade: 'AA', reason: 'dependencies not checked' }] };
    const findings: Finding[] = [];
    const unique = deps.slice(0, MAX_DEPS);
    if (unique.length === 0) return { findings: [{ check: 'dependencies', severity: 'low', message: 'no pinned dependencies to check', hint: 'Pin exact versions or ship a lockfile-derived manifest.' }] };

    let results: { vulns?: OsvVuln[] }[];
    try {
      const res = await withTimeout(
        ctx.fetch('https://api.osv.dev/v1/querybatch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ queries: unique.map((d) => ({ package: { name: d.name, ecosystem: d.ecosystem }, version: d.version })) }),
        }),
        ctx.callTimeoutMs,
        'osv',
      );
      if (!res.ok) throw new Error(`osv ${res.status}`);
      results = ((await res.json()) as { results: { vulns?: OsvVuln[] }[] }).results;
    } catch (e) {
      return { findings: [], skipped: `vulnerability database unavailable: ${(e as Error).message}`, caps: [{ grade: 'AA', reason: 'dependencies not checked' }] };
    }
    results.forEach((r, i) => {
      for (const v of r.vulns ?? []) {
        const d = unique[i];
        findings.push({ check: 'dependencies', severity: severityOf(v), message: `${d.name}@${d.version}: ${v.id}${v.summary ? ` — ${v.summary}` : ''}`, hint: 'Upgrade the dependency.' });
      }
    });
    return { findings };
  },
};
