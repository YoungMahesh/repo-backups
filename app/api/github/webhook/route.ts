import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { githubInstallations, githubRepositories } from "@/db/schema";
import { verifyWebhookSignature } from "@/lib/github/crypto";
import {
  disconnectInstallationLocally,
  suspendInstallationLocally,
  unsuspendInstallationLocally,
} from "@/lib/github/disconnection";

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
  interface GitHubWebhookPayload {
    action?: string;
    zen?: string;
    installation?: {
      id?: number;
      account?: {
        login?: string;
        type?: string;
        avatar_url?: string;
      };
    };
    repository_selection?: string;
    repositories?: Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      default_branch?: string;
    }>;
    repositories_added?: Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      default_branch?: string;
    }>;
    repositories_removed?: Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      default_branch?: string;
    }>;
    [key: string]: unknown;
  }

  let payload: GitHubWebhookPayload;
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

  // 5. Handle installation lifecycle events (Ticket 02)
  if (
    event === "installation" ||
    (payload.installation &&
      (payload.action === "deleted" ||
        payload.action === "suspend" ||
        payload.action === "unsuspend"))
  ) {
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
      // Gracefully acknowledge unrecognized installations with 200 OK
      return NextResponse.json(
        {
          success: true,
          message: `Installation ${installationIdNumber} not registered in local database; event skipped`,
        },
        { status: 200 },
      );
    }

    // Gracefully acknowledge already disconnected installations with 200 OK
    if (installation.status === "disconnected") {
      return NextResponse.json(
        {
          success: true,
          message: `Installation ${installationIdNumber} is already disconnected; event skipped`,
        },
        { status: 200 },
      );
    }

    const action = payload.action;

    if (action === "deleted") {
      const { disabledRepositoriesCount, cancelledJobsCount } =
        await disconnectInstallationLocally(installation.id);

      return NextResponse.json(
        {
          success: true,
          action: "deleted",
          installationId: installationIdNumber,
          status: "disconnected",
          disabledRepositoriesCount,
          cancelledJobsCount,
        },
        { status: 200 },
      );
    }

    if (action === "suspend") {
      const { disabledRepositoriesCount } =
        await suspendInstallationLocally(installation.id);

      return NextResponse.json(
        {
          success: true,
          action: "suspend",
          installationId: installationIdNumber,
          status: "suspended",
          disabledRepositoriesCount,
        },
        { status: 200 },
      );
    }

    if (action === "unsuspend") {
      await unsuspendInstallationLocally(installation.id);

      return NextResponse.json(
        {
          success: true,
          action: "unsuspend",
          installationId: installationIdNumber,
          status: "active",
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Installation action "${action}" acknowledged`,
      },
      { status: 200 },
    );
  }

  // 6. Handle installation_repositories events
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
