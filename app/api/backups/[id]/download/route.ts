import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import path from "node:path";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { backupJobs, githubRepositories } from "@/db/schema";
import { createPresignedDownloadUrl } from "@/lib/storage/s3";

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

  // Fetch the backup job ensuring it belongs to the authenticated user
  const [record] = await db
    .select({
      job: backupJobs,
      repo: githubRepositories,
    })
    .from(backupJobs)
    .leftJoin(
      githubRepositories,
      eq(backupJobs.repositoryId, githubRepositories.id),
    )
    .where(
      and(
        eq(backupJobs.id, id),
        eq(backupJobs.userId, session.user.id),
      ),
    );

  if (!record || !record.job) {
    return NextResponse.json(
      { error: "Backup job not found" },
      { status: 404 },
    );
  }

  const { job, repo } = record;

  if (job.status !== "completed" || !job.s3Bucket || !job.s3Key) {
    return NextResponse.json(
      { error: "Backup bundle is not available for download" },
      { status: 400 },
    );
  }

  // Derive human-readable filename for browser download
  const baseFilename = path.basename(job.s3Key) || `${repo?.name || "backup"}.bundle`;

  try {
    const downloadUrl = await createPresignedDownloadUrl({
      bucket: job.s3Bucket,
      key: job.s3Key,
      expiresInSeconds: 900, // 15-minute temporary link
      downloadFilename: baseFilename,
    });

    return NextResponse.json({
      success: true,
      downloadUrl,
      fileName: baseFilename,
      expiresIn: 900,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate download URL";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
