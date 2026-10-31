import type { Command } from 'commander';
import type { RegistryClient } from '@agenthive/registry-client';
import { c, gradeColor, num, sanitize } from '../ui.js';

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
