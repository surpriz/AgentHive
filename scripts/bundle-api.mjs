// Bundles the Vercel function into one ESM file so the platform has nothing to transpile or resolve.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('api/_bundle', { recursive: true });
await build({
  entryPoints: ['server/vercel.ts'],
  outfile: 'api/_bundle/index.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  // PGlite is dev/test only; the import is behind a runtime check and its module name is a variable.
  external: ['@electric-sql/pglite'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
});
console.log('api/_bundle/index.mjs bundled');
