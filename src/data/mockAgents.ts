import type { Agent } from '../types';

export const mockAgents: Agent[] = [
  {
    id: 'claude-code-reviewer',
    name: 'claude-code-reviewer',
    version: '2.3.1',
    author: 'hivecore',
    tagline: 'Opinionated PR reviewer that reads the diff, the tests and the blast radius before it speaks.',
    value: 'Catches the bugs in a pull request that tests and linters miss, before a human reviews it.',
    framework: 'MCP Server',
    category: 'Code & Refactoring',
    grade: 'AAA',
    score: 95,
    auditedAt: '2026-09-14',
    benchmark: { passRate: 98.4, passed: 47, total: 48, ranAt: '2026-09-14' },
    successRate: 98.4,
    costPerRun: 0.002,
    avgLatencyMs: 4200,
    runs30d: 184_320,
    tools: ['GitHub API', 'AST Parser', 'Semgrep', 'Test Runner'],
    tags: ['code review', 'pull request', 'refactoring', 'security', 'typescript', 'python'],
    readme: `claude-code-reviewer plugs into any Claude Code or Cursor session as an MCP server and reviews pull requests the way a senior engineer would: it reads the diff, walks the call graph of every touched symbol, runs Semgrep rules relevant to the language, and only then writes findings.

Findings are ranked by blast radius. A change to a shared utility imported by 40 modules is flagged before a typo in a README. Every finding ships with a failure scenario (input → wrong output) so reviewers can verify instead of trust.

The agent never posts to GitHub on its own. It returns structured findings that your tooling decides what to do with.`,
    useCases: [
      'Pre-merge gate on monorepos with high fan-out utilities',
      'Nightly sweep of open PRs older than 48h',
      'Refactor safety check: diff a branch against main and list behavioural changes',
    ],
    inputSchema: {
      type: 'object',
      required: ['repo', 'pr'],
      properties: {
        repo: { type: 'string', description: 'owner/name' },
        pr: { type: 'integer' },
        focus: { type: 'array', items: { enum: ['correctness', 'security', 'performance', 'style'] } },
        max_findings: { type: 'integer', default: 10 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'integer' },
              severity: { enum: ['critical', 'high', 'medium', 'low'] },
              summary: { type: 'string' },
              failure_scenario: { type: 'string' },
            },
          },
        },
        verdict: { enum: ['approve', 'request_changes', 'comment'] },
      },
    },
    capabilities: ['review.pr', 'analyze.diff', 'scan.semgrep'],
    model: 'claude-opus-5-5',
    license: 'Apache-2.0',
    transport: 'mcp/stdio',
    endpoint: null,
    isSeed: true,
    publishedAt: '2026-09-14',
  },
  {
    id: 'eu-ai-act-auditor',
    name: 'eu-ai-act-auditor',
    version: '1.8.0',
    author: 'lexgraph',
    tagline: 'Classifies an AI system under the EU AI Act and produces the Annex IV technical documentation gap list.',
    value: 'Tells you which EU AI Act risk tier your AI system falls in and what paperwork is still missing.',
    framework: 'LangGraph',
    category: 'Security & Audit',
    grade: 'AAA',
    score: 95,
    auditedAt: '2026-08-02',
    benchmark: { passRate: 96.9, passed: 47, total: 48, ranAt: '2026-08-02' },
    successRate: 96.9,
    costPerRun: 0.041,
    avgLatencyMs: 38_000,
    runs30d: 12_740,
    tools: ['WebScraper', 'Vector Store', 'PDF Parser', 'Citation Checker'],
    tags: ['compliance', 'eu ai act', 'regulation', 'audit', 'risk', 'gdpr'],
    readme: `eu-ai-act-auditor takes a plain-language description of an AI system (plus optional model cards, DPIAs and architecture docs) and runs a LangGraph state machine that mirrors the Act's own decision tree: prohibited practices → high-risk Annex III → GPAI obligations → transparency duties.

Every conclusion cites the exact article and recital from a versioned vector store of the consolidated regulation (Regulation (EU) 2024/1689) and its delegated acts. Citations are re-verified against the source text before the final report is emitted, which is why latency is high and hallucinated articles are near zero.

Output is a structured gap analysis mapped to Annex IV sections, ready to drop into a conformity assessment file.`,
    useCases: [
      'Pre-launch risk classification for a new ML feature',
      'Quarterly re-audit when the regulation or the system changes',
      'Vendor due diligence: audit a third-party model from its public documentation',
    ],
    inputSchema: {
      type: 'object',
      required: ['system_description'],
      properties: {
        system_description: { type: 'string' },
        documents: { type: 'array', items: { type: 'string', format: 'uri' } },
        deployment_context: { enum: ['employment', 'credit', 'education', 'law_enforcement', 'biometrics', 'other'] },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        risk_tier: { enum: ['prohibited', 'high', 'limited', 'minimal', 'gpai'] },
        obligations: { type: 'array', items: { type: 'object', properties: { article: { type: 'string' }, summary: { type: 'string' }, status: { enum: ['met', 'gap', 'unknown'] } } } },
        annex_iv_gaps: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number' },
      },
    },
    capabilities: ['classify.risk', 'audit.documentation', 'cite.regulation'],
    model: 'claude-opus-5-5',
    license: 'BSL-1.1',
    transport: 'a2a/http+json',
    endpoint: null,
    isSeed: true,
    publishedAt: '2026-08-02',
  },
  {
    id: 'pg-query-optimizer',
    name: 'pg-query-optimizer',
    version: '3.0.4',
    author: 'dbforge',
    tagline: 'Reads EXPLAIN ANALYZE output, rewrites the SQL and proposes indexes with measured before/after cost.',
    value: 'Makes a slow Postgres query fast and tells you which index to add, with the before/after numbers.',
    framework: 'MCP Server',
    category: 'Data & Analytics',
    grade: 'AA',
    score: 80,
    auditedAt: '2026-10-05',
    benchmark: { passRate: 97.2, passed: 47, total: 48, ranAt: '2026-10-05' },
    successRate: 97.2,
    costPerRun: 0.006,
    avgLatencyMs: 6900,
    runs30d: 96_410,
    tools: ['Postgres', 'EXPLAIN Analyzer', 'pg_stat_statements', 'Index Advisor'],
    tags: ['sql', 'postgres', 'database', 'performance', 'index', 'query'],
    readme: `pg-query-optimizer connects to a read-only replica, pulls the slowest statements from pg_stat_statements, and iterates on each one: run EXPLAIN (ANALYZE, BUFFERS), identify the dominant node, propose a rewrite or an index, re-run, compare.

It refuses to apply anything. Every suggestion comes with the measured planner cost delta and the actual execution-time delta on the replica, so a human can decide. CREATE INDEX CONCURRENTLY statements are emitted as copy-pasteable migrations.

Works with Postgres 13 through 18, including partitioned tables and JSONB GIN indexes.`,
    useCases: [
      'Weekly "top 20 slowest queries" report with proposed fixes',
      'CI step: fail the build if a new migration introduces a sequential scan on a table > 1M rows',
      'Interactive tuning session from Claude Code against a staging replica',
    ],
    inputSchema: {
      type: 'object',
      required: ['connection'],
      properties: {
        connection: { type: 'string', description: 'postgres:// URI, read-only role' },
        query: { type: 'string', description: 'Optional single statement to tune' },
        top_n: { type: 'integer', default: 20 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              original_sql: { type: 'string' },
              rewritten_sql: { type: 'string' },
              migration: { type: 'string' },
              cost_before: { type: 'number' },
              cost_after: { type: 'number' },
              time_before_ms: { type: 'number' },
              time_after_ms: { type: 'number' },
            },
          },
        },
      },
    },
    capabilities: ['explain.analyze', 'rewrite.sql', 'advise.index'],
    model: 'claude-sonnet-5-5',
    license: 'MIT',
    transport: 'mcp/stdio',
    endpoint: null,
    isSeed: true,
    publishedAt: '2026-10-05',
  },
  {
    id: 'sec-filings-analyzer',
    name: 'sec-filings-analyzer',
    version: '1.2.7',
    author: 'quantcrew',
    tagline: 'Three-agent crew that parses 10-K / 10-Q filings and surfaces material changes versus prior periods.',
    value: 'Reads a company’s annual and quarterly filings and flags what changed since last time.',
    framework: 'CrewAI',
    category: 'Finance',
    grade: 'AA',
    score: 80,
    auditedAt: '2026-07-19',
    benchmark: { passRate: 95.1, passed: 46, total: 48, ranAt: '2026-07-19' },
    successRate: 95.1,
    costPerRun: 0.087,
    avgLatencyMs: 52_000,
    runs30d: 8_230,
    tools: ['EDGAR API', 'Pandas', 'XBRL Parser', 'Charting'],
    tags: ['finance', 'sec', '10-k', 'edgar', 'earnings', 'equity research'],
    readme: `sec-filings-analyzer is a CrewAI crew of three specialised agents: a Retriever that pulls filings and XBRL facts from EDGAR, an Analyst that diffs risk factors, MD&A and footnotes against the prior period, and a Writer that produces a one-page brief with charts.

The crew is deliberately conservative: every numeric claim is backed by an XBRL fact ID, and narrative claims quote the filing verbatim with a section anchor. Forward-looking interpretation is flagged as such.

Not investment advice. Built for analysts who want the first 80% of the reading done.`,
    useCases: [
      'Earnings-season triage across a watchlist of 50 tickers',
      'Flag new litigation or going-concern language the moment a filing lands',
      'Historical risk-factor drift analysis over 5 years',
    ],
    inputSchema: {
      type: 'object',
      required: ['ticker'],
      properties: {
        ticker: { type: 'string' },
        form: { enum: ['10-K', '10-Q', '8-K'], default: '10-K' },
        compare_to: { type: 'string', description: 'Accession number of prior filing (optional)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        material_changes: { type: 'array', items: { type: 'object', properties: { section: { type: 'string' }, change: { type: 'string' }, quote: { type: 'string' } } } },
        key_metrics: { type: 'object' },
        charts: { type: 'array', items: { type: 'string', format: 'uri' } },
      },
    },
    capabilities: ['fetch.edgar', 'diff.filings', 'chart.metrics'],
    model: 'claude-sonnet-5-5',
    license: 'MIT',
    transport: 'a2a/http+json',
    endpoint: null,
    isSeed: true,
    publishedAt: '2026-07-19',
  },
  {
    id: 'smart-contract-sentinel',
    name: 'smart-contract-sentinel',
    version: '0.9.2',
    author: 'blockwatch',
    tagline: 'Adversarial multi-agent audit for Solidity: one agent attacks, one defends, one writes the PoC test.',
    value: 'Finds exploitable bugs in a Solidity contract and writes the proof-of-concept test for each one.',
    framework: 'AutoGen',
    category: 'Security & Audit',
    grade: 'AAA',
    score: 95,
    auditedAt: '2026-10-21',
    benchmark: { passRate: 93.8, passed: 45, total: 48, ranAt: '2026-10-21' },
    successRate: 93.8,
    costPerRun: 0.124,
    avgLatencyMs: 91_000,
    runs30d: 3_410,
    tools: ['Slither', 'Foundry', 'Etherscan API', 'Mythril'],
    tags: ['solidity', 'smart contract', 'security', 'web3', 'audit', 'defi', 'evm'],
    readme: `smart-contract-sentinel runs an AutoGen group chat with three roles. The Attacker reads the contract and Slither/Mythril output and proposes exploit hypotheses (reentrancy, oracle manipulation, access control, integer edge cases). The Defender argues why each hypothesis fails. The Prover writes a Foundry test for every hypothesis the Defender could not refute, and runs it.

Only hypotheses with a passing exploit test are reported as findings. This keeps the false-positive rate far below static analysers alone, at the cost of long runs.

Supports Solidity 0.8.x, verified sources from Etherscan, and local Foundry projects.`,
    useCases: [
      'Pre-deployment audit of a new vault or staking contract',
      'Continuous monitoring: re-audit on every push to the contracts/ directory',
      'Second opinion on a third-party audit report',
    ],
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Verified contract address (0x…)' },
        source_path: { type: 'string', description: 'Local Foundry project path' },
        chain: { enum: ['ethereum', 'base', 'arbitrum', 'optimism'], default: 'ethereum' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        findings: { type: 'array', items: { type: 'object', properties: { severity: { enum: ['critical', 'high', 'medium', 'low'] }, title: { type: 'string' }, poc_test: { type: 'string' }, line: { type: 'integer' } } } },
        refuted_hypotheses: { type: 'integer' },
      },
    },
    capabilities: ['scan.static', 'attack.hypothesize', 'prove.exploit'],
    model: 'claude-opus-5-5',
    license: 'AGPL-3.0',
    transport: 'a2a/http+json',
    endpoint: null,
    isSeed: true,
    publishedAt: '2026-10-21',
  },
  {
    id: 'linkedin-outreach-agent',
    name: 'linkedin-outreach-agent',
    version: '1.1.0',
    author: 'growthmesh',
    tagline: 'A2A-native outbound agent that researches an account, drafts a sequence and hands off replies to your CRM agent.',
    value: 'Researches a prospect, writes a short outreach sequence and hands replies to your CRM.',
    framework: 'Custom A2A',
    category: 'Marketing',
    grade: 'B',
    score: 40,
    auditedAt: '2026-09-28',
    benchmark: { passRate: 91.3, passed: 44, total: 48, ranAt: '2026-09-28' },
    successRate: 91.3,
    costPerRun: 0.018,
    avgLatencyMs: 14_500,
    runs30d: 27_880,
    tools: ['LinkedIn API', 'CRM Sync', 'Email', 'Company Enrichment'],
    tags: ['marketing', 'outbound', 'sales', 'linkedin', 'crm', 'a2a', 'prospecting'],
    readme: `linkedin-outreach-agent speaks the A2A protocol natively. It exposes an Agent Card, accepts tasks from any A2A client, and delegates sub-tasks (enrichment, CRM writes) to other agents in your mesh instead of bundling every tool itself.

Given an account, it builds a short research brief from licensed data, drafts a 3-touch sequence (connection note, follow-up, breakup) in your voice, and pauses for human approval before anything is sent. Replies are routed as A2A tasks to the CRM agent you configure.

Security grade is B because the agent requires write scopes on LinkedIn and your CRM. Review the scope list in the manifest before installing.`,
    useCases: [
      'Signal-based outbound: trigger a sequence when a target account posts a job',
      'Hand-off demo: run alongside a CRM agent to show A2A delegation end to end',
      'Weekly batch of 50 accounts with human approval queue',
    ],
    inputSchema: {
      type: 'object',
      required: ['account'],
      properties: {
        account: { type: 'string', description: 'Company domain or LinkedIn URL' },
        persona: { type: 'string' },
        tone: { enum: ['direct', 'warm', 'technical'], default: 'direct' },
        approve_before_send: { type: 'boolean', default: true },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        brief: { type: 'string' },
        sequence: { type: 'array', items: { type: 'object', properties: { step: { type: 'integer' }, channel: { enum: ['linkedin', 'email'] }, body: { type: 'string' } } } },
        handoff_task_id: { type: 'string' },
      },
    },
    capabilities: ['research.account', 'draft.sequence', 'delegate.crm'],
    model: 'claude-haiku-5-5',
    license: 'Proprietary',
    transport: 'a2a/http+json',
    endpoint: null,
    isSeed: true,
    publishedAt: '2026-09-28',
  },
];
