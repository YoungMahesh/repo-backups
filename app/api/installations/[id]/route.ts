import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { disconnectInstallation } from "@/lib/github/disconnection";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const isNumeric = /^\d+$/.test(id);

  const [installation] = await db
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
    .where(
      isNumeric
        ? or(
            eq(githubInstallations.id, id),
            eq(githubInstallations.installationId, Number(id)),
          )
        : eq(githubInstallations.id, id),
    )
    .groupBy(githubInstallations.id);

  if (!installation) {
    return NextResponse.json(
      { error: "Installation not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ installation });
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const result = await disconnectInstallation({
    installationIdOrDbId: id,
    userId: session.user.id,
  });

  return NextResponse.json(result.data, { status: result.status });
}
