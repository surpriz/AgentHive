import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type Anthropic from '@anthropic-ai/sdk';
import { runLoop, type Caps, type LoopResult, type MessagesClient } from './loop.js';
import { createE2bSession, type SandboxSession } from './e2b.js';
import { localHost, startBricks } from './mcp.js';
import { buildSystemPrompt, type LoadedPackage } from './package.js';
import { findingsOf, score, type Score, type Taxonomy } from './score.js';
import { stageApp, type LoadedTask } from './task.js';

const exec = promisify(execFile);

export interface RunRecord {
  harness: string;
  package: { name: string; version: string; author: string };
  task: { id: string; version: number; stack: string };
  sandbox: { kind: 'local' | 'e2b'; id: string };
  model: string;
  runIndex: number;
  startedAt: string;
  endedAt: string;
  result: LoopResult;
  score: Score | null;
}

export interface RunOptions {
  client: MessagesClient;
  model: string;
  pkg: LoadedPackage;
  task: LoadedTask;
  taxonomy: Taxonomy;
  runIndex?: number;
  caps?: Partial<Caps>;
  /** Where the bricks run: on this machine (tests, author runs) or in an E2B sandbox (batches). */
  sandbox?: 'local' | 'e2b';
  settings?: Record<string, unknown>;
  onEvent?: (e: { kind: string; detail: string }) => void;
}

/** The app directories are copied without history; the git brick still needs a repository to read. */
async function initRepo(dir: string): Promise<void> {
  const env = { ...process.env, GIT_AUTHOR_NAME: 'demo', GIT_AUTHOR_EMAIL: 'demo@example.com', GIT_COMMITTER_NAME: 'demo', GIT_COMMITTER_EMAIL: 'demo@example.com' };
  await exec('git', ['init', '-q'], { cwd: dir, env });
  await exec('git', ['add', '-A'], { cwd: dir, env });
  await exec('git', ['commit', '-q', '-m', 'initial import'], { cwd: dir, env });
}

/** A private task's run keeps its numbers and loses everything that describes the app: turns, tool results, the report itself. */
export function redact(r: LoopResult): LoopResult {
  return { ...r, turns: r.turns.map((t) => ({ ...t, text: '', toolCalls: t.toolCalls.map((c) => ({ ...c, input: null, result: '' })) })), output: { redacted: true }, outputText: '' };
}

/** The local session: bricks as child processes in the staged directory. */
const localSession = (dir: string): SandboxSession => ({ host: localHost, cwd: dir, id: 'local', close: async () => {} });

export async function runTask(opts: RunOptions): Promise<RunRecord> {
  const startedAt = new Date().toISOString();
  const staged = await stageApp(opts.task);
  let session: SandboxSession | null = null;
  try {
    await initRepo(staged.dir);
    session = opts.sandbox === 'e2b' ? await createE2bSession(staged.dir, opts.pkg.bricks.mcp, { onLog: (l) => opts.onEvent?.({ kind: 'sandbox', detail: l }) }) : localSession(staged.dir);
    const bricks = await startBricks(opts.pkg.bricks.mcp, session.cwd, session.host);
    try {
      const result = await runLoop({
        client: opts.client,
        model: opts.model,
        system: buildSystemPrompt(opts.pkg, opts.settings),
        tools: bricks.tools,
        input: { ...opts.task.meta.input, path: '.' },
        outputSchema: opts.pkg.io.output as Record<string, unknown>,
        caps: opts.caps,
        onEvent: opts.onEvent,
      });
      const s = result.output ? score(findingsOf(result.output), opts.task.truth, opts.taxonomy, opts.task.incidental) : null;
      const shown = opts.task.meta.public === false ? redact(result) : result;
      return {
        harness: '0.1.0',
        package: { name: opts.pkg.name, version: opts.pkg.version, author: opts.pkg.author },
        task: { id: opts.task.meta.id, version: opts.task.truth.version, stack: opts.task.meta.stack },
        sandbox: { kind: opts.sandbox ?? 'local', id: session.id },
        model: opts.model,
        runIndex: opts.runIndex ?? 0,
        startedAt,
        endedAt: new Date().toISOString(),
        result: shown,
        score: s === null ? null : opts.task.meta.public === false ? { ...s, falsePositives: [], incidental: [] } : s,
      };
    } finally {
      await bricks.close();
    }
  } finally {
    await session?.close();
    await staged.cleanup();
  }
}

/** The real client. Kept here so `bin.ts` is the only place that touches the key. */
export async function anthropicClient(): Promise<MessagesClient> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client: Anthropic = new Anthropic();
  return client.messages;
}
