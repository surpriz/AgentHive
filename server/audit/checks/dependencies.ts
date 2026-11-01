import type { Check, CheckResult, Finding } from '../types';
import { withTimeout } from '../util';
import { readCapped } from '../net';
import { parse as parseToml } from 'smol-toml';

export interface Dep {
  ecosystem: 'npm' | 'PyPI';
  name: string;
  version: string;
}

const EXACT = /^v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;

/** What a parser could and could not turn into a queryable (name, exact version) pair. */
export interface ParsedDeps {
  deps: Dep[];
  /** Declared dependencies without an exact version: not queried, so they cap the grade. */
  unpinned: number;
  parseError?: string;
}

/** package.json dependencies with exact versions only (ranges cannot be queried reliably). */
export function depsFromPackageJson(text: string): ParsedDeps {
  let pkg: { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(text) as typeof pkg;
  } catch (e) {
    return { deps: [], unpinned: 0, parseError: `package.json: ${(e as Error).message}` };
  }
  const out: ParsedDeps = { deps: [], unpinned: 0 };
  for (const [name, spec] of Object.entries({ ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) })) {
    const m = EXACT.exec(String(spec).trim());
    if (m) out.deps.push({ ecosystem: 'npm', name, version: m[1] });
    else out.unpinned++;
  }
  return out;
}

/** requirements.txt: `name==1.2.3` is queryable, any other requirement line counts as unpinned. */
export function depsFromRequirements(text: string): ParsedDeps {
  const out: ParsedDeps = { deps: [], unpinned: 0 };
  for (const raw of text.split('\n')) {
    const line = raw.split('#')[0].trim();
    if (!line || line.startsWith('-')) continue; // blank, -r includes, --flags
    const m = /^([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*==\s*([0-9][0-9A-Za-z.+-]*)\s*$/.exec(line);
    if (m) out.deps.push({ ecosystem: 'PyPI', name: m[1].toLowerCase(), version: m[2] });
    else out.unpinned++;
  }
  return out;
}

const PEP508 = /^([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*(.*)$/;

/** pyproject.toml via a real TOML parser: [project].dependencies (PEP 621) and [tool.poetry.dependencies]. */
export function depsFromPyproject(text: string): ParsedDeps {
  let doc: Record<string, unknown>;
  try {
    doc = parseToml(text) as Record<string, unknown>;
  } catch (e) {
    return { deps: [], unpinned: 0, parseError: `pyproject.toml: ${(e as Error).message}` };
  }
  const out: ParsedDeps = { deps: [], unpinned: 0 };
  const project = doc.project as { dependencies?: unknown } | undefined;
  for (const item of Array.isArray(project?.dependencies) ? project.dependencies : []) {
    const m = typeof item === 'string' ? PEP508.exec(item.trim()) : null;
    const pin = m ? /^==\s*([0-9][0-9A-Za-z.+-]*)\s*(?:;.*)?$/.exec(m[2]) : null;
    if (m && pin) out.deps.push({ ecosystem: 'PyPI', name: m[1].toLowerCase(), version: pin[1] });
    else out.unpinned++;
  }
  const poetry = ((doc.tool as Record<string, unknown> | undefined)?.poetry as { dependencies?: Record<string, unknown> } | undefined)?.dependencies ?? {};
  for (const [name, spec] of Object.entries(poetry)) {
    if (name === 'python') continue;
    const v = typeof spec === 'string' ? spec : typeof spec === 'object' && spec && typeof (spec as { version?: unknown }).version === 'string' ? (spec as { version: string }).version : '';
    const m = EXACT.exec(v.trim());
    if (m) out.deps.push({ ecosystem: 'PyPI', name: name.toLowerCase(), version: m[1] });
    else out.unpinned++;
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
export const MAX_MANIFEST_FILE_BYTES = 512 * 1024;
/** Git refs and repo paths we are willing to interpolate into a raw.githubusercontent.com URL. */
export const REF_RE = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._\/-]{0,127}$/;
export const PATH_RE = /^(?!.*\.\.)[A-Za-z0-9._\/-]{0,200}$/;

const UNVERIFIED = { grade: 'AA' as const, reason: 'dependencies not checked' };

export const dependenciesCheck: Check = {
  id: 'dependencies',
  network: true,
  async run(manifest, ctx): Promise<CheckResult> {
    const source = manifest.spec.source;
    if (!source) return { findings: [], skipped: 'no source declared', caps: [{ grade: 'AA', reason: 'source repository not declared, dependencies not checked' }] };
    const gh = parseGithubSource(source.repo);
    if (!gh) return { findings: [{ check: 'dependencies', severity: 'low', message: 'source host not supported yet (GitHub only)' }], caps: [UNVERIFIED] };

    const ref = source.ref ?? 'HEAD';
    const dir = (source.path ?? '.').replace(/^\.?\/?/, '').replace(/\/$/, '');
    if (!REF_RE.test(ref) || !PATH_RE.test(dir)) return { findings: [{ check: 'dependencies', severity: 'medium', message: 'source.ref or source.path is not a plain git ref / path' }], caps: [UNVERIFIED] };
    const base = `https://raw.githubusercontent.com/${gh.owner}/${gh.name}/${encodeURIComponent(ref)}/${dir ? `${dir}/` : ''}`;
    const files: { file: string; parse: (t: string) => ParsedDeps }[] = [
      { file: 'package.json', parse: depsFromPackageJson },
      { file: 'requirements.txt', parse: depsFromRequirements },
      { file: 'pyproject.toml', parse: depsFromPyproject },
    ];
    // The three manifests are fetched concurrently so this check costs at most two round trips.
    const fetched = await Promise.all(
      files.map(async ({ file, parse }) => {
        try {
          const res = await withTimeout(ctx.fetch(base + file, { headers: { accept: 'text/plain' } }), ctx.callTimeoutMs, file);
          if (res.status !== 200) return { file, parsed: null as ParsedDeps | null, error: null as string | null };
          return { file, parsed: parse(await readCapped(res, MAX_MANIFEST_FILE_BYTES)), error: null };
        } catch (e) {
          return { file, parsed: null, error: (e as Error).message };
        }
      }),
    );
    const failed = fetched.find((f) => f.error);
    if (failed) return { findings: [{ check: 'dependencies', severity: 'low', message: `could not read ${failed.file}: ${failed.error}` }], skipped: `could not fetch ${failed.file}`, caps: [UNVERIFIED] };
    const parsedAll = fetched.filter((f): f is { file: string; parsed: ParsedDeps; error: null } => f.parsed !== null);
    if (parsedAll.length === 0) return { findings: [{ check: 'dependencies', severity: 'low', message: 'no dependency manifest found in the source repository' }], caps: [UNVERIFIED] };

    const findings: Finding[] = [];
    const caps: { grade: 'AA'; reason: string }[] = [];
    const deps = parsedAll.flatMap((f) => f.parsed.deps);
    const unpinned = parsedAll.reduce((n, f) => n + f.parsed.unpinned, 0);
    const parseErrors = parsedAll.map((f) => f.parsed.parseError).filter(Boolean) as string[];
    for (const err of parseErrors) findings.push({ check: 'dependencies', severity: 'low', message: `could not parse ${err}` });
    if (parseErrors.length) caps.push({ grade: 'AA', reason: 'a dependency manifest could not be parsed' });
    if (unpinned > 0) {
      findings.push({ check: 'dependencies', severity: 'low', message: `${unpinned} declared dependenc${unpinned === 1 ? 'y is' : 'ies are'} not pinned to an exact version and could not be checked`, hint: 'Pin exact versions (or commit a lockfile-derived manifest) so every dependency is queried.' });
      caps.push({ grade: 'AA', reason: `${unpinned} unpinned dependencies not checked` });
    }
    const unique = deps.slice(0, MAX_DEPS);
    if (unique.length === 0) return { findings: [...findings, { check: 'dependencies', severity: 'low', message: 'no pinned dependencies to check' }], caps: [UNVERIFIED] };
    if (deps.length > MAX_DEPS) {
      findings.push({ check: 'dependencies', severity: 'low', message: `${deps.length - MAX_DEPS} dependencies not checked (limit ${MAX_DEPS})` });
      caps.push({ grade: 'AA', reason: `${deps.length - MAX_DEPS} dependencies beyond the first ${MAX_DEPS} were not checked` });
    }

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
    return { findings, caps };
  },
};
