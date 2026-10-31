import type { Command } from 'commander';
import type { RegistryClient } from '@agenthive/registry-client';
import { c, gradeColor } from '../ui.js';

export function registerInfo(program: Command, client: () => RegistryClient) {
  program
    .command('info <name>')
    .description('show an agent card (skills, tools, benchmark, schemas)')
    .option('--json', 'raw agent card JSON')
    .action(async (name: string, opts: { json?: boolean }) => {
      const card = await client().card(name);
      if (opts.json) return console.log(JSON.stringify(card, null, 2));
      const x = card['x-agenthive'];
      console.log(`${c.bold(card.name)} ${c.dim(`v${card.version}`)}  by ${card.provider.organization}  ${gradeColor(x.securityGrade)}`);
      console.log(card.description);
      console.log('');
      console.log(`${c.dim('framework')}  ${x.framework}    ${c.dim('category')}  ${x.category}    ${c.dim('model')}  ${x.model}    ${c.dim('license')}  ${x.license}`);
      console.log(`${c.dim('benchmark')}  ${x.benchmark.successRate}% success · $${x.benchmark.avgCostUsd}/run · ${x.benchmark.avgLatencyMs}ms p50`);
      console.log(`${c.dim('tools')}      ${x.tools.join(', ')}`);
      console.log(`${c.dim('skills')}     ${card.skills.map((s) => s.id).join(', ')}`);
      console.log(`${c.dim('endpoint')}   ${card.url}`);
      console.log(`${c.dim('docs')}       ${card.documentationUrl}`);
      console.log('');
      console.log(c.dim('input schema'));
      console.log(JSON.stringify(x.inputSchema, null, 2));
      console.log('');
      console.log(`${c.dim('install')}    agent-cli add ${card.name}`);
    });

  program
    .command('manifest <name>')
    .description('print the AgentHive YAML manifest')
    .action(async (name: string) => {
      process.stdout.write(await client().manifestYaml(name));
    });
}
