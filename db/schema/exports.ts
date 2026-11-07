import { relations } from "drizzle-orm/_relations";
import { pgTable, text, timestamp, boolean, index, bigint, integer, jsonb } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const bundleExports = pgTable(
  "bundle_exports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // "pending" | "processing" | "completed" | "failed" | "expired"
    s3Bucket: text("s3_bucket"),
    s3Key: text("s3_key"),
    totalSizeBytes: bigint("total_size_bytes", { mode: "number" }).default(0).notNull(),
    repositoryCount: integer("repository_count").default(0).notNull(),
    bundleCount: integer("bundle_count").default(0).notNull(),
    selectedPeriod: text("selected_period").notNull().default("last_month"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    includeAllSnapshots: boolean("include_all_snapshots").default(false).notNull(),
    repositoryIds: jsonb("repository_ids").$type<string[]>().default([]).notNull(),
    errorMessage: text("error_message"),
    expiresAt: timestamp("expires_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("bundle_exports_userId_idx").on(table.userId),
    index("bundle_exports_createdAt_idx").on(table.createdAt),
    index("bundle_exports_status_idx").on(table.status),
  ],
);

export const bundleExportsRelations = relations(bundleExports, ({ one }) => ({
  user: one(user, {
    fields: [bundleExports.userId],
    references: [user.id],
  }),
}));
