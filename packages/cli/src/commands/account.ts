import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import { RegistryClient, RegistryError } from '@agenthive/registry-client';
import { clearCredentials, credentialsPath, writeCredentials } from '../credentials.js';
import { c, gradeColor, sanitize } from '../ui.js';

async function promptSecret(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export function registerAccount(program: Command, client: () => Promise<RegistryClient>, baseUrl: () => string) {
  program
    .command('login')
    .description('store an API key for this registry (create one in your dashboard)')
    .option('-k, --key <key>', 'API key; prompted if omitted')
    .action(async (opts: { key?: string }) => {
      const registry = baseUrl();
      const key = opts.key ?? (await promptSecret(`API key for ${registry} (from ${registry}/dashboard): `));
      if (!key) throw new Error('no key given');
      const me = await new RegistryClient({ baseUrl: registry, token: key }).me();
      await writeCredentials({ registry, token: key, login: me.user.login });
      console.log(`${c.green('✓')} logged in as ${c.bold(sanitize(me.user.login))} · saved to ${credentialsPath()}`);
    });

  program
    .command('logout')
    .description('forget the stored API key')
    .action(async () => {
      await clearCredentials();
      console.log(`${c.green('✓')} credentials removed`);
    });

  program
    .command('whoami')
    .description('show the account behind the current API key')
    .action(async () => {
      const me = await (await client()).me();
      console.log(`${c.bold(sanitize(me.user.login))} ${c.dim(`via ${me.via}`)}`);
      if (me.agents.length === 0) return console.log(c.dim('no agents published yet · agent-cli push ./agent.yaml'));
      for (const a of me.agents) console.log(`  ${sanitize(a.name)} ${c.dim(`v${sanitize(a.version)}`)} ${gradeColor(sanitize(a.grade))}`);
    });

  program
    .command('push [file]')
    .description('publish a manifest (agent.yaml by default) to the registry')
    .action(async (file = 'agent.yaml') => {
      let manifest: string;
      try {
        manifest = await readFile(file, 'utf8');
      } catch (e) {
        throw new Error(`cannot read ${file}: ${(e as Error).message}`);
      }
      try {
        const res = await (await client()).publish(manifest);
        console.log(`${c.green('✓')} published ${c.bold(sanitize(res.agent.name))}@${sanitize(res.agent.version)} as ${sanitize(res.agent.author)} ${gradeColor(sanitize(res.agent.grade))}`);
        console.log(`  ${sanitize(res.url)}`);
        console.log(c.dim(`  install: agent-cli add ${sanitize(res.agent.name)}`));
      } catch (e) {
        if (e instanceof RegistryError && e.issues) {
          console.error(`${c.red('✗')} ${file} is not a valid manifest:`);
          for (const i of e.issues) console.error(`  ${c.yellow(sanitize(i.path) || 'manifest')}: ${sanitize(i.message)}`);
          process.exitCode = 1;
          return;
        }
        throw e;
      }
    });
}
