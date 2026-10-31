// Vercel function entry. The real code is bundled from server/vercel.ts into
// api/_bundle/index.mjs by scripts/bundle-api.mjs during `pnpm build`; this
// file only exists so the platform detects the function before building.
// @ts-nocheck
export { default } from './_bundle/index.mjs';
