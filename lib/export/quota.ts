import { db } from "@/db";
import { bundleExports } from "@/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";

export const MAX_ROLLING_QUOTA_BYTES = 30 * 1024 * 1024 * 1024; // 30 GiB
export const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface UserQuotaUsage {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  hasActiveJob: boolean;
  activeJobId?: string;
}

/**
 * Calculates a user's 24-hour rolling export quota usage.
 * Only successfully completed exports consume quota.
 * Active (pending/processing) exports block new requests until finished.
 */
export async function getUserRollingQuotaUsage(userId: string): Promise<UserQuotaUsage> {
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_MS);

  // 1. Fetch completed exports in the last 24h
  const completedExports = await db
    .select({
      totalSizeBytes: bundleExports.totalSizeBytes,
    })
    .from(bundleExports)
    .where(
      and(
        eq(bundleExports.userId, userId),
        eq(bundleExports.status, "completed"),
        gte(bundleExports.createdAt, windowStart),
      ),
    );

  const usedBytes = completedExports.reduce((sum, item) => sum + Number(item.totalSizeBytes || 0), 0);
  const remainingBytes = Math.max(0, MAX_ROLLING_QUOTA_BYTES - usedBytes);

  // 2. Check for active in-flight exports
  const activeJobs = await db
    .select({
      id: bundleExports.id,
    })
    .from(bundleExports)
    .where(
      and(
        eq(bundleExports.userId, userId),
        inArray(bundleExports.status, ["pending", "processing"]),
      ),
    )
    .limit(1);

  const hasActiveJob = activeJobs.length > 0;
  const activeJobId = activeJobs[0]?.id;

  return {
    usedBytes,
    limitBytes: MAX_ROLLING_QUOTA_BYTES,
    remainingBytes,
    hasActiveJob,
    activeJobId,
  };
}
