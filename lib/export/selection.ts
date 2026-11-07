import { db } from "@/db";
import { backupJobs, githubRepositories, githubInstallations } from "@/db/schema";
import { and, eq, gte, lte, inArray, isNotNull, desc } from "drizzle-orm";

export interface PeriodResolution {
  period: string;
  startDate?: Date;
  endDate?: Date;
}

export function resolvePeriodDates(
  period: string = "last_month",
  customStart?: string | Date,
  customEnd?: string | Date,
): PeriodResolution {
  const now = new Date();

  switch (period) {
    case "last_7_days":
      return {
        period,
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: now,
      };
    case "last_30_days":
    case "last_month":
      return {
        period: "last_month",
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: now,
      };
    case "last_90_days":
      return {
        period,
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        endDate: now,
      };
    case "all_time":
      return {
        period,
        startDate: undefined,
        endDate: now,
      };
    case "custom":
      return {
        period,
        startDate: customStart ? new Date(customStart) : undefined,
        endDate: customEnd ? new Date(customEnd) : now,
      };
    default:
      return {
        period: "last_month",
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: now,
      };
  }
}

export interface ExportCandidate {
  jobId: string;
  repositoryId: string;
  repositoryName: string;
  fullName: string;
  accountLogin: string;
  commitSha: string;
  bundleSizeBytes: number;
  s3Bucket: string;
  s3Key: string;
  completedAt: Date;
}

export interface GetExportCandidatesParams {
  userId: string;
  repositoryIds?: string[];
  period?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  includeAllSnapshots?: boolean;
}

export interface ExportSelectionResult {
  candidates: ExportCandidate[];
  totalSizeBytes: number;
  repositoryCount: number;
  bundleCount: number;
  period: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Evaluates matching backup jobs according to user criteria.
 * By default, selects only the latest successful bundle per repository.
 */
export async function getExportCandidates(
  params: GetExportCandidatesParams,
): Promise<ExportSelectionResult> {
  const { period, startDate, endDate } = resolvePeriodDates(
    params.period,
    params.startDate,
    params.endDate,
  );

  const conditions = [
    eq(backupJobs.userId, params.userId),
    eq(backupJobs.status, "completed"),
    isNotNull(backupJobs.s3Bucket),
    isNotNull(backupJobs.s3Key),
  ];

  if (params.repositoryIds && params.repositoryIds.length > 0) {
    conditions.push(inArray(backupJobs.repositoryId, params.repositoryIds));
  }

  if (startDate) {
    conditions.push(gte(backupJobs.completedAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(backupJobs.completedAt, endDate));
  }

  const rows = await db
    .select({
      jobId: backupJobs.id,
      repositoryId: backupJobs.repositoryId,
      repositoryName: githubRepositories.name,
      fullName: githubRepositories.fullName,
      accountLogin: githubInstallations.accountLogin,
      commitSha: backupJobs.commitSha,
      bundleSizeBytes: backupJobs.bundleSizeBytes,
      s3Bucket: backupJobs.s3Bucket,
      s3Key: backupJobs.s3Key,
      completedAt: backupJobs.completedAt,
    })
    .from(backupJobs)
    .innerJoin(githubRepositories, eq(backupJobs.repositoryId, githubRepositories.id))
    .innerJoin(githubInstallations, eq(githubRepositories.installationId, githubInstallations.id))
    .where(and(...conditions))
    .orderBy(desc(backupJobs.completedAt));

  let selected: ExportCandidate[] = [];

  if (params.includeAllSnapshots) {
    selected = rows.map((r) => ({
      jobId: r.jobId,
      repositoryId: r.repositoryId,
      repositoryName: r.repositoryName,
      fullName: r.fullName,
      accountLogin: r.accountLogin,
      commitSha: r.commitSha || "unknown",
      bundleSizeBytes: Number(r.bundleSizeBytes || 0),
      s3Bucket: r.s3Bucket!,
      s3Key: r.s3Key!,
      completedAt: r.completedAt || new Date(),
    }));
  } else {
    // Latest snapshot per repository
    const seenRepos = new Set<string>();
    for (const r of rows) {
      if (!seenRepos.has(r.repositoryId)) {
        seenRepos.add(r.repositoryId);
        selected.push({
          jobId: r.jobId,
          repositoryId: r.repositoryId,
          repositoryName: r.repositoryName,
          fullName: r.fullName,
          accountLogin: r.accountLogin,
          commitSha: r.commitSha || "unknown",
          bundleSizeBytes: Number(r.bundleSizeBytes || 0),
          s3Bucket: r.s3Bucket!,
          s3Key: r.s3Key!,
          completedAt: r.completedAt || new Date(),
        });
      }
    }
  }

  const distinctRepos = new Set(selected.map((c) => c.repositoryId));
  const totalSizeBytes = selected.reduce((acc, c) => acc + c.bundleSizeBytes, 0);

  return {
    candidates: selected,
    totalSizeBytes,
    repositoryCount: distinctRepos.size,
    bundleCount: selected.length,
    period,
    startDate,
    endDate,
  };
}
