import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { githubRepositories, githubInstallations } from "@/db/schema";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const userId = session.user.id;
  const installationId = request.nextUrl.searchParams.get("installationId");

  const query = db
    .select({
      id: githubRepositories.id,
      installationId: githubRepositories.installationId,
      userId: githubRepositories.userId,
      githubRepoId: githubRepositories.githubRepoId,
      name: githubRepositories.name,
      fullName: githubRepositories.fullName,
      isPrivate: githubRepositories.isPrivate,
      defaultBranch: githubRepositories.defaultBranch,
      backupEnabled: githubRepositories.backupEnabled,
      backupSchedule: githubRepositories.backupSchedule,
      lastBackupAt: githubRepositories.lastBackupAt,
      lastBackupStatus: githubRepositories.lastBackupStatus,
      createdAt: githubRepositories.createdAt,
      updatedAt: githubRepositories.updatedAt,
      accountLogin: githubInstallations.accountLogin,
    })
    .from(githubRepositories)
    .innerJoin(
      githubInstallations,
      eq(githubRepositories.installationId, githubInstallations.id),
    )
    .where(eq(githubRepositories.userId, userId))
    .orderBy(asc(githubRepositories.fullName));

  const repositories = await query;

  return NextResponse.json({
    repositories: installationId
      ? repositories.filter((r) => r.installationId === installationId)
      : repositories,
  });
}
