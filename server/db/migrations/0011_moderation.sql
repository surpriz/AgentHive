CREATE TABLE "agent_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"reporter_id" text,
	"reporter_email" varchar(200),
	"reason" varchar(16) NOT NULL,
	"details" text NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "hidden_reason" varchar(32);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "pulls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_reports" ADD CONSTRAINT "agent_reports_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reports" ADD CONSTRAINT "agent_reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_reports_agent_created_idx" ON "agent_reports" USING btree ("agent_id","created_at");