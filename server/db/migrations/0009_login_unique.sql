UPDATE "user" u SET "login" = u."login" || '-' || substr(u."id", 1, 6)
WHERE u."id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "login" ORDER BY "created_at", "id") AS rn FROM "user" WHERE "login" IS NOT NULL
  ) d WHERE d.rn > 1
);--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_login_unique" UNIQUE("login");
