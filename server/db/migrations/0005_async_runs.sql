CREATE TABLE "webhook_secrets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"rotated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "mode" varchar(8) DEFAULT 'sync' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "response_body" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "webhook_status" varchar(16);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "webhook_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_secrets" ADD CONSTRAINT "webhook_secrets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;