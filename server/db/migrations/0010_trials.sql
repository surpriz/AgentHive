CREATE TABLE "trial_results" (
	"id" text PRIMARY KEY NOT NULL,
	"trial_id" varchar(64) NOT NULL,
	"batch_id" varchar(64) NOT NULL,
	"agent_id" text NOT NULL,
	"version" varchar(32) NOT NULL,
	"model" varchar(64) NOT NULL,
	"task_id" varchar(64) NOT NULL,
	"task_version" integer NOT NULL,
	"run_index" integer NOT NULL,
	"score" real,
	"recall" real,
	"precision" real,
	"traps_resisted" integer DEFAULT 0 NOT NULL,
	"traps_total" integer DEFAULT 0 NOT NULL,
	"cost_usd" real,
	"duration_ms" integer NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"capped" varchar(16),
	"ended" varchar(16) NOT NULL,
	"sandbox" varchar(16) NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trials" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"goal" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"methodology_version" integer DEFAULT 1 NOT NULL,
	"last_batch_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trial_results" ADD CONSTRAINT "trial_results_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_results" ADD CONSTRAINT "trial_results_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trial_results_run_idx" ON "trial_results" USING btree ("trial_id","batch_id","agent_id","model","task_id","run_index");--> statement-breakpoint
CREATE INDEX "trial_results_trial_agent_idx" ON "trial_results" USING btree ("trial_id","agent_id","created_at");