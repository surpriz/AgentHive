import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import type { Command } from 'commander';
import { RegistryClient, type Layout, type PackageDoc, type RetrievalTarget } from '@agenthive-sh/registry-client';
import { mergeMcpServer, readConfig, writeConfig } from '../config.js';
import { c, sanitize } from '../ui.js';

export const PULL_TARGETS: RetrievalTarget[] = ['claude', 'cursor', 'codex'];

/** One `[mcp_servers.<name>]` table for Codex's config.toml. */
export function mcpToml(name: string, entry: { command: string; args: string[]; env: Record<string, string> }): string {
  const q = (s: string) => JSON.stringify(s);
  const lines = [`[mcp_servers.${name}]`, `command = ${q(entry.command)}`, `args = [${entry.args.map(q).join(', ')}]`];
  const env = Object.keys(entry.env);
  if (env.length) lines.push(`env = { ${env.map((k) => `${k} = ${q(entry.env[k])}`).join(', ')} }`);
  return lines.join('\n') + '\n';
}

/** Upserts a `[mcp_servers.<name>]` table in a TOML file, leaving everything else as written. */
export function upsertToml(raw: string, name: string, table: string): { text: string; existed: boolean } {
  const re = new RegExp(`^\\[mcp_servers\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\][^]*?(?=^\\[|(?![^]))`, 'm');
  if (re.test(raw)) return { text: raw.replace(re, table + (raw.endsWith('\n') ? '' : '\n')), existed: true };
  const sep = raw.length === 0 || raw.endsWith('\n\n') ? '' : raw.endsWith('\n') ? '\n' : '\n\n';
  return { text: raw + sep + table, existed: false };
}

/** Where a layout wants to write, resolved under `dir` and refused if it escapes it. */
export function resolveUnder(dir: string, rel: string): string {
  const abs = path.resolve(dir, rel);
  const root = path.resolve(dir);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`refusing to write outside ${root}: ${rel}`);
  return abs;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export function describePackage(pkg: PackageDoc, layout: Layout): string[] {
  const lines = [`${c.bold(sanitize(pkg.name))}@${sanitize(pkg.version)} by ${sanitize(pkg.author)} · ${sanitize(pkg.license)} · ${sanitize(pkg.goal ?? '')}`.trim(), `  ${sanitize(pkg.value)}`];
  if (layout.mcp.length) {
    lines.push('', c.bold('MCP servers (run on your machine):'));
    for (const m of layout.mcp) {
      const perms = sanitize([m.permissions.filesystem !== 'none' ? `filesystem ${m.permissions.filesystem}` : null, m.permissions.network.length ? `network ${m.permissions.network.join(', ')}` : null].filter(Boolean).join(' · ') || 'no filesystem, no network');
      const env = Object.keys(m.entry.env).map(sanitize);
      lines.push(`  ${sanitize(m.name)}  ${c.dim(sanitize(m.package))}`);
      lines.push(`    runs: ${sanitize([m.entry.command, ...m.entry.args].join(' '))}`);
      lines.push(`    ${c.yellow(perms)}${env.length ? c.dim(`  env to fill: ${env.join(', ')}`) : ''}`);
    }
    lines.push(c.dim('  declared permissions are the author\'s word; your tool does not enforce them'));
  } else lines.push('', c.dim('no MCP servers: prompt and skills only'));
  lines.push('', c.bold('Files:'));
  for (const f of layout.files) lines.push(`  ${sanitize(f.path)}  ${c.dim(`${Buffer.byteLength(f.content, 'utf8')} B`)}`);
  lines.push(`  ${sanitize(layout.mcpConfigPath)}  ${c.dim(layout.mcp.length ? `merge ${layout.mcp.length} server(s)` : 'untouched')}`);
  return lines;
}

/** Writes a layout under `dir`. Returns what was written and what was skipped. */
export async function applyLayout(dir: string, layout: Layout, opts: { force?: boolean } = {}): Promise<{ written: string[]; skipped: string[] }> {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const f of layout.files) {
    const abs = resolveUnder(dir, f.path);
    if (!opts.force && (await exists(abs))) {
      skipped.push(f.path);
      continue;
    }
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, f.content, 'utf8');
    written.push(f.path);
  }
  if (layout.mcp.length && layout.mcpConfigPath.endsWith('.toml')) {
    const file = resolveUnder(dir, layout.mcpConfigPath);
    let raw = '';
    try {
      raw = await readFile(file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    for (const m of layout.mcp) {
      const probe = upsertToml(raw, m.name, mcpToml(m.name, m.entry));
      if (probe.existed && !opts.force) {
        skipped.push(`${layout.mcpConfigPath}#${m.name}`);
        continue;
      }
      raw = probe.text;
      written.push(`${layout.mcpConfigPath}#${m.name}`);
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, raw, 'utf8');
    return { written, skipped };
  }
  if (layout.mcp.length) {
    const file = resolveUnder(dir, layout.mcpConfigPath);
    let config = await readConfig(file);
    for (const m of layout.mcp) {
      const current = config.mcpServers?.[m.name];
      if (current && !opts.force) {
        skipped.push(`${layout.mcpConfigPath}#${m.name}`);
        continue;
      }
      config = mergeMcpServer(config, m.name, m.entry);
      written.push(`${layout.mcpConfigPath}#${m.name}`);
    }
    await writeConfig(file, config);
  }
  return { written, skipped };
}

export function registerPull(program: Command, baseUrl: () => string) {
  program
    .command('pull <name>')
    .description('retrieve a package into Claude Code, Cursor or Codex: prompt, skills and MCP config written into the current project')
    .option('-t, --target <target>', `${PULL_TARGETS.join(' | ')}`, 'claude')
    .option('--dir <path>', 'project directory', '.')
    .option('-y, --yes', 'do not ask for confirmation')
    .option('--force', 'overwrite files and MCP entries that already exist')
    .option('--print', 'print the files instead of writing them')
    .action(async (name: string, opts: { target: string; dir: string; yes?: boolean; force?: boolean; print?: boolean }) => {
      if (!PULL_TARGETS.includes(opts.target as RetrievalTarget)) throw new Error(`unknown target "${opts.target}" (use ${PULL_TARGETS.join(', ')})`);
      const target = opts.target as RetrievalTarget;
      const client = new RegistryClient({ baseUrl: baseUrl() });
      const pkg = await client.package(name).catch((e: Error & { status?: number }) => {
        if (e.status === 404) throw new Error(`"${name}" is not a package. If it is hosted by its author, call it with: agent-cli run ${name} --input '{...}'`);
        throw e;
      });
      const layout = pkg.layouts[target];
      if (opts.print) {
        for (const f of layout.files) console.log(`${c.dim(`# ${f.path}`)}\n${f.content}\n`);
        if (layout.mcp.length) console.log(`${c.dim(`# ${layout.mcpConfigPath}`)}\n${JSON.stringify({ mcpServers: Object.fromEntries(layout.mcp.map((m) => [m.name, m.entry])) }, null, 2)}`);
        return;
      }
      for (const line of describePackage(pkg, layout)) console.error(line);
      if (!opts.yes) {
        if (!process.stdin.isTTY) throw new Error('not a terminal: pass --yes to confirm');
        const rl = createInterface({ input: process.stdin, output: process.stderr });
        const answer = (await rl.question(`\nWrite these into ${path.resolve(opts.dir)}? [y/N] `)).trim().toLowerCase();
        rl.close();
        if (answer !== 'y' && answer !== 'yes') return console.error(c.dim('aborted'));
      }
      const { written, skipped } = await applyLayout(opts.dir, layout, { force: opts.force });
      for (const w of written) console.log(`${c.green('✓')} ${sanitize(w)}`);
      for (const s of skipped) console.log(`${c.yellow('·')} ${sanitize(s)} ${c.dim('exists, kept (use --force to overwrite)')}`);
      if (layout.mcp.some((m) => Object.keys(m.entry.env).length)) console.log(c.dim(`fill the empty env values in ${layout.mcpConfigPath} before use`));
      console.log(c.dim(target === 'claude' ? `then in Claude Code: @${pkg.name} <your request>` : `then in Cursor: reference the ${pkg.name} rule in chat`));
    });
}

/** Reads a package folder: agent.yaml plus every text file under the allowed paths. */
export async function readPackageDir(dir: string): Promise<{ manifest: string; files: Record<string, string> }> {
  const manifest = await readFile(path.join(dir, 'agent.yaml'), 'utf8');
  const files: Record<string, string> = {};
  const add = async (rel: string) => {
    files[rel] = await readFile(path.join(dir, rel), 'utf8');
  };
  for (const name of ['prompt.md', 'README.md']) if (await exists(path.join(dir, name))) await add(name);
  for (const folder of ['skills', 'examples']) {
    const root = path.join(dir, folder);
    if (!(await exists(root))) continue;
    for (const entry of await readdir(root, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      const rel = path.relative(dir, path.join(entry.parentPath ?? entry.path, entry.name)).split(path.sep).join('/');
      await add(rel);
    }
  }
  return { manifest, files };
}
