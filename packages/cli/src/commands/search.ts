import type { Command } from 'commander';
import type { Framework, RegistryClient, SecurityGrade } from '@agenthive/registry-client';
import { c, gradeColor, table } from '../ui.js';

export function registerSearch(program: Command, client: () => RegistryClient) {
  program
    .command('search [query...]')
    .description('search the registry (all terms must match)')
    .option('-f, --framework <name>', 'LangGraph | CrewAI | AutoGen | "MCP Server" | "Custom A2A"')
    .option('-c, --category <name>', 'e.g. "Security & Audit"')
    .option('-g, --grade <grade>', 'AAA | AA | A | B')
    .option('-n, --limit <n>', 'max results', '20')
    .option('--json', 'raw JSON output')
    .action(async (query: string[], opts: { framework?: string; category?: string; grade?: string; limit: string; json?: boolean }) => {
      const hits = await client().search({
        query: query.join(' '),
        framework: opts.framework as Framework | undefined,
        category: opts.category,
        grade: opts.grade as SecurityGrade | undefined,
        limit: Number(opts.limit),
      });
      if (opts.json) return console.log(JSON.stringify(hits, null, 2));
      if (hits.length === 0) {
        console.error(c.dim('no agent matches.'));
        process.exitCode = 1;
        return;
      }
      console.log(
        table(
          hits.map((a) => [c.bold(a.name), c.dim(`v${a.version}`), a.framework, gradeColor(a.grade), `${a.successRate}%`, `$${a.costPerRun}`, c.dim(a.tagline.slice(0, 60))]),
          ['NAME', 'VERSION', 'FRAMEWORK', 'GRADE', 'SUCCESS', 'COST/RUN', 'TAGLINE'],
        ),
      );
      console.log(c.dim(`\n${hits.length} agent(s) · ${client().baseUrl}`));
    });
}
