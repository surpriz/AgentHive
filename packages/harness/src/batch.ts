import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MessagesClient } from './loop.js';
import { listPackages, loadPackage, type LoadedPackage } from './package.js';
import { loadTask, loadTaxonomy, type LoadedTask } from './task.js';
import { runTask, type RunRecord } from './run.js';
import type { Caps } from './loop.js';

export interface BatchPlan {
  packages: LoadedPackage[];
  tasks: LoadedTask[];
  /** model id → runs per task */
  models: Record<string, number>;
}

export interface BatchOptions {
  client: MessagesClient;
  plan: BatchPlan;
  taxonomyFile: string;
  outDir: string;
  sandbox: 'local' | 'e2b';
  concurrency: number;
  caps?: Partial<Caps>;
  /** Stop scheduling new runs once the recorded spend reaches this. Runs in flight finish. */
  maxSpendUsd?: number;
  onEvent?: (e: { kind: string; detail: string }) => void;
}

export interface BatchSummary {
  planned: number;
  done: number;
  failed: { pkg: string; task: string; model: string; runIndex: number; error: string }[];
  spendUsd: number;
  stoppedForBudget: boolean;
}

interface Job {
  pkg: LoadedPackage;
  task: LoadedTask;
  model: string;
  runIndex: number;
}

export const recordFileName = (r: Pick<RunRecord, 'task' | 'package' | 'model' | 'runIndex'>) => `${r.task.id}--${r.package.name}--${r.model}--${r.runIndex}.json`;

/** Loads every package under `agentsDir` and every task under `tasksDir`. */
export async function planBatch(agentsDir: string, tasksDir: string, models: Record<string, number>, only: { packages?: string[]; tasks?: string[] } = {}): Promise<BatchPlan> {
  const packages = await Promise.all((await listPackages(agentsDir)).map(loadPackage));
  const tasks = await Promise.all((await listPackages(tasksDir)).map(loadTask));
  return {
    packages: packages.filter((p) => !only.packages?.length || only.packages.includes(p.name)),
    tasks: tasks.filter((t) => !only.tasks?.length || only.tasks.includes(t.meta.id)),
    models,
  };
}

/**
 * Runs every package on every task, `runs` times per model, with a bounded number
 * of runs in flight. Each run record is written as soon as it ends, so a killed
 * batch keeps what it finished.
 */
export async function runBatch(opts: BatchOptions): Promise<BatchSummary> {
  const taxonomy = await loadTaxonomy(opts.taxonomyFile);
  await mkdir(opts.outDir, { recursive: true });
  const jobs: Job[] = [];
  for (const [model, runs] of Object.entries(opts.plan.models)) for (const task of opts.plan.tasks) for (const pkg of opts.plan.packages) for (let i = 0; i < runs; i++) jobs.push({ pkg, task, model, runIndex: i });
  const summary: BatchSummary = { planned: jobs.length, done: 0, failed: [], spendUsd: 0, stoppedForBudget: false };
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      if (opts.maxSpendUsd !== undefined && summary.spendUsd >= opts.maxSpendUsd) {
        summary.stoppedForBudget = true;
        return;
      }
      const job = jobs[next++];
      const label = `${job.pkg.name} × ${job.task.meta.id} × ${job.model} #${job.runIndex}`;
      try {
        const record = await runTask({ client: opts.client, model: job.model, pkg: job.pkg, task: job.task, taxonomy, runIndex: job.runIndex, caps: opts.caps, sandbox: opts.sandbox, onEvent: (e) => opts.onEvent?.({ kind: e.kind, detail: `[${label}] ${e.detail}` }) });
        await writeFile(path.join(opts.outDir, recordFileName(record)), JSON.stringify(record, null, 2));
        summary.done++;
        summary.spendUsd += record.result.costUsd ?? 0;
        opts.onEvent?.({ kind: 'done', detail: `${label} score=${record.score?.score ?? 'n/a'} cost=$${(record.result.costUsd ?? 0).toFixed(4)} spend=$${summary.spendUsd.toFixed(2)}` });
      } catch (err) {
        summary.failed.push({ pkg: job.pkg.name, task: job.task.meta.id, model: job.model, runIndex: job.runIndex, error: err instanceof Error ? err.message : String(err) });
        opts.onEvent?.({ kind: 'failed', detail: `${label} ${err instanceof Error ? err.message : String(err)}` });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
  return summary;
}
