import type { AgentBricks, AgentSetting } from '../../src/types';
import { index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export const GRADES = ['pending', 'B', 'A', 'AA', 'AAA'] as const;
export type Grade = (typeof GRADES)[number];

export const agents = pgTable(
  'agents',
  {
    id: text('id').primaryKey(),
    name: varchar('name', { length: 48 }).notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    author: varchar('author', { length: 64 }).notNull(),
    value: text('value').notNull(),
    tagline: text('tagline').notNull(),
    framework: varchar('framework', { length: 32 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    grade: varchar('grade', { length: 8 }).$type<Grade>().notNull().default('pending'),
    /** Audit score 0–100; null until audited. Seeds carry illustrative values. */
    score: integer('score'),
    auditedAt: timestamp('audited_at', { withTimezone: true }),
    successRate: real('success_rate'),
    costPerRun: real('cost_per_run'),
    avgLatencyMs: integer('avg_latency_ms'),
    runs30d: integer('runs_30d').notNull().default(0),
    tools: jsonb('tools').$type<string[]>().notNull().default([]),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]),
    readme: text('readme').notNull().default(''),
    useCases: jsonb('use_cases').$type<string[]>().notNull().default([]),
    inputSchema: jsonb('input_schema').$type<Record<string, unknown>>().notNull().default({}),
    /** First author test input, offered as the ready-to-run example on the Run tab. */
    exampleInput: jsonb('example_input').$type<Record<string, unknown>>(),
    /** `v1`: hosted by the author behind an endpoint. `v2`: declarative package (prompt, skills, MCP bricks). */
    apiVersion: varchar('api_version', { length: 8 }).notNull().default('v1'),
    goal: varchar('goal', { length: 32 }),
    bricks: jsonb('bricks').$type<AgentBricks>(),
    settings: jsonb('settings').$type<AgentSetting[]>(),
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>().notNull().default({}),
    model: varchar('model', { length: 64 }).notNull().default('unspecified'),
    license: varchar('license', { length: 64 }).notNull().default('UNLICENSED'),
    transport: varchar('transport', { length: 32 }).notNull().default('a2a/http+json'),
    endpoint: text('endpoint'),
    latestVersion: varchar('latest_version', { length: 32 }).notNull(),
    /** HMAC key the gateway signs upstream requests with; shown to the owner, rotatable. */
    gatewaySecret: text('gateway_secret'),
    /** Latest benchmark, mirrored for the index. */
    benchmarkPassRate: real('benchmark_pass_rate'),
    benchmarkAt: timestamp('benchmark_at', { withTimezone: true }),
    /** Set when the agent is off the catalog: unpublished by its owner or taken down after a report. The name keeps a tombstone. */
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenReason: varchar('hidden_reason', { length: 32 }).$type<HiddenReason>(),
    /** Package retrievals (package.json fetches by the CLI, a tool, or the copy prompt). */
    pulls: integer('pulls').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('agents_name_idx').on(t.name)],
);

export const HIDDEN_REASONS = ['unpublished', 'security', 'rights', 'other'] as const;
export type HiddenReason = (typeof HIDDEN_REASONS)[number];

export const REPORT_REASONS = ['security', 'rights', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** A report filed from a card or by API; reviewed by an admin, who hides the agent or dismisses it. */
export const agentReports = pgTable(
  'agent_reports',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    reporterId: text('reporter_id').references(() => user.id, { onDelete: 'set null' }),
    reporterEmail: varchar('reporter_email', { length: 200 }),
    reason: varchar('reason', { length: 16 }).$type<ReportReason>().notNull(),
    details: text('details').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('agent_reports_agent_created_idx').on(t.agentId, t.createdAt)],
);

export const agentVersions = pgTable(
  'agent_versions',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 32 }).notNull(),
    manifest: jsonb('manifest').$type<Record<string, unknown>>().notNull(),
    /** v2 package files, path → text. Null for v1 manifests. */
    files: jsonb('files').$type<Record<string, string>>(),
    /** SHA-256 of the canonical package (manifest + files); the version is immutable. */
    sha256: varchar('sha256', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('agent_versions_agent_version_idx').on(t.agentId, t.version)],
);

export const audits = pgTable(
  'audits',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 32 }).notNull(),
    grade: varchar('grade', { length: 8 }).$type<Grade>().notNull(),
    score: integer('score').notNull(),
    report: jsonb('report').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audits_agent_created_idx').on(t.agentId, t.createdAt)],
);

export const RUN_STATUSES = ['queued', 'running', 'ok', 'upstream_error', 'timeout', 'blocked', 'bad_request', 'lost'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const runs = pgTable(
  'runs',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    agentVersion: varchar('agent_version', { length: 32 }).notNull(),
    callerId: text('caller_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    callerLogin: varchar('caller_login', { length: 64 }).notNull(),
    via: varchar('via', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).$type<RunStatus>().notNull(),
    httpStatus: integer('http_status'),
    latencyMs: integer('latency_ms').notNull(),
    requestBytes: integer('request_bytes').notNull().default(0),
    responseBytes: integer('response_bytes').notNull().default(0),
    error: text('error'),
    /** sync | async */
    mode: varchar('mode', { length: 8 }).notNull().default('sync'),
    /** Upstream body kept for async retrieval (capped), null for sync runs. */
    responseBody: text('response_body'),
    webhookUrl: text('webhook_url'),
    webhookStatus: varchar('webhook_status', { length: 16 }),
    webhookAttempts: integer('webhook_attempts').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('runs_agent_created_idx').on(t.agentId, t.createdAt), index('runs_caller_created_idx').on(t.callerId, t.createdAt)],
);

/** Per-caller secret the gateway signs webhook deliveries with. */
export const webhookSecrets = pgTable('webhook_secrets', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const benchmarks = pgTable(
  'benchmarks',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 32 }).notNull(),
    passed: integer('passed').notNull(),
    total: integer('total').notNull(),
    passRate: real('pass_rate').notNull(),
    trigger: varchar('trigger', { length: 16 }).notNull(),
    results: jsonb('results').$type<Record<string, unknown>[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('benchmarks_agent_created_idx').on(t.agentId, t.createdAt)],
);

export const leaderboardSnapshots = pgTable(
  'leaderboard_snapshots',
  {
    id: text('id').primaryKey(),
    /** ISO date (UTC) the snapshot describes. */
    day: varchar('day', { length: 10 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    score: real('score').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('leaderboard_day_category_agent_idx').on(t.day, t.category, t.agentId), index('leaderboard_agent_day_idx').on(t.agentId, t.day)],
);

/** A trial: one measured professional goal, with its own task set and methodology version. */
export const trials = pgTable('trials', {
  id: varchar('id', { length: 64 }).primaryKey(),
  goal: varchar('goal', { length: 32 }).notNull(),
  title: text('title').notNull(),
  methodologyVersion: integer('methodology_version').notNull().default(1),
  lastBatchAt: timestamp('last_batch_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One harness run of one package on one task, posted by the batch runner. `record` holds the full trace. */
export const trialResults = pgTable(
  'trial_results',
  {
    id: text('id').primaryKey(),
    trialId: varchar('trial_id', { length: 64 })
      .notNull()
      .references(() => trials.id, { onDelete: 'cascade' }),
    batchId: varchar('batch_id', { length: 64 }).notNull(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: 32 }).notNull(),
    model: varchar('model', { length: 64 }).notNull(),
    taskId: varchar('task_id', { length: 64 }).notNull(),
    taskVersion: integer('task_version').notNull(),
    runIndex: integer('run_index').notNull(),
    score: real('score'),
    recall: real('recall'),
    precision: real('precision'),
    trapsResisted: integer('traps_resisted').notNull().default(0),
    trapsTotal: integer('traps_total').notNull().default(0),
    costUsd: real('cost_usd'),
    durationMs: integer('duration_ms').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    capped: varchar('capped', { length: 16 }),
    ended: varchar('ended', { length: 16 }).notNull(),
    sandbox: varchar('sandbox', { length: 16 }).notNull(),
    record: jsonb('record').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('trial_results_run_idx').on(t.trialId, t.batchId, t.agentId, t.model, t.taskId, t.runIndex),
    index('trial_results_trial_agent_idx').on(t.trialId, t.agentId, t.createdAt),
  ],
);

export type TrialResultRow = typeof trialResults.$inferSelect;
export type BenchmarkRow = typeof benchmarks.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type AuditRow = typeof audits.$inferSelect;
export type AgentRow = typeof agents.$inferSelect;
export type NewAgentRow = typeof agents.$inferInsert;
