ALTER TABLE "agent_versions" ADD COLUMN "files" jsonb;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD COLUMN "sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "api_version" varchar(8) DEFAULT 'v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "goal" varchar(32);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "bricks" jsonb;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "settings" jsonb;