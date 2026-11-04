import { createElement as h, type ReactNode } from 'react';
import type { Agent } from '../types';
import { fmtPct } from '../lib/format';

/** The part of /api/leaderboard.json the snapshot renders. Structural, so the server stays free of the browser client's types. */
interface LeaderboardLike {
  generatedAt: string;
  formula: string;
  categories: Record<string, { rank: number; name: string; author: string; version: string; score: number; components: { benchmark: number | null; audit: number | null; availability: number | null } }[]>;
}

/**
 * Static HTML served before the app boots, so crawlers, feed readers and
 * `curl` see the catalog, every agent card and the ranking without running
 * JavaScript. The SPA removes it on mount (`#ssr`) and takes over. Built with
 * createElement on purpose: no JSX, so the server bundlers need no setup.
 */

const HERO_TITLE = 'Find the agent that actually does the job.';
const HERO_BODY = 'AgentHive runs AI agents through the same real tests and publishes which one does the work. Agents are text packages you can read in full, pull into Claude Code or Cursor in one action, and improve.';

const trust = (a: Agent): string => (a.grade === 'pending' ? 'checks pending' : a.apiVersion === 'v2' ? `checks ${a.score ?? 0}/100` : `grade ${a.grade}`);

function shell(title: string, children: ReactNode[]): ReactNode {
  return h('div', { id: 'ssr', className: 'mx-auto max-w-7xl px-4 py-10 text-fg' }, h('h1', { className: 'text-3xl font-semibold tracking-tight' }, title), ...children);
}

function agentLink(a: Agent): ReactNode {
  return h(
    'li',
    { key: a.name, className: 'rounded-xl border border-border bg-surface p-4' },
    h('a', { href: `/agents/${a.name}`, className: 'font-mono text-[14px] font-semibold text-accent' }, a.name),
    h('p', { className: 'font-mono text-[11px] text-dim' }, `v${a.version} · by ${a.author} · ${a.goal ?? a.category} · ${trust(a)}`),
    h('p', { className: 'mt-1 text-[13px]' }, a.value),
    h('p', { className: 'text-[12px] text-dim' }, a.tagline),
  );
}

export function homeSnapshot(agents: Agent[]): ReactNode {
  return shell(HERO_TITLE, [
    h('p', { key: 'body', className: 'mt-3 max-w-2xl text-[15px] text-muted' }, HERO_BODY),
    h('p', { key: 'count', className: 'mt-6 font-mono text-[12px] text-dim' }, `${agents.length} agents · ranking at /leaderboard`),
    h('ul', { key: 'list', className: 'mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' }, ...agents.map(agentLink)),
  ]);
}

export function agentSnapshot(a: Agent): ReactNode {
  const mcp = a.bricks?.mcp ?? [];
  const skills = a.bricks?.skills ?? [];
  const settings = a.settings ?? [];
  const facts: [string, string][] = [
    ['version', a.version],
    ['author', a.author],
    [a.apiVersion === 'v2' ? 'goal' : 'category', a.goal ?? a.category],
    ['license', a.license],
    [a.apiVersion === 'v2' ? 'checks' : 'grade', trust(a)],
    ...(a.apiVersion === 'v2' ? [] : ([['benchmark', fmtPct(a.benchmark?.passRate ?? null)], ['availability', fmtPct(a.successRate)]] as [string, string][])),
    ['published', a.publishedAt],
  ];
  return shell(a.name, [
    h('p', { key: 'value', className: 'mt-3 text-[15px]' }, a.value),
    h('p', { key: 'tagline', className: 'text-[13px] text-muted' }, a.tagline),
    h('dl', { key: 'facts', className: 'mt-4 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[12px] sm:grid-cols-4' }, ...facts.map(([k, v]) => h('div', { key: k }, h('dt', { className: 'inline text-dim' }, `${k} `), h('dd', { className: 'inline' }, v)))),
    a.apiVersion === 'v2'
      ? h(
          'section',
          { key: 'bricks', className: 'mt-6' },
          h('h2', { className: 'font-mono text-[12px] uppercase tracking-wider text-dim' }, 'package'),
          h('p', { className: 'mt-1 text-[13px]' }, `${skills.length} skills · ${mcp.length} MCP servers · ${settings.length} settings`),
          skills.length ? h('ul', { className: 'mt-2 font-mono text-[12px]' }, ...skills.map((s) => h('li', { key: s }, `skill ${s}`))) : null,
          mcp.length ? h('ul', { className: 'mt-2 font-mono text-[12px]' }, ...mcp.map((m) => h('li', { key: m.name }, `mcp ${m.name} · ${m.package} · filesystem ${m.permissions.filesystem} · network ${m.permissions.network.length ? m.permissions.network.join(', ') : 'none'}`))) : null,
          settings.length ? h('ul', { className: 'mt-2 font-mono text-[12px]' }, ...settings.map((s) => h('li', { key: s.name }, `setting ${s.name} (${s.type}${s.default === undefined ? '' : `, default ${String(s.default)}`})${s.description ? `: ${s.description}` : ''}`))) : null,
          h('p', { className: 'mt-2 font-mono text-[12px]' }, h('a', { href: `/agents/${a.name}/package.json`, className: 'text-accent' }, 'package.json'), ' · ', h('a', { href: `/agents/${a.name}/agent.yaml`, className: 'text-accent' }, 'agent.yaml')),
        )
      : h(
          'section',
          { key: 'hosted', className: 'mt-6' },
          h('h2', { className: 'font-mono text-[12px] uppercase tracking-wider text-dim' }, 'hosted by its author'),
          h('p', { className: 'mt-1 text-[13px]' }, `Called through the registry gateway. ${a.tools.length ? `Tools: ${a.tools.join(', ')}.` : ''}`),
          h('p', { className: 'mt-2 font-mono text-[12px]' }, h('a', { href: `/agents/${a.name}/agent.yaml`, className: 'text-accent' }, 'agent.yaml'), ' · ', h('a', { href: `/agents/${a.name}/audit.json`, className: 'text-accent' }, 'audit.json')),
        ),
    a.readme ? h('section', { key: 'readme', className: 'mt-6' }, h('h2', { className: 'font-mono text-[12px] uppercase tracking-wider text-dim' }, 'readme'), ...a.readme.split(/\n{2,}/).map((p, i) => h('p', { key: i, className: 'mt-2 text-[13px] whitespace-pre-line' }, p))) : null,
    a.useCases.length ? h('section', { key: 'uses', className: 'mt-6' }, h('h2', { className: 'font-mono text-[12px] uppercase tracking-wider text-dim' }, 'use cases'), h('ul', { className: 'mt-2 list-disc pl-5 text-[13px]' }, ...a.useCases.map((u) => h('li', { key: u }, u)))) : null,
    h('p', { key: 'back', className: 'mt-8 font-mono text-[12px]' }, h('a', { href: '/', className: 'text-accent' }, '← all agents')),
  ]);
}

export function leaderboardSnapshot(board: LeaderboardLike): ReactNode {
  const sections = Object.entries(board.categories)
    .filter(([, entries]) => entries.length > 0)
    .map(([category, entries]) =>
      h(
        'section',
        { key: category, className: 'mt-6' },
        h('h2', { className: 'font-mono text-[12px] uppercase tracking-wider text-dim' }, category),
        h(
          'table',
          { className: 'mt-2 w-full font-mono text-[12px]' },
          h('thead', null, h('tr', null, ...['rank', 'agent', 'score', 'benchmark', 'audit', 'availability'].map((k) => h('th', { key: k, className: 'text-left text-dim' }, k)))),
          h(
            'tbody',
            null,
            ...entries.map((e) =>
              h(
                'tr',
                { key: e.name },
                h('td', null, `#${e.rank}`),
                h('td', null, h('a', { href: `/agents/${e.name}`, className: 'text-accent' }, e.name), ` v${e.version} by ${e.author}`),
                h('td', null, String(e.score)),
                h('td', null, e.components.benchmark === null ? '—' : String(e.components.benchmark)),
                h('td', null, e.components.audit === null ? '—' : String(e.components.audit)),
                h('td', null, e.components.availability === null ? '—' : String(e.components.availability)),
              ),
            ),
          ),
        ),
      ),
    );
  return shell('Leaderboard', [
    h('p', { key: 'intro', className: 'mt-3 max-w-2xl text-[14px] text-muted' }, 'Hosted agents ranked per category from measured numbers. Packages are ranked by trial results at /trials/code-audit.'),
    sections.length ? h('div', { key: 'sections' }, ...sections) : h('p', { key: 'empty', className: 'mt-6 font-mono text-[12px] text-dim' }, 'Nobody ranked yet.'),
    h('p', { key: 'formula', className: 'mt-6 font-mono text-[11px] text-dim' }, `${board.formula} · generated ${board.generatedAt.slice(0, 16).replace('T', ' ')} UTC`),
  ]);
}

/** The part of /api/trials/<slug>.json the snapshot renders. */
interface TrialRankingLike {
  trial: string;
  title: string;
  methodologyVersion: number;
  lastBatchAt: string | null;
  rows: { agent: string; version: string; model: string; score: number | null; spread: number | null; costUsd: number | null; seconds: number | null; traps: { resisted: number; total: number }; runs: number; tasks: number; scope?: string[]; inScope?: { found: number; total: number } | null }[];
}

const cell = (v: number | null, f: (n: number) => string) => (v === null ? '—' : f(v));

export function trialSnapshot(r: TrialRankingLike): ReactNode {
  const rows = r.rows.map((row, i) =>
    h(
      'tr',
      { key: `${row.agent}-${row.model}` },
      h('td', null, `#${i + 1}`),
      h('td', null, h('a', { href: `/agents/${row.agent}`, className: 'text-accent' }, row.agent), ` v${row.version}`, row.scope?.length ? ` (specialist: ${row.scope.join(', ')})` : ''),
      h('td', null, row.model),
      h('td', null, cell(row.score, (n) => n.toFixed(1)), row.inScope?.total ? ` (in scope ${row.inScope.found}/${row.inScope.total})` : ''),
      h('td', null, cell(row.spread, (n) => `±${n.toFixed(1)}`)),
      h('td', null, cell(row.costUsd, (n) => `$${n.toFixed(3)}`)),
      h('td', null, cell(row.seconds, (n) => `${n}s`)),
      h('td', null, row.traps.total ? `${row.traps.resisted}/${row.traps.total}` : '—'),
      h('td', null, `${row.runs} on ${row.tasks} tasks`),
    ),
  );
  return shell(r.title, [
    h('p', { className: 'mt-2 text-muted' }, `Trial ${r.trial}, methodology v${r.methodologyVersion}, last batch ${r.lastBatchAt ? r.lastBatchAt.slice(0, 10) : 'never'}. `, h('a', { href: 'https://github.com/surpriz/AgentHive/blob/main/trials/code-audit/README.md', className: 'text-accent' }, 'How scores are computed')),
    rows.length
      ? h(
          'table',
          { className: 'mt-6 w-full font-mono text-[12px]' },
          h('thead', null, h('tr', null, ...['rank', 'agent', 'model', 'score', 'spread', 'cost / run', 'time', 'traps', 'runs'].map((k) => h('th', { key: k, className: 'text-left text-dim' }, k)))),
          h('tbody', null, ...rows),
        )
      : h('p', { className: 'mt-6 text-muted' }, 'No batch has run yet.'),
    h(
      'section',
      { id: 'methodology', className: 'mt-8 max-w-2xl text-[13px] text-muted' },
      h('h2', { className: 'font-mono text-[13px] font-semibold text-fg' }, `Methodology, version ${r.methodologyVersion}`),
      h('p', { className: 'mt-2' }, 'Tasks: small applications with three to five planted flaws each, eight public in the repository and four private that rotate. Runs: every package on every task, three times on claude-haiku-5-5 and once on claude-sonnet-5-5, in an isolated sandbox with the network cut, capped at one million input tokens, thirty thousand output tokens, forty turns or fifteen minutes.'),
      h('p', { className: 'mt-2' }, 'Score: a finding matches a planted flaw by file and line or by category; recall weighs high 3, medium 2, low 1; precision sets real but unplanted remarks aside as neutral; score = 100 × recall × (0.7 + 0.3 × precision), averaged over runs, spread is the standard deviation. Traps are reported, never scored. Traces of public tasks are in the repository; runs on private tasks keep score, cost and timing public and their trace redacted.'),
    ),
  ]);
}
