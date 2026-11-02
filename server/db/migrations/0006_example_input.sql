ALTER TABLE "agents" ADD COLUMN "example_input" jsonb;--> statement-breakpoint
UPDATE "agents" a SET "example_input" = v."manifest"->'spec'->'tests'->0->'input'
FROM "agent_versions" v
WHERE v."agent_id" = a."id" AND v."version" = a."latest_version"
  AND jsonb_typeof(v."manifest"->'spec'->'tests'->0->'input') = 'object';
