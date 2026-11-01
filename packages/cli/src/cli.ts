import { Command } from 'commander';
import { DEFAULT_REGISTRY, RegistryClient, RegistryError } from '@agenthive-sh/registry-client';
import { registerSearch } from './commands/search.js';
import { registerInfo } from './commands/info.js';
import { registerAdd } from './commands/add.js';
import { registerAccount } from './commands/account.js';
import { resolveToken } from './credentials.js';
import { c } from './ui.js';

export function buildProgram(): Command {
  const program = new Command('agent-cli')
    .description('agenthive.sh — search, inspect and install interoperable AI agents')
    .version('0.3.0')
    .option('-r, --registry <url>', `registry base URL (env AGENTHIVE_REGISTRY, default ${DEFAULT_REGISTRY})`)
    .showHelpAfterError()
    .configureOutput({ writeErr: (s) => process.stderr.write(s) });

  let cached: RegistryClient | null = null;
  const client = () => {
    if (!cached) cached = new RegistryClient({ baseUrl: program.opts<{ registry?: string }>().registry });
    return cached;
  };
  /** Same client, with the stored or env token attached. */
  let cachedAuthed: Promise<RegistryClient> | null = null;
  const authed = () =>
    (cachedAuthed ??= (async () => {
      const baseUrl = client().baseUrl;
      return new RegistryClient({ baseUrl, token: await resolveToken(baseUrl) });
    })());

  registerSearch(program, client);
  registerInfo(program, client);
  registerAdd(program, client);
  registerAccount(program, authed, () => client().baseUrl);
  return program;
}

export async function run(argv = process.argv): Promise<void> {
  try {
    await buildProgram().parseAsync(argv);
  } catch (e) {
    const msg = e instanceof RegistryError || e instanceof Error ? e.message : String(e);
    console.error(`${c.red('error:')} ${msg}`);
    process.exitCode = 1;
  }
}
