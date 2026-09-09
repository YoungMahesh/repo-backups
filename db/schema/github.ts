import { relations } from "drizzle-orm/_relations";
import { pgTable, text, timestamp, boolean, index, bigint, integer } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    installationId: bigint("installation_id", { mode: "number" })
      .notNull()
      .unique(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(), // "Organization" | "User"
    avatarUrl: text("avatar_url"),
    targetType: text("target_type").notNull(), // "selected" | "all"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("github_installations_userId_idx").on(table.userId)],
);

export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    installationId: text("installation_id")
      .notNull()
      .references(() => githubInstallations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    githubRepoId: bigint("github_repo_id", { mode: "number" })
      .notNull()
      .unique(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    isPrivate: boolean("is_private").notNull().default(false),
    defaultBranch: text("default_branch").notNull().default("main"),
    backupEnabled: boolean("backup_enabled").notNull().default(false),
    backupSchedule: text("backup_schedule").notNull().default("daily"), // "daily" | "weekly" | "manual"
    lastBackupAt: timestamp("last_backup_at"),
    lastBackupStatus: text("last_backup_status"), // "success" | "failed" | "pending"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("github_repositories_installationId_idx").on(table.installationId),
    index("github_repositories_userId_idx").on(table.userId),
  ],
);

export const backupJobs = pgTable(
  "backup_jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // "pending" | "running" | "completed" | "failed"
    triggerType: text("trigger_type").notNull().default("manual"), // "manual" | "scheduled"
    s3Bucket: text("s3_bucket"),
    s3Key: text("s3_key"),
    bundleSizeBytes: bigint("bundle_size_bytes", { mode: "number" }),
    commitSha: text("commit_sha"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("backup_jobs_repositoryId_idx").on(table.repositoryId),
    index("backup_jobs_userId_idx").on(table.userId),
  ],
);

export const githubInstallationsRelations = relations(
  githubInstallations,
  ({ one, many }) => ({
    user: one(user, {
      fields: [githubInstallations.userId],
      references: [user.id],
    }),
    repositories: many(githubRepositories),
  }),
);

export const githubRepositoriesRelations = relations(
  githubRepositories,
  ({ one, many }) => ({
    installation: one(githubInstallations, {
      fields: [githubRepositories.installationId],
      references: [githubInstallations.id],
    }),
    user: one(user, {
      fields: [githubRepositories.userId],
      references: [user.id],
    }),
    backupJobs: many(backupJobs),
  }),
);

export const backupJobsRelations = relations(backupJobs, ({ one }) => ({
  repository: one(githubRepositories, {
    fields: [backupJobs.repositoryId],
    references: [githubRepositories.id],
  }),
  user: one(user, {
    fields: [backupJobs.userId],
    references: [user.id],
  }),
}));
