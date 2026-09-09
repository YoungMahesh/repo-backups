import { NextRequest, NextResponse } from "next/server";
import { eq, and, notInArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";
import { fetchInstallationRepositories } from "@/lib/github/client";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required to sync repositories" },
      { status: 401 },
    );
  }

  const userId = session.user.id;
  let installationIdNumber: number | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    if (body && body.installationId) {
      installationIdNumber = Number(body.installationId);
    }
  } catch {
    // Body parsing optional
  }

  // Find target installation(s) belonging to this user
  const installationsQuery = db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.userId, userId));

  const userInstallations = await installationsQuery;
  if (userInstallations.length === 0) {
    return NextResponse.json(
      { error: "No connected GitHub installation found for this user" },
      { status: 404 },
    );
  }

  const installationsToSync = installationIdNumber
    ? userInstallations.filter(
        (inst) => inst.installationId === installationIdNumber,
      )
    : userInstallations;

  if (installationsToSync.length === 0) {
    return NextResponse.json(
      { error: "Installation not found or unauthorized" },
      { status: 404 },
    );
  }

  let totalSynced = 0;
  const syncedRepositories = [];

  for (const inst of installationsToSync) {
    const remoteRepos = await fetchInstallationRepositories(inst.installationId);
    const remoteRepoIds: number[] = [];

    for (const repo of remoteRepos) {
      remoteRepoIds.push(repo.id);

      const [saved] = await db
        .insert(githubRepositories)
        .values({
          installationId: inst.id,
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
            installationId: inst.id,
            userId,
            name: repo.name,
            fullName: repo.full_name,
            isPrivate: repo.private,
            defaultBranch: repo.default_branch || "main",
            updatedAt: new Date(),
          },
        })
        .returning();

      syncedRepositories.push(saved);
      totalSynced++;
    }

    // If repositories were removed from the GitHub App installation scope,
    // delete or reconcile them for this installation
    if (remoteRepoIds.length > 0) {
      await db
        .delete(githubRepositories)
        .where(
          and(
            eq(githubRepositories.installationId, inst.id),
            notInArray(githubRepositories.githubRepoId, remoteRepoIds),
          ),
        );
    }
  }

  return NextResponse.json({
    success: true,
    count: totalSynced,
    repositories: syncedRepositories,
  });
}
