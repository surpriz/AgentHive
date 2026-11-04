---
name: boundary-sink-patterns
description: Sinks and guards for filesystem, outbound request, process and HTML boundaries in Node, Python and SvelteKit code: what counts as a real check, the partial checks that fail, and the safe sibling to recommend.
---

# Boundary sink patterns

## Filesystem

| Guard | Real? |
|---|---|
| `const p = path.resolve(base, name); if (!p.startsWith(path.resolve(base) + path.sep)) reject` | yes |
| `Path(base, name).resolve().is_relative_to(Path(base).resolve())` | yes (Python 3.9+) |
| `path.join(base, name)` alone | no: `../` and absolute names escape; on Windows drive letters too |
| `name.replace('..', '')` | no: `....//` survives; encoded forms survive |
| `name.includes('..')` check | partial: absolute paths and symlinks pass |
| `path.basename(name)` before join | yes for a single segment; loses subfolders by design |
| `send_file` / `sendFile` with `root` option | yes when `root` is set and the name is relative |

Uploads: random stored name (`crypto.randomBytes`, `uuid`), original name only as metadata; size
check before `await file.read()` or with a streaming limit (`multer` `limits`, `python-multipart`
`max_part_size`); content type from magic bytes if it matters; images re-encoded. Archives: every
entry's resolved path checked before writing (zip slip); symlink entries rejected.

Downloads: look up by id, serve `stored_as` through the helper; never the raw name from the query.
Static servers (`express.static`, `StaticFiles`) with `dotfiles: 'allow'` or pointed at the repo
root expose `.env` and `.git`.

## Outbound requests (SSRF)

| Guard | Real? |
|---|---|
| hostname parsed with `new URL()` / `urlparse` and compared to an allowlist set | yes |
| `url.startsWith('https://')` | no: any host |
| `url.includes('example.com')` | no: `example.com.attacker.io`, `attacker.io/?x=example.com` |
| regex on the string without anchoring the host | no |
| allowlist at save time but not at send time (stored webhook URLs) | partial: DNS and redirects |
| redirects followed (default in fetch, httpx `follow_redirects=True`, requests) | widens any check to the redirect target |
| resolved IP checked against `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fd00::/8` | yes, only together with no-redirect |

Response disclosure makes it worse: returning the fetched body, storing it as a file the caller can
download, or including the error message with the upstream response. Metadata endpoints
(`169.254.169.254`, `metadata.google.internal`) are the usual target in cloud deploys.

## Processes

| Call | Risk |
|---|---|
| `exec(\`cmd ${input}\`)`, `execSync`, `shell: true`, `os.system`, `subprocess.run(cmd, shell=True)` | critical with any request value |
| `execFile('tool', [input])`, `spawn('tool', [input])`, `subprocess.run(['tool', input])` | safe from shell parsing; check option injection (`-`), `--` separators, and tools that read files from arguments |
| `child_process.fork` with user path | critical |
| `eval`, `new Function`, `vm.runInNewContext` with input | critical |

Argument allowlists (an enum for format, a regex `^[a-z0-9-]+$` for names) are the fix when the
value must reach the command. A `shell.ts` helper with `execFile` next to a route that calls
`exec` directly is the common decoy.

## HTML output

| Sink | Safe when |
|---|---|
| `dangerouslySetInnerHTML={{__html: x}}` | `x` is from a sanitiser (`DOMPurify.sanitize`, `sanitize-html`) or a constant |
| `{@html x}` (Svelte) | same |
| `marked(x)`, `markdown-it` with `html: true`, `remark-html` without `sanitize` | never on user input without a sanitiser after |
| Jinja/Nunjucks `|safe`, `Markup()`, `autoescape=False` | constants only |
| `href={x}` from input | scheme checked (`http`, `https`, `mailto`), `javascript:` rejected |
| `innerHTML =`, `document.write` | same as React case |
| Email templates with user content | escaped |

Stored XSS (content other users see) outranks reflected. A sanitiser configured with
`ALLOWED_TAGS` including `script`, `iframe`, `style` or `on*` attributes is not a sanitiser.
