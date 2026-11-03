import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { CATEGORIES, FRAMEWORKS, GOALS, TRANSPORTS, type Category, type Goal } from '../src/types';

export const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
export const MAX_MANIFEST_BYTES = 256 * 1024;

export const MAX_SCHEMA_BYTES = 32 * 1024;
export const MAX_SCHEMA_DEPTH = 12;

const shortList = z.array(z.string().trim().min(1).max(64)).max(32).default([]);

function depthOf(v: unknown, d = 0): number {
  if (typeof v !== 'object' || v === null) return d;
  let max = d;
  for (const x of Object.values(v)) max = Math.max(max, depthOf(x, d + 1));
  return max;
}

/** Inline JSON schema: bounded in bytes and nesting so a manifest cannot smuggle megabytes into a jsonb column. */
const jsonSchema = z
  .record(z.string(), z.unknown())
  .refine((v) => JSON.stringify(v).length <= MAX_SCHEMA_BYTES, `schema larger than ${MAX_SCHEMA_BYTES / 1024} KiB`)
  .refine((v) => depthOf(v) <= MAX_SCHEMA_DEPTH, `schema nested deeper than ${MAX_SCHEMA_DEPTH} levels`)
  .default({});

/**
 * What a publisher may send. Anything else in the document (security,
 * benchmark, registry, author) is dropped: the registry owns those.
 */
export const manifestV1Schema = z.object({
  apiVersion: z.enum(['agenthive.sh/v1', 'agenthive.sh/v0']),
  kind: z.literal('Agent').default('Agent'),
  metadata: z.object({
    name: z.string().min(3).max(48).regex(NAME_RE, 'kebab-case: lowercase letters, digits and single dashes'),
    version: z.string().regex(SEMVER_RE, 'semver, e.g. 1.2.0'),
    license: z.string().trim().min(1).max(64).default('UNLICENSED'),
    category: z.enum(CATEGORIES),
    value: z.string().trim().min(10).max(160),
    tagline: z.string().trim().min(10).max(240),
    tags: shortList,
  }),
  spec: z.object({
    framework: z.enum(FRAMEWORKS),
    model: z.string().trim().min(1).max(64).default('unspecified'),
    transport: z.enum(TRANSPORTS).default('a2a/http+json'),
    endpoint: z.url({ protocol: /^https$/, hostname: z.regexes.domain }).optional(),
    capabilities: shortList,
    tools: shortList,
    io: z.object({ input: jsonSchema, output: jsonSchema }).default({ input: {}, output: {} }),
    /** What the agent touches at runtime. Optional, but AA and AAA require it. */
    permissions: z
      .object({
        network: z.array(z.string().trim().min(1).max(253)).max(64).default([]),
        filesystem: z.enum(['none', 'read', 'write']).default('none'),
        shell: z.boolean().default(false),
        env: z.array(z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/, 'env names are UPPER_SNAKE')).max(32).default([]),
      })
      .optional(),
    /** Author-declared test cases the registry runs through the gateway. Declared, but never self-graded. */
    tests: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          input: z.record(z.string(), z.unknown()),
          expect: z
            .object({
              status: z.number().int().min(100).max(599).optional(),
              contains: z.string().min(1).max(500).optional(),
              jsonPath: z.object({ path: z.string().min(1).max(200), min: z.number().optional(), equals: z.unknown().optional() }).optional(),
              maxLatencyMs: z.number().int().min(100).max(10_000).optional(),
            })
            .default({}),
        }),
      )
      .max(10)
      .default([]),
    /** Public repository holding the agent's code; lets the audit check dependencies. */
    source: z
      .object({
        repo: z.url({ protocol: /^https$/, hostname: z.regexes.domain }),
        ref: z.string().trim().min(1).max(128).optional(),
        path: z.string().trim().max(200).optional(),
      })
      .optional(),
  }),
  readme: z.string().max(20_000).default(''),
  useCases: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
});

export type ManifestV1 = z.infer<typeof manifestV1Schema>;

// ---- v2: declarative packages ------------------------------------------------

export const SETTING_NAME_RE = /^[a-z][a-z0-9_]{0,31}$/;
export const ENV_NAME_RE = /^[A-Z][A-Z0-9_]*$/;
/** `npm:@scope/name@1.2.3` or `pypi:name==1.2.3`. Exact versions only: the checks resolve and query them. */
export const NPM_PACKAGE_RE = /^npm:((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
export const PYPI_PACKAGE_RE = /^pypi:([A-Za-z0-9][A-Za-z0-9._-]*)==(\d+(?:\.\d+)*(?:(?:a|b|rc)\d+)?(?:\.post\d+)?(?:\.dev\d+)?)$/;

/** Licences under which a package may be forked and republished. */
export const FORKABLE_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC-BY-4.0', 'CC0-1.0', 'ISC', 'MPL-2.0'] as const;

const settingSchema = z
  .object({
    name: z.string().regex(SETTING_NAME_RE, 'snake_case, starts with a letter'),
    type: z.enum(['string', 'integer', 'number', 'boolean', 'enum']),
    description: z.string().trim().max(200).optional(),
    default: z.union([z.string().max(500), z.number(), z.boolean()]).optional(),
    values: z.array(z.string().trim().min(1).max(64)).min(1).max(32).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((s) => s.type !== 'enum' || (s.values && s.values.length > 0), { message: 'an enum setting needs values', path: ['values'] })
  .refine((s) => s.type !== 'enum' || s.default === undefined || (typeof s.default === 'string' && s.values!.includes(s.default)), { message: 'default is not one of the values', path: ['default'] })
  .refine((s) => (s.type !== 'integer' && s.type !== 'number') || s.default === undefined || typeof s.default === 'number', { message: 'default must be a number', path: ['default'] })
  .refine((s) => s.type !== 'boolean' || s.default === undefined || typeof s.default === 'boolean', { message: 'default must be true or false', path: ['default'] })
  .refine((s) => s.type !== 'string' || s.default === undefined || typeof s.default === 'string', { message: 'default must be a string', path: ['default'] });

/**
 * An argument the host passes to an MCP server. The card shows args in full, but a
 * reader will not spot `-e <code>` or `/etc/passwd` in a long line, so the shape is
 * restricted: a relative path, a plain word, or a flag with a plain value. No absolute
 * or home paths, no parent segments, no URLs, no shell characters, and the usual
 * eval/exec flags are refused outright.
 */
const ARG_RE = /^(?:\.|\.\/[A-Za-z0-9._\-/]+|[A-Za-z0-9][A-Za-z0-9._\-/:,@]*|--?[A-Za-z][A-Za-z0-9-]*(?:=[A-Za-z0-9._\-/:,@]+)?)$/;
const EVAL_FLAGS = new Set(['-e', '--eval', '-c', '--command', '-p', '--print', '-r', '--require', '--import', '--exec', '--eval-file', '-x']);
export function safeArg(a: string): boolean {
  if (!ARG_RE.test(a) || a.includes('..') || a.includes('://') || a.startsWith('~')) return false;
  return !EVAL_FLAGS.has(a.split('=')[0]);
}
const HOST_RE = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const mcpBrickSchema = z.object({
  name: z.string().min(2).max(48).regex(NAME_RE, 'kebab-case'),
  package: z.string().max(200).refine((p) => NPM_PACKAGE_RE.test(p) || PYPI_PACKAGE_RE.test(p), 'npm:name@x.y.z or pypi:name==x.y.z, exact version'),
  /** Extra arguments the host passes to the server, e.g. a root directory for a filesystem server. */
  args: z.array(z.string().max(200).refine(safeArg, 'args are relative paths, words or simple flags: no absolute paths, parent segments, URLs or eval flags')).max(8).default([]),
  env: z.array(z.string().regex(ENV_NAME_RE, 'env names are UPPER_SNAKE')).max(16).default([]),
  permissions: z.object({
    network: z.array(z.string().trim().min(1).max(253).regex(HOST_RE, 'a hostname like api.github.com or *.example.com')).max(32).default([]),
    filesystem: z.enum(['none', 'read', 'write']).default('none'),
  }),
});

export const manifestV2Schema = z.object({
  apiVersion: z.literal('agenthive.sh/v2'),
  kind: z.literal('Agent').default('Agent'),
  metadata: z.object({
    name: z.string().min(3).max(48).regex(NAME_RE, 'kebab-case: lowercase letters, digits and single dashes'),
    version: z.string().regex(SEMVER_RE, 'semver, e.g. 1.2.0'),
    license: z.string().trim().min(1).max(64).default('UNLICENSED'),
    goal: z.enum(GOALS),
    value: z.string().trim().min(10).max(160),
    tagline: z.string().trim().min(10).max(240),
    tags: shortList,
  }),
  spec: z.object({
    model: z
      .object({
        requires: z.object({ toolCalling: z.boolean().optional(), minContextTokens: z.number().int().min(1000).max(10_000_000).optional() }).default({}),
        recommended: z.array(z.string().trim().min(1).max(64)).max(8).default([]),
      })
      .default({ requires: {}, recommended: [] }),
    settings: z.array(settingSchema).max(16).default([]),
    bricks: z
      .object({
        skills: z.array(z.string().min(2).max(48).regex(NAME_RE, 'kebab-case')).max(16).default([]),
        mcp: z.array(mcpBrickSchema).max(16).default([]),
      })
      .default({ skills: [], mcp: [] }),
    io: z.object({ input: jsonSchema, output: jsonSchema }).default({ input: {}, output: {} }),
    tests: manifestV1Schema.shape.spec.shape.tests,
  }),
  readme: z.string().max(20_000).default(''),
  useCases: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
});

export type ManifestV2 = z.infer<typeof manifestV2Schema>;
export type Manifest = ManifestV1 | ManifestV2;

export function isV2(m: Manifest): m is ManifestV2 {
  return m.apiVersion === 'agenthive.sh/v2';
}

/** The DB and the catalog keep one category column; goals map onto it so filters and the leaderboard keep working. */
export const GOAL_CATEGORY: Record<Goal, Category> = {
  'code-audit': 'Security & Audit',
  'code-review': 'Code & Refactoring',
  'data-analysis': 'Data & Analytics',
  'financial-analysis': 'Finance',
  growth: 'Marketing',
  devops: 'DevOps',
  research: 'Data & Analytics',
  writing: 'Marketing',
};

// ---- package files -----------------------------------------------------------

export const MAX_PACKAGE_FILE_BYTES = 256 * 1024;
export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
export const MAX_PACKAGE_FILES = 64;
/** The only paths a package may contain. Text, under known folders, never executable. */
export const PACKAGE_PATH_RE = /^(prompt\.md|README\.md|skills\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:SKILL\.md|[A-Za-z0-9][A-Za-z0-9._-]*\.md)|examples\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:json|md|txt|yaml))$/;
const PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

export type PackageFiles = Record<string, string>;

/** Validates the files that come with a v2 manifest. Pure, never throws. */
export function validatePackageFiles(manifest: ManifestV2, files: unknown): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  if (typeof files !== 'object' || files === null || Array.isArray(files)) return [{ path: 'files', message: 'files must be an object of path → text' }];
  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.length > MAX_PACKAGE_FILES) return [{ path: 'files', message: `more than ${MAX_PACKAGE_FILES} files` }];
  let total = 0;
  for (const [path, content] of entries) {
    if (!PACKAGE_PATH_RE.test(path)) {
      issues.push({ path: `files.${path}`, message: 'not an allowed package path (prompt.md, README.md, skills/<name>/*.md, examples/*.json|md|txt|yaml)' });
      continue;
    }
    if (typeof content !== 'string') {
      issues.push({ path: `files.${path}`, message: 'file content must be text' });
      continue;
    }
    if (content.includes('\0')) issues.push({ path: `files.${path}`, message: 'contains NUL characters' });
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_PACKAGE_FILE_BYTES) issues.push({ path: `files.${path}`, message: `larger than ${MAX_PACKAGE_FILE_BYTES / 1024} KiB` });
    total += bytes;
    if (path.startsWith('examples/') && path.endsWith('.json')) {
      try {
        JSON.parse(content);
      } catch {
        issues.push({ path: `files.${path}`, message: 'not valid JSON' });
      }
    }
  }
  if (total > MAX_PACKAGE_BYTES) issues.push({ path: 'files', message: `package larger than ${MAX_PACKAGE_BYTES / 1024 / 1024} MiB` });
  const f = files as Record<string, unknown>;
  const prompt = f['prompt.md'];
  if (typeof prompt !== 'string' || prompt.trim().length < 50) issues.push({ path: 'files.prompt.md', message: 'prompt.md is required and must be at least 50 characters' });
  for (const skill of manifest.spec.bricks.skills) {
    if (typeof f[`skills/${skill}/SKILL.md`] !== 'string') issues.push({ path: `spec.bricks.skills`, message: `skill "${skill}" has no skills/${skill}/SKILL.md in the package` });
  }
  for (const path of Object.keys(f)) {
    const m = /^skills\/([a-z0-9-]+)\//.exec(path);
    if (m && !manifest.spec.bricks.skills.includes(m[1])) issues.push({ path: `files.${path}`, message: `skill "${m[1]}" is in the package but not declared in spec.bricks.skills` });
  }
  if (typeof prompt === 'string') {
    const declared = new Set(manifest.spec.settings.map((s) => s.name));
    const unknown = new Set<string>();
    for (const m of prompt.matchAll(PLACEHOLDER_RE)) if (!declared.has(m[1])) unknown.add(m[1]);
    if (unknown.size) issues.push({ path: 'files.prompt.md', message: `placeholders without a setting: ${[...unknown].slice(0, 5).map((n) => `{{${n}}}`).join(', ')}` });
  }
  return issues;
}

/** Substitutes {{setting}} placeholders with the given values (defaults when absent). Unknown placeholders stay as they are. */
export function renderPrompt(prompt: string, settings: ManifestV2['spec']['settings'], values: Record<string, unknown> = {}): string {
  const map = new Map<string, string>();
  for (const s of settings) {
    const v = values[s.name] ?? s.default;
    if (v !== undefined) map.set(s.name, String(v));
  }
  return prompt.replace(PLACEHOLDER_RE, (whole, name: string) => (map.has(name) ? map.get(name)! : whole));
}

export interface ManifestIssue {
  path: string;
  message: string;
}

export type ParseResult = { ok: true; manifest: Manifest } | { ok: false; issues: ManifestIssue[] };

/** Accepts a YAML or JSON string, or an already-parsed object. Never throws. */
export function parseManifest(input: string | unknown): ParseResult {
  let doc: unknown = input;
  if (typeof input === 'string') {
    if (Buffer.byteLength(input, 'utf8') > MAX_MANIFEST_BYTES) return { ok: false, issues: [{ path: '', message: `manifest larger than ${MAX_MANIFEST_BYTES / 1024} KiB` }] };
    try {
      doc = input.trimStart().startsWith('{') ? JSON.parse(input) : parseYaml(input, { maxAliasCount: 50, uniqueKeys: true });
    } catch (e) {
      return { ok: false, issues: [{ path: '', message: `not valid YAML or JSON: ${(e as Error).message}` }] };
    }
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return { ok: false, issues: [{ path: '', message: 'manifest must be a mapping' }] };
  // Postgres jsonb cannot store NUL; refuse it up front rather than fail at insert time.
  if (JSON.stringify(doc).includes('\\u0000')) return { ok: false, issues: [{ path: '', message: 'manifest contains NUL characters' }] };
  const version = (doc as { apiVersion?: unknown }).apiVersion;
  const res = version === 'agenthive.sh/v2' ? manifestV2Schema.safeParse(doc) : manifestV1Schema.safeParse(doc);
  if (!res.success) {
    return { ok: false, issues: res.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })) };
  }
  return { ok: true, manifest: res.data };
}

/** Semver precedence, ignoring build metadata. Returns <0, 0, >0. */
export function compareSemver(a: string, b: string): number {
  const [ca, pa] = a.split('-', 2);
  const [cb, pb] = b.split('-', 2);
  const na = ca.split('.').map(Number);
  const nb = cb.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (na[i] !== nb[i]) return na[i] - nb[i];
  if (pa === pb) return 0;
  if (pa === undefined) return 1; // release > pre-release
  if (pb === undefined) return -1;
  return pa < pb ? -1 : 1;
}
