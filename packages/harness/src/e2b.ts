import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Sandbox, type CommandHandle } from 'e2b';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import { commandFor, type ToolHost } from './mcp.js';
import type { McpBrick } from './package.js';

const exec = promisify(execFile);

/** Where a task app and its bricks live for the duration of one run. */
export interface SandboxSession {
  host: ToolHost;
  /** The app directory as the bricks see it. */
  cwd: string;
  id: string;
  close(): Promise<void>;
}

export interface E2bOptions {
  apiKey?: string;
  template?: string;
  /** Hard lifetime of the sandbox; the run's wall-clock cap should be lower. */
  timeoutMs?: number;
  onLog?: (line: string) => void;
}

const APP_DIR = '/home/user/app';
const UV_INSTALL = 'curl -LsSf https://astral.sh/uv/install.sh | sh';

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * The brick's command line, quoted for the sandbox shell. `uvx` lives where the
 * installer puts it. Once internet is off, both launchers must be told to use
 * their cache only: without `--offline`, npx hangs on a registry check even for
 * a cached package.
 */
export function brickCommandLine(brick: McpBrick, opts: { offline?: boolean } = {}): string {
  const { command, args } = commandFor(brick);
  const bin = command === 'uvx' ? '$HOME/.local/bin/uvx' : command;
  const flags = opts.offline ? ['--offline'] : [];
  return [bin, ...flags, ...args.map(shellQuote)].join(' ');
}

/**
 * An MCP transport over a background command in the sandbox: JSON-RPC lines go to
 * the process stdin, its stdout lines come back as messages. Same framing as the
 * SDK's stdio transport, different pipe.
 */
class SandboxStdioTransport implements Transport {
  private handle?: CommandHandle;
  private readonly buffer = new ReadBuffer();
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(
    private readonly sandbox: Sandbox,
    private readonly cmd: string,
    private readonly cwd: string,
    private readonly log: (line: string) => void,
  ) {}

  async start(): Promise<void> {
    if (this.handle) throw new Error('transport already started');
    this.handle = await this.sandbox.commands.run(this.cmd, {
      background: true,
      stdin: true,
      cwd: this.cwd,
      timeoutMs: 0,
      onStdout: (data) => {
        this.buffer.append(Buffer.from(data, 'utf8'));
        this.drain();
      },
      onStderr: (data) => this.log(`[brick stderr] ${data.trimEnd()}`),
    });
  }

  private drain(): void {
    while (true) {
      let message: JSONRPCMessage | null;
      try {
        message = this.buffer.readMessage();
      } catch (err) {
        this.onerror?.(err instanceof Error ? err : new Error(String(err)));
        continue;
      }
      if (!message) return;
      this.onmessage?.(message);
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.handle) throw new Error('transport not started');
    await this.handle.sendStdin(serializeMessage(message));
  }

  async close(): Promise<void> {
    const h = this.handle;
    this.handle = undefined;
    if (h) await h.kill().catch(() => false);
    this.onclose?.();
  }
}

/**
 * Creates a sandbox, uploads the app, prefetches the bricks while the sandbox
 * still has internet, then cuts internet off before any brick runs. The model
 * key never enters the sandbox: the loop runs on the host.
 */
export async function createE2bSession(appDir: string, bricks: McpBrick[], opts: E2bOptions = {}): Promise<SandboxSession> {
  const log = opts.onLog ?? (() => {});
  const sandbox = await Sandbox.create({
    apiKey: opts.apiKey,
    template: opts.template,
    timeoutMs: opts.timeoutMs ?? 20 * 60_000,
    allowInternetAccess: true,
    metadata: { purpose: 'agenthive-trial' },
  });
  try {
    log(`sandbox ${sandbox.sandboxId} created`);
    const tar = await exec('tar', ['-cf', '-', '-C', appDir, '.'], { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
    await sandbox.files.write('/tmp/app.tar', new Uint8Array(tar.stdout));
    await run(sandbox, `mkdir -p ${APP_DIR} && tar -xf /tmp/app.tar -C ${APP_DIR} && rm /tmp/app.tar`, log);

    // Prefetch: every brick is started once with --help so its package lands in the cache; a brick that
    // rejects --help still gets downloaded. uv is installed only when a PyPI brick needs it.
    if (bricks.some((b) => b.package.startsWith('pypi:'))) await run(sandbox, UV_INSTALL, log);
    for (const brick of bricks) await run(sandbox, `${brickCommandLine(brick)} --help >/dev/null 2>&1 || true`, log, APP_DIR);
    await sandbox.updateNetwork({ allowInternetAccess: false });
    log('internet off');
  } catch (err) {
    await sandbox.kill().catch(() => false);
    throw err;
  }
  return {
    id: sandbox.sandboxId,
    cwd: APP_DIR,
    host: { transportFor: (brick, cwd) => new SandboxStdioTransport(sandbox, brickCommandLine(brick, { offline: true }), cwd, log) },
    close: async () => {
      await sandbox.kill().catch(() => false);
    },
  };
}

async function run(sandbox: Sandbox, cmd: string, log: (l: string) => void, cwd?: string): Promise<void> {
  const res = await sandbox.commands.run(cmd, { cwd, timeoutMs: 10 * 60_000 });
  if (res.exitCode !== 0) throw new Error(`sandbox setup failed (${res.exitCode}): ${cmd}\n${res.stderr.slice(-2000)}`);
  log(`ran: ${cmd.slice(0, 80)}`);
}
