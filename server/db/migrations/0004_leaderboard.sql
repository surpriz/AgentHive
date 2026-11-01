CREATE TABLE "leaderboard_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"day" varchar(10) NOT NULL,
	"category" varchar(32) NOT NULL,
	"agent_id" text NOT NULL,
	"rank" integer NOT NULL,
	"score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leaderboard_day_category_agent_idx" ON "leaderboard_snapshots" USING btree ("day","category","agent_id");--> statement-breakpoint
CREATE INDEX "leaderboard_agent_day_idx" ON "leaderboard_snapshots" USING btree ("agent_id","day");