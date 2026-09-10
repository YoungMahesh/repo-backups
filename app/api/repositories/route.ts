import { NextRequest, NextResponse } from "next/server";
import { eq, asc, and, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { githubRepositories, githubInstallations, backupJobs } from "@/db/schema";
import { getNextBackupTime } from "@/lib/backup/scheduler";

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

  // Compute retention count (completed backup bundles) for each repository
  const retentionCounts = await db
    .select({
      repositoryId: backupJobs.repositoryId,
      count: count(backupJobs.id),
    })
    .from(backupJobs)
    .where(
      and(
        eq(backupJobs.userId, userId),
        eq(backupJobs.status, "completed"),
      ),
    )
    .groupBy(backupJobs.repositoryId);

  const retentionMap = new Map<string, number>();
  for (const item of retentionCounts) {
    retentionMap.set(item.repositoryId, Number(item.count));
  }

  const enrichedRepositories = repositories.map((repo) => {
    const nextBackup = getNextBackupTime(repo);
    return {
      ...repo,
      retentionCount: retentionMap.get(repo.id) || 0,
      nextBackupAt: nextBackup ? nextBackup.toISOString() : null,
    };
  });

  return NextResponse.json({
    repositories: installationId
      ? enrichedRepositories.filter((r) => r.installationId === installationId)
      : enrichedRepositories,
  });
}

const VALID_SCHEDULES = ["daily", "weekly", "manual"] as const;
type BackupSchedule = (typeof VALID_SCHEDULES)[number];

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let body: {
    id?: string;
    backupEnabled?: boolean;
    backupSchedule?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 },
    );
  }

  if (!body.id) {
    return NextResponse.json(
      { error: "Repository id is required" },
      { status: 400 },
    );
  }

  const [existingRepo] = await db
    .select()
    .from(githubRepositories)
    .where(
      eq(githubRepositories.id, body.id),
    );

  if (!existingRepo || existingRepo.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 },
    );
  }

  const updates: {
    backupEnabled?: boolean;
    backupSchedule?: BackupSchedule;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (body.backupEnabled !== undefined) {
    if (typeof body.backupEnabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid backupEnabled. Must be a boolean." },
        { status: 400 },
      );
    }
    updates.backupEnabled = body.backupEnabled;
  }

  if (body.backupSchedule !== undefined) {
    if (!VALID_SCHEDULES.includes(body.backupSchedule as BackupSchedule)) {
      return NextResponse.json(
        {
          error: `Invalid backupSchedule: "${body.backupSchedule}". Must be one of: ${VALID_SCHEDULES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    updates.backupSchedule = body.backupSchedule as BackupSchedule;
  }

  const [updated] = await db
    .update(githubRepositories)
    .set(updates)
    .where(eq(githubRepositories.id, body.id))
    .returning();

  return NextResponse.json({
    success: true,
    repository: updated,
  });
}

