import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { bundleExports } from "@/db/schema";
import { getObjectStream } from "@/lib/storage/s3";

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
  if (exportRecord.expiresAt && exportRecord.expiresAt < now) {
    if (exportRecord.status === "completed") {
      await db
        .update(bundleExports)
        .set({ status: "expired" })
        .where(eq(bundleExports.id, exportRecord.id));
    }
    return NextResponse.json(
      { error: "This backup export has expired (24-hour retention window)." },
      { status: 410 },
    );
  }

  if (
    exportRecord.status !== "completed" ||
    !exportRecord.s3Bucket ||
    !exportRecord.s3Key
  ) {
    return NextResponse.json(
      { error: "Backup export archive is not ready for download." },
      { status: 400 },
    );
  }

  const filename = `repo-backups-export-${exportRecord.id.slice(0, 8)}.zip`;

  try {
    const { stream, contentLength } = await getObjectStream({
      bucket: exportRecord.s3Bucket,
      key: exportRecord.s3Key,
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    if (contentLength || exportRecord.totalSizeBytes) {
      headers.set("Content-Length", String(contentLength || exportRecord.totalSizeBytes));
    }

    return new Response(stream as unknown as ReadableStream, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    console.error(`[ExportDownload] Failed to stream export ${id}:`, err);
    const message = err instanceof Error ? err.message : "Failed to retrieve export archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
