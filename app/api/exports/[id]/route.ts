import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { bundleExports } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createPresignedDownloadUrl } from "@/lib/storage/s3";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  const userId = session.user.id;

  const [exportRecord] = await db
    .select()
    .from(bundleExports)
    .where(and(eq(bundleExports.id, id), eq(bundleExports.userId, userId)))
    .limit(1);

  if (!exportRecord) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  const now = new Date();
  let isExpired = false;
  let downloadUrl: string | null = null;

  if (exportRecord.expiresAt && exportRecord.expiresAt < now) {
    isExpired = true;
    if (exportRecord.status === "completed") {
      await db
        .update(bundleExports)
        .set({ status: "expired" })
        .where(eq(bundleExports.id, exportRecord.id));
    }
  }

  if (exportRecord.status === "completed" && !isExpired && exportRecord.s3Bucket && exportRecord.s3Key) {
    try {
      downloadUrl = await createPresignedDownloadUrl({
        bucket: exportRecord.s3Bucket,
        key: exportRecord.s3Key,
        expiresInSeconds: 3600,
        downloadFilename: `repo-backups-export-${exportRecord.id.slice(0, 8)}.zip`,
      });
    } catch {
      downloadUrl = null;
    }
  }

  return NextResponse.json({
    export: {
      ...exportRecord,
      status: isExpired ? "expired" : exportRecord.status,
      downloadUrl,
    },
  });
}
