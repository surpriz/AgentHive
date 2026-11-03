import type { Command } from 'commander';
import { MCP_PACKAGE_SPEC, installSnippet, type RegistryClient } from '@agenthive-sh/registry-client';
import { TARGETS, mergeMcpServer, readConfig, targetPath, writeConfig, type Target } from '../config.js';
import { c } from '../ui.js';

/** Parses "name", "author/name", "author/name@1.2.3" → { name, author?, version? } */
export function parseRef(ref: string): { name: string; author?: string; version?: string } {
  const m = /^(?:([a-z0-9]+(?:-[a-z0-9]+)*)\/)?([a-z0-9]+(?:-[a-z0-9]+)*)(?:@([\w.-]+))?$/.exec(ref);
  if (!m) throw new Error(`invalid agent reference "${ref}" (expected name, author/name or author/name@version)`);
  return { name: m[2], author: m[1], version: m[3] };
}

export function registerAdd(program: Command, client: () => RegistryClient) {
  program
    .command('add <ref>')
    .description('alias of `pull` for packages; hosted agents are called with `run`')
    .option('-t, --target <target>', 'claude | cursor', 'claude')
    .option('--print', 'only print the snippet (same as the website)')
    .action(async (ref: string, opts: { target: string; print?: boolean }) => {
      const { name, author, version } = parseRef(ref);
      const entry = await client().get(name);
      if (!entry) throw new Error(`no agent named "${name}" on ${client().baseUrl}`);
      if (author && author !== entry.author) {
        throw new Error(`"${name}" is published by "${entry.author}", not "${author}". Refusing to install a mismatched reference.`);
      }
      if (version && version !== entry.version) console.error(c.yellow(`warning: requested ${version}, registry has ${entry.version}.`));
      if (opts.print || entry.apiVersion !== 'v2') return console.log(installSnippet(entry, opts.target === 'cursor' ? 'cursor' : 'claude'));
      await program.parseAsync(['pull', name, '--target', opts.target], { from: 'user' });
    });

  program
    .command('setup')
    .description('install the AgentHive catalog MCP server itself (search agents from inside Claude Code)')
    .option('-t, --target <target>', `${TARGETS.join(' | ')}`, 'claude')
    .option('--path <file>')
    .option('--dry-run')
    .action(async (opts: { target: string; path?: string; dryRun?: boolean }) => {
      if (!TARGETS.includes(opts.target as Target)) throw new Error(`unknown target "${opts.target}"`);
      const file = opts.path ?? targetPath(opts.target as Target);
      const env: Record<string, string> = {};
      if (process.env.AGENTHIVE_REGISTRY) env.AGENTHIVE_REGISTRY = process.env.AGENTHIVE_REGISTRY;
      const next = mergeMcpServer(await readConfig(file), 'agenthive', { command: 'npx', args: ['-y', MCP_PACKAGE_SPEC], ...(Object.keys(env).length ? { env } : {}) });
      if (opts.dryRun) return console.log(JSON.stringify(next, null, 2));
      await writeConfig(file, next);
      console.log(`${c.green('✓')} agenthive catalog server added to ${file}`);
    });
}
