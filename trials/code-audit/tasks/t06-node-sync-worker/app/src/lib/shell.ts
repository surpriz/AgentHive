import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Runs a program with an argument array: no shell, no interpolation. Use this for anything that touches user data. */
export async function run(program: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(program, args, { cwd: opts.cwd, timeout: opts.timeoutMs ?? 10 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  return { stdout, stderr };
}
