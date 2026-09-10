import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { backupJobs, githubRepositories } from "@/db/schema";
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

  // Verify backup job exists and belongs to authenticated user
  const [job] = await db
    .select()
    .from(backupJobs)
    .where(
      and(
        eq(backupJobs.id, id),
        eq(backupJobs.userId, session.user.id),
      ),
    );

  if (!job) {
    return NextResponse.json(
      { error: "Backup job not found" },
      { status: 404 },
    );
  }

  // Verify repository still exists and is enrolled
  const [repo] = await db
    .select()
    .from(githubRepositories)
    .where(
      and(
        eq(githubRepositories.id, job.repositoryId),
        eq(githubRepositories.userId, session.user.id),
      ),
    );

  if (!repo) {
    return NextResponse.json(
      { error: "Associated repository not found" },
      { status: 404 },
    );
  }

  try {
    const result = await executeBackupJob({
      repositoryId: job.repositoryId,
      userId: session.user.id,
      triggerType: "manual",
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          job: result.job,
          repository: result.repository,
          error: result.error || "Retry backup failed",
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
    const message =
      err instanceof Error ? err.message : "Internal backup error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
