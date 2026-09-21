import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";
import { deleteInstallation } from "@/lib/github/client";
import { cancelInFlightJobsForInstallation } from "@/lib/backup/engine";

export interface DisconnectInstallationParams {
  installationIdOrDbId: string;
  userId?: string; // Optional: if provided, ownership verification is enforced
}

export interface DisconnectInstallationResult {
  status: number;
  data: {
    success?: boolean;
    error?: string;
    installation?: typeof githubInstallations.$inferSelect;
    disabledRepositoriesCount?: number;
    cancelledJobsCount?: number;
    remoteRevoked?: boolean;
    warning?: string;
  };
}

/**
 * Executes installation disconnection:
 * 1. Verifies existence and user ownership (if userId supplied).
 * 2. Aborts and marks in-flight running backup jobs as cancelled.
 * 3. Calls GitHub REST API to uninstall remote GitHub App (with resilient local fallback).
 * 4. Updates database record to "disconnected" status with timestamp.
 * 5. Disables backup schedules across all associated repositories without deleting historical records or S3 backup bundles.
 */
export async function disconnectInstallation({
  installationIdOrDbId,
  userId,
}: DisconnectInstallationParams): Promise<DisconnectInstallationResult> {
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

  // 1. Cancel in-flight running backup jobs
  const { cancelledJobsCount } = await cancelInFlightJobsForInstallation(inst.id);

  // 2. Call remote GitHub App deletion
  let remoteRevoked = false;
  let remoteWarning: string | undefined;
  try {
    const deleteResult = await deleteInstallation(inst.installationId);
    remoteRevoked = deleteResult.success;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `Remote GitHub uninstallation failed for installation ${inst.installationId}: ${msg}. Proceeding with local disconnection fallback.`,
    );
    remoteWarning = msg;
  }

  // 3. Update database records: status = "disconnected", disconnectedAt = now()
  const now = new Date();
  const [updatedInstallation] = await db
    .update(githubInstallations)
    .set({
      status: "disconnected",
      disconnectedAt: now,
      updatedAt: now,
    })
    .where(eq(githubInstallations.id, inst.id))
    .returning();

  // 4. Disable backups across all associated repositories
  const disabledRepos = await db
    .update(githubRepositories)
    .set({
      backupEnabled: false,
      updatedAt: now,
    })
    .where(eq(githubRepositories.installationId, inst.id))
    .returning();

  return {
    status: 200,
    data: {
      success: true,
      installation: updatedInstallation,
      disabledRepositoriesCount: disabledRepos.length,
      cancelledJobsCount,
      remoteRevoked,
      ...(remoteWarning ? { warning: remoteWarning } : {}),
    },
  };
}
