import type { Command } from 'commander';
import { installSnippet, mcpServerEntry, type RegistryClient } from '@agenthive-sh/registry-client';
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
    .description('install an agent as an MCP server in Claude Code or Cursor')
    .option('-t, --target <target>', `${TARGETS.join(' | ')}`, 'claude')
    .option('--path <file>', 'override the config file to write')
    .option('--dry-run', 'print the resulting config instead of writing')
    .option('--print', 'only print the snippet (same as the website)')
    .action(async (ref: string, opts: { target: string; path?: string; dryRun?: boolean; print?: boolean }) => {
      const { name, author, version } = parseRef(ref);
      const entry = await client().get(name);
      if (!entry) throw new Error(`no agent named "${name}" on ${client().baseUrl}`);
      if (author && author !== entry.author) {
        throw new Error(`"${name}" is published by "${entry.author}", not "${author}". Refusing to install a mismatched reference.`);
      }
      if (version && version !== entry.version) {
        console.error(c.yellow(`warning: requested ${version}, registry has ${entry.version}; pinning ${version}.`));
      }
      const pinned = { ...entry, version: version ?? entry.version };

      if (opts.print) return console.log(installSnippet(pinned, opts.target === 'cursor' ? 'cursor' : 'claude'));

      if (!TARGETS.includes(opts.target as Target)) throw new Error(`unknown target "${opts.target}" (use ${TARGETS.join(', ')})`);
      const target = opts.target as Target;
      const file = opts.path ?? targetPath(target);
      const current = await readConfig(file);
      const next = mergeMcpServer(current, pinned.name, mcpServerEntry(pinned));

      if (opts.dryRun) {
        console.log(c.dim(`# ${file}`));
        console.log(JSON.stringify(next, null, 2));
        return;
      }
      await writeConfig(file, next);
      console.log(`${c.green('✓')} ${c.bold(pinned.name)}@${pinned.version} added to ${file}`);
      if (target === 'cursor') console.log(c.dim('tip: add the .cursorrules block with `agent-cli add <name> --print --target cursor`'));
      else console.log(c.dim('restart Claude Code (or run /mcp) to pick it up · set AGENTHIVE_TOKEN in your env'));
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
      const next = mergeMcpServer(await readConfig(file), 'agenthive', { command: 'npx', args: ['-y', '@agenthive-sh/mcp'], ...(Object.keys(env).length ? { env } : {}) });
      if (opts.dryRun) return console.log(JSON.stringify(next, null, 2));
      await writeConfig(file, next);
      console.log(`${c.green('✓')} agenthive catalog server added to ${file}`);
    });

  program
    .command('serve <ref>')
    .description('run an agent as a local MCP server (V1 runtime, not available yet)')
    .action((ref: string) => {
      const { name } = parseRef(ref);
      console.error(`${c.red('✗')} "${name}" cannot run locally yet: the managed runtime ships in AgentHive V1.`);
      console.error(c.dim(`  catalog access works today: agent-cli info ${name} · agent-cli setup`));
      process.exitCode = 2;
    });
}
