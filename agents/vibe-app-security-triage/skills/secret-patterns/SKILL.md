---
name: secret-patterns
description: Recognise secret-shaped strings by provider format, tell live values from placeholders and public keys, and know which Next.js, Vite and Supabase names reach the browser.
---

# Secret patterns

Use this when scanning source, env files, bundles or git history for credentials. Formats are
described in words on purpose; build the search from the description.

## Provider formats worth a direct search

| Provider | Shape | Severity if live |
|---|---|---|
| AWS access key id | `AKIA` or `ASIA` followed by 16 uppercase letters or digits | critical |
| AWS secret key | 40 chars of base64 alphabet next to a var named `AWS_SECRET` | critical |
| Stripe secret | `sk_live_` or `rk_live_` then 24 or more alphanumerics; `sk_test_` is medium | critical |
| Stripe webhook | `whsec_` then 32 or more alphanumerics | high |
| GitHub token | `ghp_`, `gho_`, `ghs_` or `github_pat_` then 36 or more alphanumerics | critical |
| LLM provider API key | `sk-` then 20 or more alphanumerics, sometimes with a `proj-` segment | high |
| Google API key | `AIza` then 35 chars; browser-restricted ones are public, unrestricted are high | varies |
| Google service account | JSON with `"type": "service_account"` and `"private_key"` | critical |
| Supabase service_role | JWT (`eyJ` prefix, two dots) whose payload has `"role":"service_role"` | critical |
| Supabase anon | same JWT shape with `"role":"anon"` | public by design |
| Clerk, Resend, SendGrid | `sk_live_`, `re_`, `SG.` prefixes then long alphanumerics | high |
| Twilio | `AC` then 32 hex (account sid, medium) and a separate 32-hex auth token (high) | high |
| Slack | `xoxb-`, `xoxp-`, `xapp-` then digits and dashes | high |
| Database URL | `postgres://`, `postgresql://`, `mysql://`, `mongodb+srv://` with `user:password@` | critical |
| Private keys | `-----BEGIN` followed by `RSA`, `EC`, `OPENSSH` or `PRIVATE KEY` | critical |
| NextAuth / JWT secret | var named `NEXTAUTH_SECRET`, `AUTH_SECRET`, `JWT_SECRET` with 32+ random chars | high |
| Vercel, Netlify tokens | var named `VERCEL_TOKEN`, `NETLIFY_AUTH_TOKEN` with 24+ chars | high |

Decode JWTs: split on dots, base64url-decode the second segment, read `role`, `iss`, `exp`. Supabase
service keys have `iss: supabase` and `role: service_role`. Do not print the decoded payload if it has
an email or a user id.

## Generic patterns (second pass)

- Assignment of a 20+ char high-entropy string to a name containing `secret`, `token`, `password`,
  `passwd`, `pwd`, `api_key`, `apikey`, `access_key`, `private_key`, `client_secret`, `dsn`.
- `Authorization: Bearer <literal>` or `x-api-key: <literal>` in fetch calls.
- `.env`, `.env.local`, `.env.production`, `.env.development` anywhere, including subfolders.
- Files: `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `credentials.json`, `serviceAccount*.json`,
  `firebase-adminsdk*.json`, `.npmrc` with `_authToken`, `.netrc`, `.pypirc`.
- Shell history or dumps committed by accident: `.bash_history`, `*.sql` dumps with `INSERT INTO users`.

## Live value or placeholder?

A value is a placeholder when any of these hold:
- It contains `your`, `example`, `changeme`, `replace`, `xxx`, `todo`, `dummy`, `placeholder`, `<`, `>`.
- It is shorter than the provider minimum length or repeats one character.
- It lives only in `.env.example`, `.env.sample`, README, docs or a test fixture folder.
- It is the documented sample from a provider's docs (Stripe's `sk_test_` with `4eC39` is the classic).

A value is likely live when: it has the right prefix and length, it is referenced by real code, and it
appears in a file that is loaded at runtime (`.env`, `.env.local`, config, constants).

## What reaches the browser

- Next.js: every `process.env.NEXT_PUBLIC_*` reference is replaced at build time in both server and
  client code. Everything else is undefined in the browser. A private key under a `NEXT_PUBLIC_` name
  is therefore shipped to every visitor. Same for `VITE_*` (Vite), `REACT_APP_*` (CRA), `PUBLIC_*`
  (Astro, SvelteKit), `NUXT_PUBLIC_*` (Nuxt), `EXPO_PUBLIC_*` (Expo).
- Files that start with `"use client"`, anything under `pages/` that is not `pages/api`, hooks, and
  `components/` are browser code. A `createClient(url, serviceKey)` there is a critical leak even if the
  key is not prefixed, because the bundler inlines the literal.
- `public/` is served verbatim. Config JSON, `.map` files and backup files there are readable by anyone.
- `.next/` and `dist/` committed to git contain the built bundle: search them too, then tell the user
  to ignore and delete them.

## Git history

- `git log --all --diff-filter=D -- '.env*'` style queries find deleted env files. Read the blob at the
  commit before deletion.
- A rotated key in history is not a finding. An unrotated key in history is a finding at full severity.
- Only recommend history rewriting (filter-repo, BFG) after rotation, and only if the repo is private
  and has few collaborators; otherwise the clean history buys nothing.

## Rotation checklist entries

One line per secret: provider, where to rotate (dashboard path or CLI), the env var name to update,
and where it is deployed (Vercel project env, Supabase edge function secrets, GitHub Actions secrets).
