CREATE TABLE "backup_jobs" (
	"id" text PRIMARY KEY,
	"repository_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trigger_type" text DEFAULT 'manual' NOT NULL,
	"s3_bucket" text,
	"s3_key" text,
	"bundle_size_bytes" bigint,
	"commit_sha" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"installation_id" bigint NOT NULL UNIQUE,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"avatar_url" text,
	"target_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" text PRIMARY KEY,
	"installation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"github_repo_id" bigint NOT NULL UNIQUE,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"backup_enabled" boolean DEFAULT false NOT NULL,
	"backup_schedule" text DEFAULT 'daily' NOT NULL,
	"last_backup_at" timestamp,
	"last_backup_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "backup_jobs_repositoryId_idx" ON "backup_jobs" ("repository_id");--> statement-breakpoint
CREATE INDEX "backup_jobs_userId_idx" ON "backup_jobs" ("user_id");--> statement-breakpoint
CREATE INDEX "github_installations_userId_idx" ON "github_installations" ("user_id");--> statement-breakpoint
CREATE INDEX "github_repositories_installationId_idx" ON "github_repositories" ("installation_id");--> statement-breakpoint
CREATE INDEX "github_repositories_userId_idx" ON "github_repositories" ("user_id");--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_repository_id_github_repositories_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_3Yap1KBFuLrF_fkey" FOREIGN KEY ("installation_id") REFERENCES "github_installations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;