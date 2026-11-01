CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"agent_version" varchar(32) NOT NULL,
	"caller_id" text NOT NULL,
	"caller_login" varchar(64) NOT NULL,
	"via" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"http_status" integer,
	"latency_ms" integer NOT NULL,
	"request_bytes" integer DEFAULT 0 NOT NULL,
	"response_bytes" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "gateway_secret" text;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_caller_id_user_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_agent_created_idx" ON "runs" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_caller_created_idx" ON "runs" USING btree ("caller_id","created_at");