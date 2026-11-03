---
name: dependency-hygiene
description: Reference for reading npm, pnpm, yarn and Python manifests and lockfiles, spotting unpinned or abandoned packages, typosquat names, install scripts and risky sources, and writing a minimal upgrade plan.
---

# Dependency hygiene

## Reading the files

- `package.json`: `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`,
  `overrides` / `resolutions` (pins forced on transitive packages, worth reading: they often hide a
  past incident), `scripts.preinstall|install|postinstall|prepare`, `packageManager`, `engines`.
- `package-lock.json` v2/v3: `packages["node_modules/<name>"]` has `version`, `resolved`,
  `integrity`, `hasInstallScript`, `dev`, `optional`. A `resolved` that is not the public registry
  host is a finding (private mirror is fine if consistent; a random host is not).
- `pnpm-lock.yaml`: `packages:` entries keyed `/<name>@<version>` or `<name>@<version>` with
  `resolution`, `requiresBuild`, `dev`. `onlyBuiltDependencies` in `pnpm-workspace.yaml` or
  `.npmrc` is a good sign: the user already gates install scripts.
- `yarn.lock` v1: blocks `"<name>@<range>":` with `version` and `resolved`. Berry: `"<name>@npm:..."`
  with `checksum`. Yarn does not record install scripts; infer from the package.
- `requirements.txt`: `name==1.2.3` is pinned, `name>=1.2` or bare `name` is not, `-e git+...` and
  URL lines are sources to flag, `--index-url` and `--extra-index-url` enable dependency confusion.
- `pyproject.toml`: `[project].dependencies` ranges, `[tool.poetry.dependencies]`, `[tool.uv]`.
  `poetry.lock` and `uv.lock` pin everything; `requirements.txt` generated from them is fine.
- `.npmrc`: `ignore-scripts=true` (good), `registry=` (check the host), `_authToken` (a secret).

## Unpinned and sources

Finding: `*`, `latest`, `next`, `>=x`, `x`, empty string, `github:user/repo` without a commit hash,
`git+https://...` without `#<sha>`, `https://.../package.tgz`, `file:` outside the repo,
`link:` to a path that is not in the repo, `npm:other-name@...` aliases (read what they alias).
Caret and tilde ranges are normal when a lockfile is committed; without a lockfile they mean every
install may pull a different version.

## Install scripts

Expected (native or engine downloads): `sharp`, `esbuild`, `@swc/core`, `@next/swc-*`, `bcrypt`,
`argon2`, `better-sqlite3`, `sqlite3`, `prisma`, `@prisma/engines`, `puppeteer`, `playwright`,
`canvas`, `node-sass`, `sass-embedded`, `fsevents`, `core-js` (prints a banner), `husky` (prepare),
`cypress`, `electron`, `@sentry/cli`, `protobufjs`, `msw` (init).

Surprising: any package whose name suggests a pure JS utility (string, date, colour, validation,
logging), anything added in the last few commits, anything with a version 0.x or 1.0.0 published
recently. Read the script if the package is vendored or the user can show it; otherwise report the
flag and tell the user to inspect `node_modules/<name>/package.json` scripts before trusting it.

Critical patterns in the root package.json scripts: a download (curl or wget) piped straight into a shell,
`node -e "..."` with a URL, `npx <unpinned>` in postinstall, writing to `~/.ssh`, `~/.npmrc`, or
reading `process.env` and sending it anywhere.

## Typosquat heuristics

Compare each package name to this list of popular names: `react`, `react-dom`, `next`, `express`,
`lodash`, `axios`, `moment`, `dayjs`, `zod`, `prisma`, `@prisma/client`, `@supabase/supabase-js`,
`stripe`, `jsonwebtoken`, `jose`, `bcrypt`, `bcryptjs`, `uuid`, `dotenv`, `cors`, `helmet`,
`mongoose`, `pg`, `mysql2`, `redis`, `ioredis`, `socket.io`, `ws`, `node-fetch`, `cross-env`,
`eslint`, `prettier`, `typescript`, `tailwindcss`, `vite`, `webpack`, `jest`, `vitest`, `chalk`,
`commander`, `yargs`, `inquirer`, `nodemon`, `concurrently`, `request`, `colors`, `faker`, `requests`,
`numpy`, `pandas`, `django`, `flask`, `fastapi`, `boto3`, `pillow`, `cryptography`, `pyyaml`.

Flag a name when: Levenshtein distance 1 or 2 from a popular name and not the popular name itself
(`lodahs`, `expresss`, `reakt`); a popular name plus a suffix or prefix such as `-js`, `js-`, `-node`,
`node-`, `-utils`, `-helper`, `2`, `.js` when the real package does not use it; a scope swap
(`@types/node` is real, `types-node` is not); a scope that looks official but is not
(`@supabase-js/`, `@stripe-sdk/`); mixed-up separators (`socket-io`, `socketio`); Python names with
`-` and `_` variants or capital letters. Deprecated names that still exist (`request`, `colors`,
`faker` after their incidents, `node-uuid`, `querystring`, `crypto` from npm) are their own finding.

## Abandonment and known-risky

- Abandoned: no release or commit for longer than the threshold, README says "unmaintained" or
  "looking for maintainers", a successor is named (`moment` recommends alternatives, `request` is
  deprecated, `node-sass` points at `sass`, `tslint` to `eslint`). Risk follows responsibility: an
  abandoned JWT, session, crypto, ORM, HTTP server or upload library is high; an abandoned colour
  helper is low.
- Known-risky patterns: packages that had protestware or hijacked releases (`colors`, `faker`,
  `event-stream`, `ua-parser-js`, `coa`, `rc`, `node-ipc` and their versions), packages that phone
  home with telemetry on install, packages whose repository field points to a different name than the
  package, packages whose name equals the app's own name or an internal scope (dependency confusion).
- Duplicates: two or more of `axios`, `node-fetch`, `got`, `ky`, `undici` together; `moment` with
  `dayjs` or `date-fns`; `lodash` with `underscore` and `ramda`; `uuid` next to `crypto.randomUUID`.
  Bloat is low severity but goes in the plan as a removal.

## Upgrade plan rules

1. Lockfile first: pick the manager from `packageManager` or the existing lockfile, commit it, add
   `engines` and `.nvmrc`.
2. Removals before upgrades: search the source for imports of each suspect; no import means remove.
3. Pins: replace `*` and `latest` with the resolved version from the lockfile.
4. Replacements name the alternative and the API difference in one line.
5. Major upgrades last, one per step, with the single breaking change most likely to bite.
6. End with `ignore-scripts=true` in `.npmrc` plus an explicit allowlist (pnpm
   `onlyBuiltDependencies`) as a durable control, and the audit command for CVEs.
