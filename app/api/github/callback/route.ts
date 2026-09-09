import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";
import { verifyState } from "@/lib/github/crypto";
import {
  fetchInstallationDetails,
  fetchInstallationRepositories,
} from "@/lib/github/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationIdParam = searchParams.get("installation_id");
  const stateParam = searchParams.get("state");
  const format = searchParams.get("format");
  const accept = request.headers.get("accept") || "";
  const wantsJson = format === "json" || accept.includes("application/json");

  // 1. Verify signed state parameter
  const verification = verifyState(stateParam);
  if (!verification.valid || !verification.userId) {
    const error = verification.error || "Cryptographic state verification failed";
    if (wantsJson) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!installationIdParam) {
    const error = "Missing installation_id parameter";
    if (wantsJson) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  const installationId = parseInt(installationIdParam, 10);
  if (isNaN(installationId)) {
    const error = "Invalid installation_id parameter";
    if (wantsJson) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  const userId = verification.userId;

  try {
    // 2. Fetch installation metadata and authorized repository inventory
    const details = await fetchInstallationDetails(installationId);
    const repositories = await fetchInstallationRepositories(installationId);

    // 3. Upsert GitHub installation record linked to authenticated user
    const [savedInstallation] = await db
      .insert(githubInstallations)
      .values({
        userId,
        installationId,
        accountLogin: details.account.login,
        accountType: details.account.type || "Organization",
        avatarUrl: details.account.avatar_url || null,
        targetType: details.target_type || "selected",
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: {
          userId,
          accountLogin: details.account.login,
          accountType: details.account.type || "Organization",
          avatarUrl: details.account.avatar_url || null,
          targetType: details.target_type || "selected",
          updatedAt: new Date(),
        },
      })
      .returning();

    // 4. Upsert authorized repository inventory
    for (const repo of repositories) {
      await db
        .insert(githubRepositories)
        .values({
          installationId: savedInstallation.id,
          userId,
          githubRepoId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          isPrivate: repo.private,
          defaultBranch: repo.default_branch || "main",
        })
        .onConflictDoUpdate({
          target: githubRepositories.githubRepoId,
          set: {
            installationId: savedInstallation.id,
            userId,
            name: repo.name,
            fullName: repo.full_name,
            isPrivate: repo.private,
            defaultBranch: repo.default_branch || "main",
            updatedAt: new Date(),
          },
        });
    }

    if (wantsJson) {
      return NextResponse.json({
        success: true,
        installation: savedInstallation,
        repositoriesCount: repositories.length,
      });
    }

    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("connected", "success");
    redirectUrl.searchParams.set("org", details.account.login);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Failed to link GitHub installation";
    if (wantsJson) {
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("error", errorMsg);
    return NextResponse.redirect(redirectUrl);
  }
}
