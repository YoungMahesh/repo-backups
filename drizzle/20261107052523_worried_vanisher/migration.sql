CREATE TABLE "bundle_exports" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"s3_bucket" text,
	"s3_key" text,
	"total_size_bytes" bigint DEFAULT 0 NOT NULL,
	"repository_count" integer DEFAULT 0 NOT NULL,
	"bundle_count" integer DEFAULT 0 NOT NULL,
	"selected_period" text DEFAULT 'last_month' NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"include_all_snapshots" boolean DEFAULT false NOT NULL,
	"repository_ids" jsonb DEFAULT '[]' NOT NULL,
	"error_message" text,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bundle_exports_userId_idx" ON "bundle_exports" ("user_id");--> statement-breakpoint
CREATE INDEX "bundle_exports_createdAt_idx" ON "bundle_exports" ("created_at");--> statement-breakpoint
CREATE INDEX "bundle_exports_status_idx" ON "bundle_exports" ("status");--> statement-breakpoint
ALTER TABLE "bundle_exports" ADD CONSTRAINT "bundle_exports_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;