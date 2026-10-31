import { boolean, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
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
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>().notNull().default({}),
    model: varchar('model', { length: 64 }).notNull().default('unspecified'),
    license: varchar('license', { length: 64 }).notNull().default('UNLICENSED'),
    transport: varchar('transport', { length: 32 }).notNull().default('a2a/http+json'),
    endpoint: text('endpoint'),
    latestVersion: varchar('latest_version', { length: 32 }).notNull(),
    isSeed: boolean('is_seed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('agents_name_idx').on(t.name)],
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('agent_versions_agent_version_idx').on(t.agentId, t.version)],
);

export type AgentRow = typeof agents.$inferSelect;
export type NewAgentRow = typeof agents.$inferInsert;
