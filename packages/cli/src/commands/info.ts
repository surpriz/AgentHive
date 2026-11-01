import type { Command } from 'commander';
import type { RegistryClient } from '@agenthive-sh/registry-client';
import { c, gradeColor, num, sanitize, table } from '../ui.js';

export function registerInfo(program: Command, client: () => RegistryClient) {
  program
    .command('info <name>')
    .description('show an agent card (skills, tools, benchmark, schemas)')
    .option('--json', 'raw agent card JSON')
    .action(async (name: string, opts: { json?: boolean }) => {
      const card = await client().card(name);
      if (opts.json) return console.log(JSON.stringify(card, null, 2));
      const x = card['x-agenthive'];
      const s = sanitize;
      const list = (arr: string[]) => arr.map(s).join(', ');
      console.log(`${c.bold(s(card.name))} ${c.dim(`v${s(card.version)}`)}  by ${s(card.provider.organization)}  ${gradeColor(s(x.securityGrade))}`);
      console.log(s(card.description));
      console.log('');
      console.log(`${c.dim('framework')}  ${s(x.framework)}    ${c.dim('category')}  ${s(x.category)}    ${c.dim('model')}  ${s(x.model)}    ${c.dim('license')}  ${s(x.license)}`);
      console.log(`${c.dim('benchmark')}  ${num(x.benchmark.successRate, '% success')} · ${num(x.benchmark.avgCostUsd, '/run', '$')} · ${num(x.benchmark.avgLatencyMs, 'ms p50')}`);
      console.log(`${c.dim('tools')}      ${list(x.tools)}`);
      console.log(`${c.dim('skills')}     ${list(card.skills.map((k) => k.id))}`);
      console.log(`${c.dim('endpoint')}   ${s(card.url)}`);
      console.log(`${c.dim('docs')}       ${s(card.documentationUrl)}`);
      console.log('');
      console.log(c.dim('input schema'));
      console.log(s(JSON.stringify(x.inputSchema, null, 2)));
      console.log('');
      console.log(`${c.dim('install')}    agent-cli add ${s(card.name)}`);
    });

  program
    .command('manifest <name>')
    .description('print the AgentHive YAML manifest')
    .action(async (name: string) => {
      process.stdout.write(sanitize(await client().manifestYaml(name)));
    });
}

export function registerLeaderboard(program: Command, client: () => RegistryClient) {
  program
    .command('leaderboard')
    .description('agents ranked per category from measured numbers (benchmark, audit, availability)')
    .option('-c, --category <category>', 'one category only')
    .option('--json', 'raw board')
    .action(async (opts: { category?: string; json?: boolean }) => {
      const board = await client().leaderboard(opts.category);
      if (opts.json) return console.log(JSON.stringify(board, null, 2));
      let any = false;
      for (const [cat, entries] of Object.entries(board.categories)) {
        if (entries.length === 0) continue;
        any = true;
        console.log(c.bold(sanitize(cat)));
        console.log(
          table(
            entries.map((e) => [String(e.rank), c.bold(sanitize(e.name)), c.dim(`by ${sanitize(e.author)}`), gradeColor(sanitize(e.grade)), String(e.score), e.components.benchmark === null ? '—' : `${e.components.benchmark}%${e.benchmarkCases === 0 ? c.dim(' probes') : ''}`, num(e.components.availability, '%'), String(e.runs30d), e.delta === null ? c.cyan('new') : e.delta > 0 ? c.green(`▲${e.delta}`) : e.delta < 0 ? c.red(`▼${-e.delta}`) : c.dim('=')]),
            ['#', 'AGENT', '', 'GRADE', 'SCORE', 'BENCH', 'AVAIL', 'RUNS', 'MOVE'],
          ),
        );
        console.log('');
      }
      if (!any) console.log(c.dim('nobody ranked yet · an agent enters once it has a computed grade and a benchmark'));
      console.log(c.dim(`${sanitize(board.formula)} · https://agenthive.sh/leaderboard`));
    });
}
