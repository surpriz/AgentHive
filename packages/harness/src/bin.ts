#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { DEFAULT_CAPS } from './loop.js';
import { loadPackage } from './package.js';
import { findingsOf, score } from './score.js';
import { loadTask, loadTaxonomy } from './task.js';
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

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
