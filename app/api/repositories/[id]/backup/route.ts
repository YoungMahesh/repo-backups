import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { githubRepositories, backupJobs } from "@/db/schema";
import { executeBackupJob } from "@/lib/backup/engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await params;

  // 1. Verify repository exists and belongs to authenticated user
  const [repo] = await db
    .select()
    .from(githubRepositories)
    .where(
      and(
        eq(githubRepositories.id, id),
        eq(githubRepositories.userId, session.user.id),
      ),
    );

  if (!repo) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 },
    );
  }

  // 2. Verify repository is enrolled for backups
  if (!repo.backupEnabled) {
    return NextResponse.json(
      { error: "Repository is not enrolled for backups" },
      { status: 400 },
    );
  }

  // 3. Dispatch backup execution
  try {
    const result = await executeBackupJob({
      repositoryId: id,
      userId: session.user.id,
      triggerType: "manual",
    });

    if (!result.success) {
      console.error(
        `[BackupAPI] Backup execution failed for repository ${id}:`,
        result.error,
      );
      return NextResponse.json(
        {
          success: false,
          job: result.job,
          repository: result.repository,
          error: result.error || "Backup failed",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      job: result.job,
      repository: result.repository,
    });
  } catch (err: unknown) {
    console.error(
      `[BackupAPI] Unexpected error in backup route for repository ${id}:`,
      err,
    );
    const message =
      err instanceof Error ? err.message : "Internal backup error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const [repo] = await db
    .select()
    .from(githubRepositories)
    .where(
      and(
        eq(githubRepositories.id, id),
        eq(githubRepositories.userId, session.user.id),
      ),
    );

  if (!repo) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 },
    );
  }

  const jobs = await db
    .select()
    .from(backupJobs)
    .where(
      and(
        eq(backupJobs.repositoryId, id),
        eq(backupJobs.userId, session.user.id),
      ),
    )
    .orderBy(desc(backupJobs.createdAt));

  return NextResponse.json({ jobs });
}
