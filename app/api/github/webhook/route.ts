import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";
import { verifyWebhookSignature } from "@/lib/github/crypto";

export async function POST(request: NextRequest) {
  // 1. Read raw body text to preserve exact bytes for HMAC validation
  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("X-Hub-Signature-256");

  // 2. Cryptographic signature verification
  const verification = verifyWebhookSignature(rawBody, signatureHeader);
  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error || "Invalid webhook signature" },
      { status: 401 },
    );
  }

  // 3. Parse JSON payload
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON payload" },
      { status: 400 },
    );
  }

  const event =
    request.headers.get("x-github-event") ||
    request.headers.get("X-GitHub-Event") ||
    "";

  // 4. Handle Ping event
  if (event === "ping") {
    return NextResponse.json(
      {
        success: true,
        message: "pong",
        zen: payload.zen || "Responsive sync enabled.",
      },
      { status: 200 },
    );
  }

  // 5. Handle installation_repositories events
  if (event === "installation_repositories" || payload.repositories_added || payload.repositories_removed) {
    const installationIdNumber = payload.installation?.id;
    if (!installationIdNumber) {
      return NextResponse.json(
        { error: "Missing installation information in payload" },
        { status: 400 },
      );
    }

    // Locate linked installation in database
    const [installation] = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, installationIdNumber))
      .limit(1);

    if (!installation) {
      // Return 200 OK so GitHub does not endlessly retry deliveries for unrecognized installations
      return NextResponse.json(
        {
          success: true,
          message: `Installation ${installationIdNumber} not registered in local database; event skipped`,
        },
        { status: 200 },
      );
    }

    const action = payload.action;
    const addedRepos =
      payload.repositories_added ||
      (action === "added" ? payload.repositories : []) ||
      [];
    const removedRepos =
      payload.repositories_removed ||
      (action === "removed" ? payload.repositories : []) ||
      [];

    let insertedCount = 0;
    let removedCount = 0;

    // Handle added repositories: insert into inventory
    if (Array.isArray(addedRepos) && addedRepos.length > 0) {
      for (const repo of addedRepos) {
        if (!repo || !repo.id || !repo.name) continue;

        await db
          .insert(githubRepositories)
          .values({
            installationId: installation.id,
            userId: installation.userId,
            githubRepoId: repo.id,
            name: repo.name,
            fullName: repo.full_name || `${installation.accountLogin}/${repo.name}`,
            isPrivate: Boolean(repo.private),
            defaultBranch: repo.default_branch || "main",
          })
          .onConflictDoUpdate({
            target: githubRepositories.githubRepoId,
            set: {
              installationId: installation.id,
              userId: installation.userId,
              name: repo.name,
              fullName: repo.full_name || `${installation.accountLogin}/${repo.name}`,
              isPrivate: Boolean(repo.private),
              defaultBranch: repo.default_branch || "main",
              updatedAt: new Date(),
            },
          });

        insertedCount++;
      }
    }

    // Handle removed repositories: delete or deactivate from inventory
    if (Array.isArray(removedRepos) && removedRepos.length > 0) {
      const removedIds: number[] = removedRepos
        .map((r) => r?.id)
        .filter((id): id is number => typeof id === "number");

      if (removedIds.length > 0) {
        await db
          .delete(githubRepositories)
          .where(
            and(
              eq(githubRepositories.installationId, installation.id),
              inArray(githubRepositories.githubRepoId, removedIds),
            ),
          );

        removedCount = removedIds.length;
      }
    }

    // Update repository_selection / targetType on installation if specified
    if (payload.repository_selection) {
      await db
        .update(githubInstallations)
        .set({
          targetType: payload.repository_selection,
          updatedAt: new Date(),
        })
        .where(eq(githubInstallations.id, installation.id));
    }

    return NextResponse.json(
      {
        success: true,
        action,
        installationId: installationIdNumber,
        addedCount: insertedCount,
        removedCount,
      },
      { status: 200 },
    );
  }

  // Handle other webhook events gracefully
  return NextResponse.json(
    {
      success: true,
      message: `Event "${event}" received and acknowledged`,
    },
    { status: 200 },
  );
}
