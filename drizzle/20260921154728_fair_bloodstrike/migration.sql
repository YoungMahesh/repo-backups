ALTER TABLE "github_installations" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "disconnected_at" timestamp;