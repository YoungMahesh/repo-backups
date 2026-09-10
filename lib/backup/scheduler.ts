import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { githubRepositories, githubInstallations } from "@/db/schema";
import { executeBackupJob, ExecuteBackupJobResult } from "@/lib/backup/engine";

export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface DueCheckableRepository {
  backupEnabled: boolean;
  backupSchedule: string;
  lastBackupAt?: Date | string | null;
}

/**
 * Checks whether a repository is eligible for a scheduled backup.
 * - Enrolled repositories with "daily" schedule are due if >= 24h elapsed or never backed up.
 * - Enrolled repositories with "weekly" schedule are due if >= 7d elapsed or never backed up.
 * - Repositories with "manual" schedule or disabled backups are never automatically due.
 */
export function isRepositoryDue(
  repo: DueCheckableRepository,
  now: Date = new Date(),
): boolean {
  if (!repo.backupEnabled) return false;
  if (repo.backupSchedule !== "daily" && repo.backupSchedule !== "weekly") {
    return false;
  }

  if (!repo.lastBackupAt) {
    return true;
  }

  const lastTime = new Date(repo.lastBackupAt).getTime();
  if (isNaN(lastTime)) {
    return true;
  }

  const elapsedMs = now.getTime() - lastTime;

  if (repo.backupSchedule === "daily") {
    return elapsedMs >= DAILY_INTERVAL_MS;
  }

  if (repo.backupSchedule === "weekly") {
    return elapsedMs >= WEEKLY_INTERVAL_MS;
  }

  return false;
}

/**
 * Calculates the next scheduled backup time for a repository.
 * Returns null if the repository is not enrolled or on a manual schedule.
 */
export function getNextBackupTime(
  repo: DueCheckableRepository,
): Date | null {
  if (!repo.backupEnabled || repo.backupSchedule === "manual") {
    return null;
  }

  if (!repo.lastBackupAt) {
    return new Date(); // Due immediately
  }

  const lastTime = new Date(repo.lastBackupAt).getTime();
  if (isNaN(lastTime)) {
    return new Date();
  }

  if (repo.backupSchedule === "daily") {
    return new Date(lastTime + DAILY_INTERVAL_MS);
  }

  if (repo.backupSchedule === "weekly") {
    return new Date(lastTime + WEEKLY_INTERVAL_MS);
  }

  return null;
}

export interface DueRepositoryRecord {
  id: string;
  userId: string;
  name: string;
  fullName: string;
  backupEnabled: boolean;
  backupSchedule: string;
  lastBackupAt: Date | null;
  accountLogin: string;
}

/**
 * Identifies all enrolled repositories whose scheduled backup intervals have elapsed.
 */
export async function findDueRepositories(
  now: Date = new Date(),
): Promise<DueRepositoryRecord[]> {
  const candidates = await db
    .select({
      id: githubRepositories.id,
      userId: githubRepositories.userId,
      name: githubRepositories.name,
      fullName: githubRepositories.fullName,
      backupEnabled: githubRepositories.backupEnabled,
      backupSchedule: githubRepositories.backupSchedule,
      lastBackupAt: githubRepositories.lastBackupAt,
      accountLogin: githubInstallations.accountLogin,
    })
    .from(githubRepositories)
    .innerJoin(
      githubInstallations,
      eq(githubRepositories.installationId, githubInstallations.id),
    )
    .where(
      and(
        eq(githubRepositories.backupEnabled, true),
        inArray(githubRepositories.backupSchedule, ["daily", "weekly"]),
      ),
    );

  return candidates.filter((repo) => isRepositoryDue(repo, now));
}

export interface ScheduledBackupResultItem {
  repositoryId: string;
  fullName: string;
  success: boolean;
  jobId?: string;
  commitSha?: string | null;
  bundleSizeBytes?: number | null;
  error?: string;
}

export interface ScheduledBackupsRunSummary {
  success: boolean;
  timestamp: string;
  dueCount: number;
  processedCount: number;
  results: ScheduledBackupResultItem[];
}

/**
 * Executes scheduled backups for all due repositories with triggerType = "scheduled".
 */
export async function runScheduledBackups(options?: {
  now?: Date;
}): Promise<ScheduledBackupsRunSummary> {
  const checkTime = options?.now || new Date();
  const dueRepos = await findDueRepositories(checkTime);
  const results: ScheduledBackupResultItem[] = [];

  for (const repo of dueRepos) {
    try {
      const outcome: ExecuteBackupJobResult = await executeBackupJob({
        repositoryId: repo.id,
        userId: repo.userId,
        triggerType: "scheduled",
      });

      results.push({
        repositoryId: repo.id,
        fullName: repo.fullName,
        success: outcome.success,
        jobId: outcome.job.id,
        commitSha: outcome.job.commitSha,
        bundleSizeBytes: outcome.job.bundleSizeBytes,
        error: outcome.error,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        repositoryId: repo.id,
        fullName: repo.fullName,
        success: false,
        error: errorMsg,
      });
    }
  }

  return {
    success: true,
    timestamp: checkTime.toISOString(),
    dueCount: dueRepos.length,
    processedCount: results.length,
    results,
  };
}
