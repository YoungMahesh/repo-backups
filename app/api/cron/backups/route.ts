import { NextRequest, NextResponse } from "next/server";
import { runScheduledBackups } from "@/lib/backup/scheduler";

function verifyCronAuthorization(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken === cronSecret.trim()) {
      return true;
    }
  }

  const customHeader = request.headers.get("x-cron-secret");
  if (customHeader && customHeader.trim() === cronSecret.trim()) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Valid Bearer CRON_SECRET is required" },
      { status: 401 },
    );
  }

  try {
    const summary = await runScheduledBackups();
    return NextResponse.json(summary, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to execute scheduled backups", details: errorMessage },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
