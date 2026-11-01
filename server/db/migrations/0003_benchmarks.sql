CREATE TABLE "benchmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" varchar(32) NOT NULL,
	"passed" integer NOT NULL,
	"total" integer NOT NULL,
	"pass_rate" real NOT NULL,
	"trigger" varchar(16) NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "benchmark_pass_rate" real;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "benchmark_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "benchmarks" ADD CONSTRAINT "benchmarks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "benchmarks_agent_created_idx" ON "benchmarks" USING btree ("agent_id","created_at");