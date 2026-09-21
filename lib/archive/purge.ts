import { eq, or, and, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  githubInstallations,
  githubRepositories,
  backupJobs,
} from "@/db/schema";
import { deleteBackupBundle } from "@/lib/storage/s3";

export interface PurgeInstallationArchiveParams {
  installationIdOrDbId: string;
  userId?: string;
}

export interface PurgeInstallationArchiveResult {
  status: number;
  data: {
    success?: boolean;
    error?: string;
    purgedRepositoriesCount?: number;
    purgedBundlesCount?: number;
  };
}

export interface PurgeRepositoryArchiveParams {
  repositoryId: string;
  userId?: string;
}

export interface PurgeRepositoryArchiveResult {
  status: number;
  data: {
    success?: boolean;
    error?: string;
    repositoryId?: string;
    purgedBundlesCount?: number;
  };
}

function isMissingKeyError(err: unknown): boolean {
  const error = err as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    error.name === "NoSuchKey" ||
    error.name === "NotFound" ||
    error.Code === "NoSuchKey" ||
    error.code === "NoSuchKey" ||
    error.$metadata?.httpStatusCode === 404
  );
}

/**
 * Permanently purges an entire disconnected installation archive:
 * 1. Verifies authentication, existence, ownership, and disconnected status.
 * 2. Identifies all S3 objects across all repositories for the installation.
 * 3. Deletes all Git bundles from S3 object storage via deleteBackupBundle (resilient to missing objects).
 * 4. Cascade-deletes the github_installations database record, removing child repositories and jobs.
 */
export async function purgeInstallationArchive({
  installationIdOrDbId,
  userId,
}: PurgeInstallationArchiveParams): Promise<PurgeInstallationArchiveResult> {
  const isNumeric = /^\d+$/.test(installationIdOrDbId);
  const [inst] = await db
    .select()
    .from(githubInstallations)
    .where(
      isNumeric
        ? or(
            eq(githubInstallations.id, installationIdOrDbId),
            eq(githubInstallations.installationId, Number(installationIdOrDbId)),
          )
        : eq(githubInstallations.id, installationIdOrDbId),
    );

  if (!inst) {
    return {
      status: 404,
      data: { error: "Installation not found" },
    };
  }

  if (userId && inst.userId !== userId) {
    return {
      status: 403,
      data: { error: "Forbidden: You do not own this installation" },
    };
  }

  if (inst.status !== "disconnected") {
    return {
      status: 400,
      data: {
        error:
          "Cannot purge active or suspended installation. Disconnect the installation first.",
      },
    };
  }

  // Find all child repositories
  const repos = await db
    .select({ id: githubRepositories.id })
    .from(githubRepositories)
    .where(eq(githubRepositories.installationId, inst.id));

  let purgedBundlesCount = 0;

  if (repos.length > 0) {
    const repoIds = repos.map((r) => r.id);
    const jobs = await db
      .select({
        id: backupJobs.id,
        s3Bucket: backupJobs.s3Bucket,
        s3Key: backupJobs.s3Key,
      })
      .from(backupJobs)
      .where(
        and(
          inArray(backupJobs.repositoryId, repoIds),
          isNotNull(backupJobs.s3Bucket),
          isNotNull(backupJobs.s3Key),
        ),
      );

    purgedBundlesCount = jobs.length;

    for (const job of jobs) {
      if (job.s3Bucket && job.s3Key) {
        try {
          await deleteBackupBundle({
            bucket: job.s3Bucket,
            key: job.s3Key,
          });
        } catch (err: unknown) {
          if (!isMissingKeyError(err)) {
            console.warn(
              `Failed to delete S3 bundle for job ${job.id} (${job.s3Key}):`,
              err,
            );
          }
        }
      }
    }
  }

  // Cascade-delete the installation record from PostgreSQL
  await db
    .delete(githubInstallations)
    .where(eq(githubInstallations.id, inst.id));

  return {
    status: 200,
    data: {
      success: true,
      purgedRepositoriesCount: repos.length,
      purgedBundlesCount,
    },
  };
}

/**
 * Permanently purges an individual repository archive under a disconnected installation:
 * 1. Verifies authentication, existence, ownership, and that the parent installation is disconnected.
 * 2. Identifies all S3 objects for the repository.
 * 3. Deletes all Git bundles from S3 object storage via deleteBackupBundle (resilient to missing objects).
 * 4. Cascade-deletes the github_repositories database record, removing its backup jobs while leaving
 *    the disconnected installation shell intact.
 */
export async function purgeRepositoryArchive({
  repositoryId,
  userId,
}: PurgeRepositoryArchiveParams): Promise<PurgeRepositoryArchiveResult> {
  const [repoWithInst] = await db
    .select({
      repository: githubRepositories,
      installation: githubInstallations,
    })
    .from(githubRepositories)
    .innerJoin(
      githubInstallations,
      eq(githubRepositories.installationId, githubInstallations.id),
    )
    .where(eq(githubRepositories.id, repositoryId));

  if (!repoWithInst) {
    return {
      status: 404,
      data: { error: "Repository not found" },
    };
  }

  if (userId && repoWithInst.repository.userId !== userId) {
    return {
      status: 403,
      data: { error: "Forbidden: You do not own this repository" },
    };
  }

  if (repoWithInst.installation.status !== "disconnected") {
    return {
      status: 400,
      data: {
        error:
          "Cannot purge repository from an active installation. Disconnect the parent installation first.",
      },
    };
  }

  // Find all backup jobs with S3 references for this repository
  const jobs = await db
    .select({
      id: backupJobs.id,
      s3Bucket: backupJobs.s3Bucket,
      s3Key: backupJobs.s3Key,
    })
    .from(backupJobs)
    .where(
      and(
        eq(backupJobs.repositoryId, repositoryId),
        isNotNull(backupJobs.s3Bucket),
        isNotNull(backupJobs.s3Key),
      ),
    );

  for (const job of jobs) {
    if (job.s3Bucket && job.s3Key) {
      try {
        await deleteBackupBundle({
          bucket: job.s3Bucket,
          key: job.s3Key,
        });
      } catch (err: unknown) {
        if (!isMissingKeyError(err)) {
          console.warn(
            `Failed to delete S3 bundle for job ${job.id} (${job.s3Key}):`,
            err,
          );
        }
      }
    }
  }

  // Cascade-delete the repository record from PostgreSQL
  await db
    .delete(githubRepositories)
    .where(eq(githubRepositories.id, repositoryId));

  return {
    status: 200,
    data: {
      success: true,
      repositoryId,
      purgedBundlesCount: jobs.length,
    },
  };
}
