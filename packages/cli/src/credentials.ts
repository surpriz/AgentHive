import { mkdir, readFile, writeFile, chmod, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export interface Credentials {
  registry: string;
  token: string;
  login?: string;
}

/** ~/.config/agenthive/credentials.json (XDG_CONFIG_HOME respected). Mode 600. */
export function credentialsPath(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const base = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim() !== '' ? env.XDG_CONFIG_HOME : path.join(home, '.config');
  return path.join(base, 'agenthive', 'credentials.json');
}

export async function readCredentials(file = credentialsPath()): Promise<Credentials | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const c = parsed as Partial<Credentials>;
    return typeof c.token === 'string' && typeof c.registry === 'string' ? { registry: c.registry, token: c.token, login: c.login } : null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function writeCredentials(creds: Credentials, file = credentialsPath()): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(creds, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await chmod(file, 0o600);
}

export async function clearCredentials(file = credentialsPath()): Promise<void> {
  await rm(file, { force: true });
}

/** Token resolution: AGENTHIVE_TOKEN wins, then the stored credentials for this registry. */
export async function resolveToken(registry: string, env: NodeJS.ProcessEnv = process.env, file = credentialsPath(env)): Promise<string | undefined> {
  if (env.AGENTHIVE_TOKEN) return env.AGENTHIVE_TOKEN;
  const stored = await readCredentials(file);
  return stored && stored.registry === registry ? stored.token : undefined;
}
