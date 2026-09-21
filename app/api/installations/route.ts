import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";
import { disconnectInstallation } from "@/lib/github/disconnection";

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
  const statusParam = request.nextUrl.searchParams.get("status") || "active";

  const condition =
    statusParam === "all"
      ? eq(githubInstallations.userId, userId)
      : and(
          eq(githubInstallations.userId, userId),
          eq(githubInstallations.status, statusParam),
        );

  const installations = await db
    .select({
      id: githubInstallations.id,
      installationId: githubInstallations.installationId,
      accountLogin: githubInstallations.accountLogin,
      accountType: githubInstallations.accountType,
      avatarUrl: githubInstallations.avatarUrl,
      targetType: githubInstallations.targetType,
      status: githubInstallations.status,
      disconnectedAt: githubInstallations.disconnectedAt,
      createdAt: githubInstallations.createdAt,
      updatedAt: githubInstallations.updatedAt,
      repositoryCount: sql<number>`count(${githubRepositories.id})::int`,
    })
    .from(githubInstallations)
    .leftJoin(
      githubRepositories,
      eq(githubRepositories.installationId, githubInstallations.id),
    )
    .where(condition)
    .groupBy(githubInstallations.id);

  return NextResponse.json({
    installations,
  });
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let id = request.nextUrl.searchParams.get("id") || request.nextUrl.searchParams.get("installationId");

  if (!id) {
    try {
      const body = await request.json();
      id = body.id || (body.installationId ? String(body.installationId) : undefined);
    } catch {
      // Body not provided or not JSON
    }
  }

  if (!id) {
    return NextResponse.json(
      { error: "Installation ID is required" },
      { status: 400 },
    );
  }

  const result = await disconnectInstallation({
    installationIdOrDbId: id,
    userId: session.user.id,
  });

  return NextResponse.json(result.data, { status: result.status });
}
