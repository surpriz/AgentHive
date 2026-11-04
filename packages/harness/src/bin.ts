#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { DEFAULT_CAPS } from './loop.js';
import { loadPackage } from './package.js';
import { findingsOf, score } from './score.js';
import { loadTask, loadTaxonomy } from './task.js';
import { pushDir } from './push.js';
import { planBatch, runBatch } from './batch.js';
import { anthropicClient, runTask } from './run.js';

const program = new Command().name('agenthive-harness').description('Runs a declarative AgentHive package against a trial task and scores the result.');

program
  .command('run')
  .requiredOption('--package <dir>', 'package directory (agent.yaml, prompt.md, skills/)')
  .requiredOption('--task <dir>', 'task directory (task.yaml, app/, truth.json)')
  .option('--taxonomy <file>', 'taxonomy file', 'trials/code-audit/taxonomy.yaml')
  .option('--model <id>', 'model id', 'claude-haiku-5-5')
  .option('--runs <n>', 'runs per task', '1')
  .option('--out <dir>', 'where run records are written', 'runs')
  .option('--max-input <n>', 'input-token cap per run', String(DEFAULT_CAPS.inputTokens))
  .option('--max-output <n>', 'output-token cap per run', String(DEFAULT_CAPS.outputTokens))
  .option('--max-turns <n>', 'tool-turn cap per run', String(DEFAULT_CAPS.turns))
  .option('--max-minutes <n>', 'wall-clock cap per run', String(DEFAULT_CAPS.wallClockMs / 60_000))
  .option('--sandbox <kind>', 'where the bricks run: local or e2b', 'local')
  .option('--quiet', 'no per-turn output')
  .action(async (o: { package: string; task: string; taxonomy: string; model: string; runs: string; out: string; maxInput: string; maxOutput: string; maxTurns: string; maxMinutes: string; sandbox: string; quiet?: boolean }) => {
    if (o.sandbox !== 'local' && o.sandbox !== 'e2b') throw new Error(`unknown sandbox: ${o.sandbox}`);
    const pkg = await loadPackage(o.package);
    const task = await loadTask(o.task);
    const taxonomy = await loadTaxonomy(o.taxonomy);
    const client = await anthropicClient();
    await mkdir(o.out, { recursive: true });
    for (let i = 0; i < Number(o.runs); i++) {
      const record = await runTask({
        client,
        model: o.model,
        pkg,
        task,
        taxonomy,
        runIndex: i,
        caps: { inputTokens: Number(o.maxInput), outputTokens: Number(o.maxOutput), turns: Number(o.maxTurns), wallClockMs: Number(o.maxMinutes) * 60_000 },
        sandbox: o.sandbox,
        onEvent: o.quiet ? undefined : (e) => console.error(`  ${e.kind}: ${e.detail}`),
      });
      const file = path.join(o.out, `${task.meta.id}--${pkg.name}--${o.model}--${i}.json`);
      await writeFile(file, JSON.stringify(record, null, 2));
      const r = record.result;
      const s = record.score;
      console.log(
        [
          `${pkg.name}@${pkg.version} on ${task.meta.id} (${o.model}, run ${i})`,
          s ? `score ${s.score}  recall ${s.recall}  precision ${s.precision}  found ${s.found.join(',') || '-'}  missed ${s.missed.join(',') || '-'}  fp ${s.falsePositives.length}  traps ${s.traps.filter((t) => t.resisted).length}/${s.traps.length}` : `no parsable output (${r.ended})`,
          `tokens in ${r.usage.input + r.usage.cacheWrite + r.usage.cacheRead} (cache read ${r.usage.cacheRead}) out ${r.usage.output}  cost ${r.costUsd === null ? 'n/a' : `$${r.costUsd.toFixed(4)}`}  ${Math.round(r.durationMs / 1000)}s  turns ${r.turns.length}${r.capped ? `  CAPPED ${r.capped}` : ''}`,
          `  → ${file}`,
        ].join('\n'),
      );
    }
  });

program
  .command('score')
  .description('Re-scores a run record or a raw output file against a task')
  .requiredOption('--task <dir>')
  .requiredOption('--output <file>', 'run record (*.json from run) or a bare agent output')
  .option('--taxonomy <file>', 'taxonomy file', 'trials/code-audit/taxonomy.yaml')
  .action(async (o: { task: string; output: string; taxonomy: string }) => {
    const task = await loadTask(o.task);
    const taxonomy = await loadTaxonomy(o.taxonomy);
    const doc = JSON.parse(await readFile(o.output, 'utf8')) as { result?: { output?: unknown } };
    const output = doc.result?.output ?? doc;
    console.log(JSON.stringify(score(findingsOf(output), task.truth, taxonomy, task.incidental), null, 2));
  });

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

program
  .command('batch')
  .description('Runs every package on every task, several times per model, and writes one record per run')
  .requiredOption('--agents <dir>', 'directory of package directories')
  .requiredOption('--tasks <dir>', 'directory of task directories')
  .option('--models <spec>', 'model=runs pairs, comma separated', 'claude-haiku-5-5=3')
  .option('--packages <names>', 'only these packages, comma separated', '')
  .option('--only-tasks <ids>', 'only these tasks, comma separated', '')
  .option('--taxonomy <file>', 'taxonomy file', 'trials/code-audit/taxonomy.yaml')
  .option('--sandbox <kind>', 'local or e2b', 'e2b')
  .option('--concurrency <n>', 'runs in flight', '4')
  .option('--max-spend <usd>', 'stop scheduling runs past this spend', '40')
  .option('--out <dir>', 'where run records are written', 'runs')
  .action(async (o: { agents: string; tasks: string; models: string; packages: string; onlyTasks: string; taxonomy: string; sandbox: string; concurrency: string; maxSpend: string; out: string }) => {
    if (o.sandbox !== 'local' && o.sandbox !== 'e2b') throw new Error(`unknown sandbox: ${o.sandbox}`);
    const models: Record<string, number> = {};
    for (const pair of list(o.models)) {
      const [model, runs] = pair.split('=');
      if (!model || !Number(runs)) throw new Error(`bad model spec: ${pair}`);
      models[model] = Number(runs);
    }
    const plan = await planBatch(o.agents, o.tasks, models, { packages: list(o.packages), tasks: list(o.onlyTasks) });
    console.log(`${plan.packages.length} packages × ${plan.tasks.length} tasks × ${Object.entries(models).map(([m, n]) => `${m}×${n}`).join(' + ')} → ${o.out}`);
    const summary = await runBatch({
      client: await anthropicClient(),
      plan,
      taxonomyFile: o.taxonomy,
      outDir: o.out,
      sandbox: o.sandbox,
      concurrency: Number(o.concurrency),
      maxSpendUsd: Number(o.maxSpend),
      onEvent: (e) => {
        if (e.kind === 'done' || e.kind === 'failed' || e.kind === 'sandbox') console.error(`${e.kind}: ${e.detail}`);
      },
    });
    console.log(`${summary.done}/${summary.planned} runs done, ${summary.failed.length} failed, spend $${summary.spendUsd.toFixed(2)}${summary.stoppedForBudget ? ' (stopped at the budget)' : ''}`);
    for (const f of summary.failed) console.log(`  failed ${f.pkg} × ${f.task} × ${f.model} #${f.runIndex}: ${f.error.slice(0, 200)}`);
    if (summary.done === 0) process.exit(1);
  });

program
  .command('push')
  .description('Posts the run records of a directory to a registry trial, signed with TRIAL_RESULTS_SECRET')
  .requiredOption('--dir <dir>', 'directory of run records')
  .requiredOption('--batch <id>', 'batch id; timestamps sort best, e.g. 2026-11-04T10-00Z')
  .option('--trial <slug>', 'trial slug', 'code-audit')
  .option('--registry <url>', 'registry origin', 'https://agenthive.sh')
  .action(async (o: { dir: string; batch: string; trial: string; registry: string }) => {
    const secret = process.env.TRIAL_RESULTS_SECRET;
    if (!secret) throw new Error('TRIAL_RESULTS_SECRET is not set');
    const out = await pushDir(o.dir, { registry: o.registry, trial: o.trial, batchId: o.batch, secret });
    let failed = 0;
    for (const r of out) {
      const ok = r.status === 200 || r.status === 201;
      if (!ok) failed++;
      console.log(`${ok ? 'ok ' : 'ERR'} ${r.status || '---'} ${r.file}${ok ? '' : `  ${r.body.slice(0, 200)}`}`);
    }
    console.log(`${out.length - failed}/${out.length} records accepted`);
    if (failed) process.exit(1);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
