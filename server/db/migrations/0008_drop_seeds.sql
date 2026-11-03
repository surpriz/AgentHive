DELETE FROM "agents" WHERE "is_seed" = true;--> statement-breakpoint
DELETE FROM "user" WHERE "id" LIKE 'seed-%' AND "email" LIKE '%@seed.agenthive.sh';--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "is_seed";