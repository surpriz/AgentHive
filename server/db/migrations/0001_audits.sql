CREATE TABLE "audits" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" varchar(32) NOT NULL,
	"grade" varchar(8) NOT NULL,
	"score" integer NOT NULL,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "audited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audits_agent_created_idx" ON "audits" USING btree ("agent_id","created_at");