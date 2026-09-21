import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";

export interface ReconcileInstallationParams {
  userId: string;
  installationId: number;
  details: {
    account: {
      login: string;
      type?: string;
      avatar_url?: string | null;
    };
    target_type?: string;
  };
  repositories: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    default_branch?: string;
  }>;
}

export interface ReconcileInstallationResult {
  installation: typeof githubInstallations.$inferSelect;
  repositoriesCount: number;
  isReconnected: boolean;
}

/**
 * Reconciles an incoming GitHub App installation callback against existing database records:
 * 1. Detects existing installation records for the same installationId or account login.
 * 2. Reconnecting updates the installation record with status = "active", disconnected_at = null,
 *    refreshes account metadata, and merges duplicate records if any exist.
 * 3. Existing repository records are preserved along with their historical backup jobs and S3 references.
 * 4. Newly authorized repositories from GitHub are inserted into github_repositories,
 *    while existing repositories have their metadata updated without deleting unselected repositories.
 */
export async function reconcileInstallation({
  userId,
  installationId,
  details,
  repositories,
}: ReconcileInstallationParams): Promise<ReconcileInstallationResult> {
  const now = new Date();

  // 1. Detect existing installation records for the same installationId or account login
  const existingInstallations = await db
    .select()
    .from(githubInstallations)
    .where(
      or(
        eq(githubInstallations.installationId, installationId),
        eq(githubInstallations.accountLogin, details.account.login),
        sql`lower(${githubInstallations.accountLogin}) = lower(${details.account.login})`,
      ),
    );

  // Match prioritizes same installationId first, then accountLogin
  const existingById = existingInstallations.find(
    (inst) => inst.installationId === installationId,
  );
  const existingByLogin =
    existingInstallations.find(
      (inst) =>
        inst.accountLogin.toLowerCase() === details.account.login.toLowerCase() &&
        inst.userId === userId,
    ) ||
    existingInstallations.find(
      (inst) =>
        inst.accountLogin.toLowerCase() === details.account.login.toLowerCase(),
    );

  const targetInstallation = existingById || existingByLogin;
  const isReconnected = Boolean(
    targetInstallation &&
      (targetInstallation.status === "disconnected" ||
        targetInstallation.status === "suspended" ||
        targetInstallation.disconnectedAt !== null),
  );

  // If there's an existing record by ID and a different record by login, reconcile them
  if (existingById && existingByLogin && existingById.id !== existingByLogin.id) {
    await db
      .update(githubRepositories)
      .set({
        installationId: existingById.id,
        userId,
        updatedAt: now,
      })
      .where(eq(githubRepositories.installationId, existingByLogin.id));

    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.id, existingByLogin.id));
  }

  // 2. Update existing installation or insert new installation
  let savedInstallation: typeof githubInstallations.$inferSelect;

  if (targetInstallation) {
    const [updated] = await db
      .update(githubInstallations)
      .set({
        userId,
        installationId,
        accountLogin: details.account.login,
        accountType: details.account.type || "Organization",
        avatarUrl: details.account.avatar_url || null,
        targetType: details.target_type || "selected",
        status: "active",
        disconnectedAt: null,
        updatedAt: now,
      })
      .where(eq(githubInstallations.id, targetInstallation.id))
      .returning();

    savedInstallation = updated;
  } else {
    const [inserted] = await db
      .insert(githubInstallations)
      .values({
        userId,
        installationId,
        accountLogin: details.account.login,
        accountType: details.account.type || "Organization",
        avatarUrl: details.account.avatar_url || null,
        targetType: details.target_type || "selected",
        status: "active",
        disconnectedAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: {
          userId,
          accountLogin: details.account.login,
          accountType: details.account.type || "Organization",
          avatarUrl: details.account.avatar_url || null,
          targetType: details.target_type || "selected",
          status: "active",
          disconnectedAt: null,
          updatedAt: now,
        },
      })
      .returning();

    savedInstallation = inserted;
  }

  // 3. Reconcile authorized repository inventory
  // Newly authorized repositories are inserted; existing repositories have metadata updated;
  // historical backup jobs and S3 references remain intact.
  for (const repo of repositories) {
    await db
      .insert(githubRepositories)
      .values({
        installationId: savedInstallation.id,
        userId,
        githubRepoId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch || "main",
      })
      .onConflictDoUpdate({
        target: githubRepositories.githubRepoId,
        set: {
          installationId: savedInstallation.id,
          userId,
          name: repo.name,
          fullName: repo.full_name,
          isPrivate: repo.private,
          defaultBranch: repo.default_branch || "main",
          updatedAt: now,
        },
      });
  }

  return {
    installation: savedInstallation,
    repositoriesCount: repositories.length,
    isReconnected,
  };
}
