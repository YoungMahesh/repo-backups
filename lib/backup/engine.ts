import { and, eq, desc, inArray } from "drizzle-orm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { db } from "@/db";
import { backupJobs, githubRepositories, githubInstallations } from "@/db/schema";
import { fetchInstallationToken } from "@/lib/github/client";
import {
  ensureBucketExists,
  generateBackupKey,
  getDefaultBackupBucket,
  uploadBackupBundle,
  deleteBackupBundle,
  formatErrorMessage,
} from "@/lib/storage/s3";

const execFileAsync = promisify(execFile);

export interface GitBundleResult {
  commitSha: string;
  bundleSizeBytes: number;
  bundlePath: string;
  cleanup: () => Promise<void>;
}

export interface MockGitRunner {
  runBundle?: (
    repoFullName: string,
    token: string | null,
    attempt: number,
  ) => Promise<{
    commitSha: string;
    bundleSizeBytes: number;
    bundleContent?: Buffer | string;
  }>;
}

let mockGitRunner: MockGitRunner | null = null;
let retryDelayOverride: number | null = null;
const activeJobControllers = new Map<string, AbortController>();

export function setMockGitRunner(runner: MockGitRunner | null) {
  mockGitRunner = runner;
}

export function getMockGitRunner(): MockGitRunner | null {
  return mockGitRunner;
}

export function setRetryDelayOverride(delayMs: number | null) {
  retryDelayOverride = delayMs;
}

async function sleep(ms: number): Promise<void> {
  const actualDelay = retryDelayOverride !== null ? retryDelayOverride : ms;
  if (actualDelay <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, actualDelay));
}

/**
 * Clones a bare mirror of the repository and produces a complete Git bundle (.bundle)
 * preserving all commits, branches, and tags with `git bundle create --all`.
 */
export async function executeGitCloneAndBundle(
  repoFullName: string,
  token: string | null,
  attempt: number = 0,
  signal?: AbortSignal,
): Promise<GitBundleResult> {
  if (mockGitRunner?.runBundle) {
    const mockResult = await mockGitRunner.runBundle(repoFullName, token, attempt);
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "mock-bundle-"),
    );
    const bundlePath = path.join(tempDir, "backup.bundle");
    const content = mockResult.bundleContent || Buffer.from("mock-git-bundle-content");
    await fs.promises.writeFile(bundlePath, content);
    return {
      commitSha: mockResult.commitSha,
      bundleSizeBytes: mockResult.bundleSizeBytes ?? content.length,
      bundlePath,
      cleanup: async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      },
    };
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "repo-backup-"));
  const mirrorDir = path.join(tempDir, "mirror.git");
  const bundlePath = path.join(tempDir, "backup.bundle");

  const cleanup = async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  };

  try {
    const authUrl = token
      ? `https://x-access-token:${token}@github.com/${repoFullName}.git`
      : `https://github.com/${repoFullName}.git`;

    // 1. Bare mirror clone using installation token
    await execFileAsync("git", ["clone", "--mirror", authUrl, mirrorDir], {
      timeout: 180000,
      signal,
    });

    // 2. Standalone Git bundle with --all preserving full git history
    await execFileAsync("git", ["bundle", "create", bundlePath, "--all"], {
      cwd: mirrorDir,
      timeout: 180000,
      signal,
    });

    // 3. Capture latest commit SHA
    const { stdout: headSha } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: mirrorDir, signal },
    );
    const commitSha = headSha.trim();

    // 4. File size in bytes
    const stat = await fs.promises.stat(bundlePath);
    const bundleSizeBytes = stat.size;

    return {
      commitSha,
      bundleSizeBytes,
      bundlePath,
      cleanup,
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

export interface ExecuteBackupJobParams {
  repositoryId: string;
  userId: string;
  triggerType?: "manual" | "scheduled";
}

export interface ExecuteBackupJobResult {
  success: boolean;
  job: typeof backupJobs.$inferSelect;
  repository?: typeof githubRepositories.$inferSelect;
  error?: string;
}

/**
 * Dispatches and executes an on-demand or scheduled Backup Job with automated retries.
 */
export async function executeBackupJob({
  repositoryId,
  userId,
  triggerType = "manual",
}: ExecuteBackupJobParams): Promise<ExecuteBackupJobResult> {
  // 1. Verify repository and fetch associated installation
  const [repoWithInstallation] = await db
    .select({
      id: githubRepositories.id,
      userId: githubRepositories.userId,
      installationId: githubRepositories.installationId,
      name: githubRepositories.name,
      fullName: githubRepositories.fullName,
      backupEnabled: githubRepositories.backupEnabled,
      backupSchedule: githubRepositories.backupSchedule,
      lastBackupAt: githubRepositories.lastBackupAt,
      lastBackupStatus: githubRepositories.lastBackupStatus,
      githubInstallationId: githubInstallations.installationId,
      accountLogin: githubInstallations.accountLogin,
    })
    .from(githubRepositories)
    .innerJoin(
      githubInstallations,
      eq(githubRepositories.installationId, githubInstallations.id),
    )
    .where(
      and(
        eq(githubRepositories.id, repositoryId),
        eq(githubRepositories.userId, userId),
      ),
    );

  if (!repoWithInstallation) {
    throw new Error("Repository not found or unauthorized");
  }

  if (!repoWithInstallation.backupEnabled) {
    throw new Error("Repository is not enrolled for backups");
  }

  const bucketName = getDefaultBackupBucket();
  const startedAt = new Date();

  // 2. Record initial backup job with status = "running"
  const [initialJob] = await db
    .insert(backupJobs)
    .values({
      repositoryId: repoWithInstallation.id,
      userId,
      status: "running",
      triggerType,
      s3Bucket: bucketName,
      retryCount: 0,
      startedAt,
    })
    .returning();

  // Update repository's backup status to "running"
  await db
    .update(githubRepositories)
    .set({
      lastBackupStatus: "running",
      updatedAt: new Date(),
    })
    .where(eq(githubRepositories.id, repoWithInstallation.id));

  // 3. Execute backup with retry policy (up to 2 retries with backoff)
  const MAX_RETRIES = 2;
  let lastError: Error | null = null;
  const abortController = new AbortController();
  activeJobControllers.set(initialJob.id, abortController);

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abortController.signal.aborted) {
        break;
      }
      if (attempt > 0) {
        // Exponential backoff: attempt 1 -> 300ms, attempt 2 -> 600ms (or overridden in tests)
        await sleep(300 * attempt);
        if (abortController.signal.aborted) {
          break;
        }
        await db
          .update(backupJobs)
          .set({ retryCount: attempt })
          .where(eq(backupJobs.id, initialJob.id));
      }

      let bundleResult: GitBundleResult | null = null;
      try {
        // Step A: Ensure S3 bucket exists (auto-create if missing)
        await ensureBucketExists(bucketName);

        // Step B: Obtain installation access token
        const token = await fetchInstallationToken(
          repoWithInstallation.githubInstallationId,
        );

        // Step C: Bare mirror clone and git bundle create
        bundleResult = await executeGitCloneAndBundle(
          repoWithInstallation.fullName,
          token,
          attempt,
          abortController.signal,
        );

        if (abortController.signal.aborted) {
          await bundleResult.cleanup().catch(() => {});
          break;
        }

        // Step D: Structured S3 key
        const parts = repoWithInstallation.fullName.split("/");
        const owner = parts[0] || repoWithInstallation.accountLogin;
        const repoName = parts[1] || repoWithInstallation.name;
        const s3Key = generateBackupKey(
          userId,
          owner,
          repoName,
          bundleResult.commitSha,
          Date.now(),
        );

      // Step E: Stream bundle to S3 with SSE-S3 encryption
      await uploadBackupBundle({
        bucket: bucketName,
        key: s3Key,
        filePath: bundleResult.bundlePath,
        sizeBytes: bundleResult.bundleSizeBytes,
      });

      if (abortController.signal.aborted) {
        await bundleResult.cleanup().catch(() => {});
        break;
      }

      // Check if job was cancelled in DB by disconnection
      const [statusCheck] = await db
        .select({ status: backupJobs.status, errorMessage: backupJobs.errorMessage })
        .from(backupJobs)
        .where(eq(backupJobs.id, initialJob.id));
      if (statusCheck?.status === "failed" && statusCheck.errorMessage === "Installation disconnected by user") {
        await bundleResult.cleanup().catch(() => {});
        const [cancelledJob] = await db
          .select()
          .from(backupJobs)
          .where(eq(backupJobs.id, initialJob.id));
        return {
          success: false,
          job: cancelledJob || initialJob,
          error: "Installation disconnected by user",
        };
      }

      const completedAt = new Date();

      // Step F: Record completed Backup Job in database
      const [completedJob] = await db
        .update(backupJobs)
        .set({
          status: "completed",
          commitSha: bundleResult.commitSha,
          bundleSizeBytes: bundleResult.bundleSizeBytes,
          s3Bucket: bucketName,
          s3Key,
          retryCount: attempt,
          completedAt,
        })
        .where(eq(backupJobs.id, initialJob.id))
        .returning();

      // Step G: Update repository last backup metadata
      const [updatedRepo] = await db
        .update(githubRepositories)
        .set({
          lastBackupAt: completedAt,
          lastBackupStatus: "success",
          updatedAt: new Date(),
        })
        .where(eq(githubRepositories.id, repoWithInstallation.id))
        .returning();

      await bundleResult.cleanup();

      // Step H: Enforce rolling Retention Window (prune oldest excess bundles beyond 10)
      try {
        await pruneRetentionWindow(repoWithInstallation.id);
      } catch (pruneErr) {
        console.error(
          `Retention pruning failed for repo ${repoWithInstallation.id}:`,
          pruneErr,
        );
      }

      return {
        success: true,
        job: completedJob,
        repository: updatedRepo,
      };
    } catch (err: unknown) {
      if (bundleResult) {
        await bundleResult.cleanup().catch(() => {});
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[BackupEngine] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed for ${repoWithInstallation.fullName}:`,
        err,
      );
      // Loop continues if attempt < MAX_RETRIES
    }
  }

  // Check if job was cancelled in DB by disconnection during failure/abort
  const [cancelledCheck] = await db
    .select()
    .from(backupJobs)
    .where(eq(backupJobs.id, initialJob.id));
  if (cancelledCheck?.status === "failed" && cancelledCheck.errorMessage === "Installation disconnected by user") {
    return {
      success: false,
      job: cancelledCheck,
      error: "Installation disconnected by user",
    };
  }

  // 4. If all retries exhausted, record failed job
  const failedAt = new Date();
  const formattedError =
    formatErrorMessage(lastError) || "Backup execution failed after retries";
  console.error(
    `[BackupEngine] All backup retries exhausted for ${repoWithInstallation.fullName}:`,
    lastError,
  );
  const [failedJob] = await db
    .update(backupJobs)
    .set({
      status: "failed",
      errorMessage: formattedError,
      retryCount: MAX_RETRIES,
      completedAt: failedAt,
    })
    .where(eq(backupJobs.id, initialJob.id))
    .returning();

  const [failedRepo] = await db
    .update(githubRepositories)
    .set({
      lastBackupStatus: "failed",
      updatedAt: new Date(),
    })
    .where(eq(githubRepositories.id, repoWithInstallation.id))
    .returning();

  return {
    success: false,
    job: failedJob,
    repository: failedRepo,
    error: formattedError,
  };
  } finally {
    activeJobControllers.delete(initialJob.id);
  }
}

export interface CancelInFlightJobsResult {
  cancelledJobsCount: number;
  cancelledJobIds: string[];
}

/**
 * Aborts any in-flight running backup jobs belonging to repositories under the specified installation.
 * Transitions their database status to "failed" with errorMessage "Installation disconnected by user".
 */
export async function cancelInFlightJobsForInstallation(
  installationId: string,
): Promise<CancelInFlightJobsResult> {
  const repos = await db
    .select({ id: githubRepositories.id })
    .from(githubRepositories)
    .where(eq(githubRepositories.installationId, installationId));

  if (repos.length === 0) {
    return { cancelledJobsCount: 0, cancelledJobIds: [] };
  }

  const repoIds = repos.map((r) => r.id);

  const runningJobs = await db
    .select({ id: backupJobs.id })
    .from(backupJobs)
    .where(
      and(
        inArray(backupJobs.repositoryId, repoIds),
        eq(backupJobs.status, "running"),
      ),
    );

  if (runningJobs.length === 0) {
    return { cancelledJobsCount: 0, cancelledJobIds: [] };
  }

  const runningJobIds = runningJobs.map((j) => j.id);

  // Abort any active in-process abort controllers
  for (const jobId of runningJobIds) {
    const controller = activeJobControllers.get(jobId);
    if (controller) {
      try {
        controller.abort();
      } catch (err) {
        console.warn(`Failed to signal abort for job ${jobId}:`, err);
      }
    }
  }

  const cancelledAt = new Date();
  const updatedJobs = await db
    .update(backupJobs)
    .set({
      status: "failed",
      errorMessage: "Installation disconnected by user",
      completedAt: cancelledAt,
    })
    .where(
      and(
        inArray(backupJobs.repositoryId, repoIds),
        eq(backupJobs.status, "running"),
      ),
    )
    .returning();

  await db
    .update(githubRepositories)
    .set({
      lastBackupStatus: "failed",
      updatedAt: cancelledAt,
    })
    .where(
      and(
        inArray(githubRepositories.id, repoIds),
        eq(githubRepositories.lastBackupStatus, "running"),
      ),
    );

  return {
    cancelledJobsCount: updatedJobs.length,
    cancelledJobIds: updatedJobs.map((j) => j.id),
  };
}

export const MAX_RETENTION_BUNDLES = 10;

export interface PruneRetentionResult {
  totalCompleted: number;
  prunedCount: number;
  prunedJobs: Array<{ id: string; s3Key: string | null }>;
}

/**
 * Enforces the rolling Retention Window limit for a repository.
 * If total completed Backup Bundles exceed the limit (10), the oldest excess S3 objects
 * are permanently deleted via DeleteObjectCommand, and the database records are updated
 * to status = "pruned" to reflect their deletion.
 */
export async function pruneRetentionWindow(
  repositoryId: string,
  limit: number = MAX_RETENTION_BUNDLES,
): Promise<PruneRetentionResult> {
  // Query all completed backup jobs for this repository, ordered newest first
  const completed = await db
    .select({
      id: backupJobs.id,
      s3Bucket: backupJobs.s3Bucket,
      s3Key: backupJobs.s3Key,
      completedAt: backupJobs.completedAt,
      createdAt: backupJobs.createdAt,
    })
    .from(backupJobs)
    .where(
      and(
        eq(backupJobs.repositoryId, repositoryId),
        eq(backupJobs.status, "completed"),
      ),
    )
    .orderBy(desc(backupJobs.completedAt), desc(backupJobs.createdAt));

  if (completed.length <= limit) {
    return {
      totalCompleted: completed.length,
      prunedCount: 0,
      prunedJobs: [],
    };
  }

  // Excess jobs are the oldest beyond the retention limit
  const excessJobs = completed.slice(limit);
  const prunedJobs: Array<{ id: string; s3Key: string | null }> = [];

  for (const job of excessJobs) {
    // Permanently delete from S3 if bucket and key are present
    if (job.s3Bucket && job.s3Key) {
      try {
        await deleteBackupBundle({
          bucket: job.s3Bucket,
          key: job.s3Key,
        });
      } catch (s3Err) {
        console.error(`Failed to delete S3 object for job ${job.id}:`, s3Err);
      }
    }

    // Update database record to status = "pruned" to reflect deletion
    await db
      .update(backupJobs)
      .set({
        status: "pruned",
      })
      .where(eq(backupJobs.id, job.id));

    prunedJobs.push({ id: job.id, s3Key: job.s3Key });
  }

  return {
    totalCompleted: completed.length,
    prunedCount: prunedJobs.length,
    prunedJobs,
  };
}
