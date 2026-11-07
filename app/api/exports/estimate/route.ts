import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserRollingQuotaUsage } from "@/lib/export/quota";
import { getExportCandidates } from "@/lib/export/selection";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userId = session.user.id;
  const searchParams = request.nextUrl.searchParams;

  const period = searchParams.get("period") || "last_month";
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const includeAllSnapshots = searchParams.get("includeAllSnapshots") === "true";

  const repoIdsParam = searchParams.get("repositoryIds");
  const repositoryIds = repoIdsParam
    ? repoIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const quota = await getUserRollingQuotaUsage(userId);
  const selection = await getExportCandidates({
    userId,
    repositoryIds,
    period,
    startDate,
    endDate,
    includeAllSnapshots,
  });

  const exceedsQuota = selection.totalSizeBytes > quota.remainingBytes;

  return NextResponse.json({
    estimate: {
      totalSizeBytes: selection.totalSizeBytes,
      repositoryCount: selection.repositoryCount,
      bundleCount: selection.bundleCount,
      period: selection.period,
      startDate: selection.startDate,
      endDate: selection.endDate,
    },
    quota,
    exceedsQuota,
  });
}
