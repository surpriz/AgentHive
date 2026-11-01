import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { CATEGORIES, FRAMEWORKS, TRANSPORTS } from '../src/types';

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
export const manifestSchema = z.object({
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

export type Manifest = z.infer<typeof manifestSchema>;

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
  const res = manifestSchema.safeParse(doc);
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
