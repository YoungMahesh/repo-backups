import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { githubRepositories } from "@/db/schema";

const VALID_SCHEDULES = ["daily", "weekly", "manual"] as const;
type BackupSchedule = (typeof VALID_SCHEDULES)[number];

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

  return NextResponse.json({ repository: repo });
}

export async function PATCH(
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

  // Verify repository exists and belongs to the authenticated user
  const [existingRepo] = await db
    .select()
    .from(githubRepositories)
    .where(
      and(
        eq(githubRepositories.id, id),
        eq(githubRepositories.userId, session.user.id),
      ),
    );

  if (!existingRepo) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 },
    );
  }

  let body: {
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
    .where(
      and(
        eq(githubRepositories.id, id),
        eq(githubRepositories.userId, session.user.id),
      ),
    )
    .returning();

  return NextResponse.json({
    success: true,
    repository: updated,
  });
}
