import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";

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

  const installations = await db
    .select({
      id: githubInstallations.id,
      installationId: githubInstallations.installationId,
      accountLogin: githubInstallations.accountLogin,
      accountType: githubInstallations.accountType,
      avatarUrl: githubInstallations.avatarUrl,
      targetType: githubInstallations.targetType,
      createdAt: githubInstallations.createdAt,
      updatedAt: githubInstallations.updatedAt,
      repositoryCount: sql<number>`count(${githubRepositories.id})::int`,
    })
    .from(githubInstallations)
    .leftJoin(
      githubRepositories,
      eq(githubRepositories.installationId, githubInstallations.id),
    )
    .where(eq(githubInstallations.userId, userId))
    .groupBy(githubInstallations.id);

  return NextResponse.json({
    installations,
  });
}
