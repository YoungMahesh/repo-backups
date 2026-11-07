import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { bundleExports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getUserRollingQuotaUsage } from "@/lib/export/quota";
import { getExportCandidates } from "@/lib/export/selection";
import { executeBundleExport } from "@/lib/export/engine";
import { formatBytes } from "@/lib/export/manifest";
import { getDefaultBackupBucket } from "@/lib/storage/s3";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userId = session.user.id;
  const quota = await getUserRollingQuotaUsage(userId);

  const exportsList = await db
    .select()
    .from(bundleExports)
    .where(eq(bundleExports.userId, userId))
    .orderBy(desc(bundleExports.createdAt));

  const now = new Date();

  const formattedExports = await Promise.all(
    exportsList.map(async (exp) => {
      let isExpired = false;
      let downloadUrl: string | null = null;

      if (exp.expiresAt && exp.expiresAt < now) {
        isExpired = true;
        if (exp.status === "completed") {
          await db
            .update(bundleExports)
            .set({ status: "expired" })
            .where(eq(bundleExports.id, exp.id));
        }
      }

      if (exp.status === "completed" && !isExpired && exp.s3Bucket && exp.s3Key) {
        downloadUrl = `/api/exports/${exp.id}/download`;
      }

      return {
        ...exp,
        status: isExpired ? "expired" : exp.status,
        downloadUrl,
      };
    }),
  );

  return NextResponse.json({
    exports: formattedExports,
    quota,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: {
    repositoryIds?: string[];
    period?: string;
    startDate?: string;
    endDate?: string;
    includeAllSnapshots?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { repositoryIds, period = "last_month", startDate, endDate, includeAllSnapshots = false } = body;

  if (!repositoryIds || !Array.isArray(repositoryIds) || repositoryIds.length === 0) {
    return NextResponse.json(
      { error: "At least one repository must be selected for export." },
      { status: 400 },
    );
  }

  // 1. Check for active in-flight job
  const quota = await getUserRollingQuotaUsage(userId);
  if (quota.hasActiveJob) {
    return NextResponse.json(
      { error: "An export is already in progress. Please wait for it to complete." },
      { status: 409 },
    );
  }

  // 2. Resolve candidates & verify bundle existence
  const selection = await getExportCandidates({
    userId,
    repositoryIds,
    period,
    startDate,
    endDate,
    includeAllSnapshots,
  });

  if (selection.bundleCount === 0) {
    return NextResponse.json(
      { error: "No completed backup bundles found for the selected repositories in this timeframe." },
      { status: 400 },
    );
  }

  // 3. Enforce 30 GB 24-hour quota
  if (selection.totalSizeBytes > quota.remainingBytes) {
    return NextResponse.json(
      {
        error: `Requested export size (${formatBytes(selection.totalSizeBytes)}) exceeds your remaining 24-hour quota (${formatBytes(quota.remainingBytes)}). Maximum is 30 GB per 24 hours.`,
      },
      { status: 400 },
    );
  }

  // 4. Create pending bundle_exports record
  const bucket = getDefaultBackupBucket();
  const [createdExport] = await db
    .insert(bundleExports)
    .values({
      userId,
      status: "pending",
      s3Bucket: bucket,
      totalSizeBytes: selection.totalSizeBytes,
      repositoryCount: selection.repositoryCount,
      bundleCount: selection.bundleCount,
      selectedPeriod: period,
      periodStart: selection.startDate,
      periodEnd: selection.endDate,
      includeAllSnapshots,
      repositoryIds,
    })
    .returning();

  // 5. Trigger background asynchronous packaging
  void executeBundleExport({ exportId: createdExport.id }).catch((err) => {
    console.error(`[BundleExport] Background execution error for ${createdExport.id}:`, err);
  });

  return NextResponse.json(
    {
      export: createdExport,
      message: "Export job initiated successfully.",
    },
    { status: 201 },
  );
}
