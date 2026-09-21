import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { user, githubInstallations, githubRepositories, backupJobs } from "@/db/schema";
import { signWebhookPayload } from "@/lib/github/crypto";
import { POST as webhookHandler } from "@/app/api/github/webhook/route";

describe("GitHub Webhook Endpoint (/api/github/webhook)", () => {
  const TEST_USER_ID = "webhook-test-user";
  const TEST_INSTALLATION_ID = 88776655;
  const WEBHOOK_SECRET = "test-webhook-secret-999";
  let installationDbId: string;

  beforeAll(async () => {
    // 1. Ensure test user exists
    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Webhook Test User",
        email: "webhooktest@example.com",
      })
      .onConflictDoNothing();

    // 2. Ensure test installation exists
    const [savedInst] = await db
      .insert(githubInstallations)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALLATION_ID,
        accountLogin: "webhook-org",
        accountType: "Organization",
        avatarUrl: "https://avatars.githubusercontent.com/u/88776655?v=4",
        targetType: "selected",
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: {
          accountLogin: "webhook-org",
          updatedAt: new Date(),
        },
      })
      .returning();

    installationDbId = savedInst.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.userId, TEST_USER_ID));
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
  });

  beforeEach(() => {
    process.env.GITHUB_APP_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  describe("HMAC-SHA256 Signature Verification", () => {
    it("rejects requests missing the X-Hub-Signature-256 header with 401", async () => {
      const body = JSON.stringify({ action: "added" });
      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-github-event": "ping",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Missing signature header");
    });

    it("rejects requests with malformed signature header with 401", async () => {
      const body = JSON.stringify({ action: "added" });
      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": "invalid-format-signature",
          "x-github-event": "ping",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Malformed signature header");
    });

    it("rejects requests signed with an incorrect secret with 401", async () => {
      const body = JSON.stringify({ action: "added" });
      const wrongSignature = signWebhookPayload(body, "wrong-secret-key");

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": wrongSignature,
          "x-github-event": "ping",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Invalid payload signature");
    });

    it("rejects requests when GITHUB_APP_WEBHOOK_SECRET is unset on the server", async () => {
      delete process.env.GITHUB_APP_WEBHOOK_SECRET;
      const body = JSON.stringify({ action: "added" });
      const signature = signWebhookPayload(body, "any-secret");

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "ping",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Webhook secret is not configured");
    });

    it("returns 400 when payload is not valid JSON", async () => {
      const malformedBody = "not valid json {{{{";
      const signature = signWebhookPayload(malformedBody, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "ping",
        },
        body: malformedBody,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Malformed JSON");
    });
  });

  describe("Ping Event", () => {
    it("responds 200 OK with pong for GitHub ping event", async () => {
      const body = JSON.stringify({
        zen: "Responsive sync enabled.",
        hook_id: 1234567,
      });
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "ping",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("pong");
      expect(data.zen).toBe("Responsive sync enabled.");
    });
  });

  describe("installation_repositories Event: Added Repositories", () => {
    it("inserts newly added repositories into inventory", async () => {
      const newRepoId = 77001;
      const payload = {
        action: "added",
        installation: {
          id: TEST_INSTALLATION_ID,
          account: { login: "webhook-org" },
        },
        repository_selection: "selected",
        repositories_added: [
          {
            id: newRepoId,
            name: "service-auth",
            full_name: "webhook-org/service-auth",
            private: true,
            default_branch: "main",
          },
          {
            id: 77002,
            name: "service-billing",
            full_name: "webhook-org/service-billing",
            private: false,
            default_branch: "production",
          },
        ],
        repositories_removed: [],
      };

      const body = JSON.stringify(payload);
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "installation_repositories",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.success).toBe(true);
      expect(resData.addedCount).toBe(2);

      // Verify persistence in database
      const reposInDb = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.installationId, installationDbId));

      const authRepo = reposInDb.find((r) => r.githubRepoId === newRepoId);
      expect(authRepo).toBeDefined();
      expect(authRepo?.name).toBe("service-auth");
      expect(authRepo?.fullName).toBe("webhook-org/service-auth");
      expect(authRepo?.isPrivate).toBe(true);
      expect(authRepo?.defaultBranch).toBe("main");
      expect(authRepo?.userId).toBe(TEST_USER_ID);

      const billingRepo = reposInDb.find((r) => r.githubRepoId === 77002);
      expect(billingRepo).toBeDefined();
      expect(billingRepo?.name).toBe("service-billing");
      expect(billingRepo?.isPrivate).toBe(false);
      expect(billingRepo?.defaultBranch).toBe("production");
    });
  });

  describe("installation_repositories Event: Removed Repositories", () => {
    it("removes revoked repositories from inventory while retaining unaffected repositories", async () => {
      // 1. Seed two repositories in DB
      const repoKeep = 77010;
      const repoRemove = 77020;

      await db
        .insert(githubRepositories)
        .values([
          {
            installationId: installationDbId,
            userId: TEST_USER_ID,
            githubRepoId: repoKeep,
            name: "kept-repo",
            fullName: "webhook-org/kept-repo",
            isPrivate: false,
            defaultBranch: "main",
          },
          {
            installationId: installationDbId,
            userId: TEST_USER_ID,
            githubRepoId: repoRemove,
            name: "revoked-repo",
            fullName: "webhook-org/revoked-repo",
            isPrivate: true,
            defaultBranch: "main",
          },
        ])
        .onConflictDoNothing();

      // 2. Send webhook with repositories_removed
      const payload = {
        action: "removed",
        installation: {
          id: TEST_INSTALLATION_ID,
          account: { login: "webhook-org" },
        },
        repositories_added: [],
        repositories_removed: [
          {
            id: repoRemove,
            name: "revoked-repo",
            full_name: "webhook-org/revoked-repo",
          },
        ],
      };

      const body = JSON.stringify(payload);
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "installation_repositories",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.success).toBe(true);
      expect(resData.removedCount).toBe(1);

      // Verify removed repo is gone and kept repo remains
      const remainingRepos = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.installationId, installationDbId));

      const foundRemoved = remainingRepos.find((r) => r.githubRepoId === repoRemove);
      expect(foundRemoved).toBeUndefined();

      const foundKept = remainingRepos.find((r) => r.githubRepoId === repoKeep);
      expect(foundKept).toBeDefined();
    });
  });

  describe("installation_repositories Event: Simultaneous Added & Removed", () => {
    it("correctly inserts added repositories and removes revoked ones simultaneously", async () => {
      const repoExisting = 77050;
      const repoNew = 77051;

      // Seed existing
      await db
        .insert(githubRepositories)
        .values({
          installationId: installationDbId,
          userId: TEST_USER_ID,
          githubRepoId: repoExisting,
          name: "to-be-replaced",
          fullName: "webhook-org/to-be-replaced",
          isPrivate: false,
          defaultBranch: "main",
        })
        .onConflictDoNothing();

      const payload = {
        action: "added",
        installation: {
          id: TEST_INSTALLATION_ID,
          account: { login: "webhook-org" },
        },
        repositories_added: [
          {
            id: repoNew,
            name: "brand-new-repo",
            full_name: "webhook-org/brand-new-repo",
            private: false,
            default_branch: "develop",
          },
        ],
        repositories_removed: [
          {
            id: repoExisting,
            name: "to-be-replaced",
            full_name: "webhook-org/to-be-replaced",
          },
        ],
      };

      const body = JSON.stringify(payload);
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "installation_repositories",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);

      const inDb = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.installationId, installationDbId));

      expect(inDb.some((r) => r.githubRepoId === repoExisting)).toBe(false);
      expect(inDb.some((r) => r.githubRepoId === repoNew)).toBe(true);
    });
  });

  describe("Unrecognized Installation", () => {
    it("gracefully acknowledges and skips events for unknown installations", async () => {
      const unknownId = 9999999999;
      const payload = {
        action: "added",
        installation: { id: unknownId },
        repositories_added: [
          { id: 12345, name: "foo", full_name: "unknown/foo" },
        ],
      };

      const body = JSON.stringify(payload);
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "installation_repositories",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("not registered in local database");
    });
  });

  describe("installation Event Lifecycle (Ticket 02)", () => {
    it("action: 'deleted' transitions installation to disconnected, sets disconnectedAt, disables repository backups, and cancels running jobs", async () => {
      // 1. Setup active installation with repositories and running + completed jobs
      const deletedInstId = 99112233;
      const [inst] = await db
        .insert(githubInstallations)
        .values({
          userId: TEST_USER_ID,
          installationId: deletedInstId,
          accountLogin: "deleted-lifecycle-org",
          accountType: "Organization",
          avatarUrl: "https://avatars.githubusercontent.com/u/99112233?v=4",
          targetType: "selected",
          status: "active",
        })
        .onConflictDoUpdate({
          target: githubInstallations.installationId,
          set: { status: "active", disconnectedAt: null },
        })
        .returning();

      const [repo] = await db
        .insert(githubRepositories)
        .values({
          installationId: inst.id,
          userId: TEST_USER_ID,
          githubRepoId: 9911223301,
          name: "repo-to-disconnect",
          fullName: "deleted-lifecycle-org/repo-to-disconnect",
          isPrivate: true,
          defaultBranch: "main",
          backupEnabled: true,
          lastBackupStatus: "running",
        })
        .returning();

      // Running job to be cancelled
      const [runningJob] = await db
        .insert(backupJobs)
        .values({
          repositoryId: repo.id,
          userId: TEST_USER_ID,
          status: "running",
          triggerType: "scheduled",
          startedAt: new Date(),
        })
        .returning();

      // Historical completed job to be preserved
      const [completedJob] = await db
        .insert(backupJobs)
        .values({
          repositoryId: repo.id,
          userId: TEST_USER_ID,
          status: "completed",
          triggerType: "manual",
          s3Key: "backups/repo-to-disconnect/historical.bundle",
          commitSha: "abc1234",
          completedAt: new Date(),
        })
        .returning();

      // 2. Deliver webhook for installation.deleted
      const payload = {
        action: "deleted",
        installation: {
          id: deletedInstId,
          account: { login: "deleted-lifecycle-org" },
        },
      };

      const body = JSON.stringify(payload);
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "installation",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.success).toBe(true);
      expect(resData.status).toBe("disconnected");

      // 3. Verify database state transitions
      const [updatedInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, inst.id));
      expect(updatedInst.status).toBe("disconnected");
      expect(updatedInst.disconnectedAt).not.toBeNull();

      const [updatedRepo] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, repo.id));
      expect(updatedRepo.backupEnabled).toBe(false);
      expect(updatedRepo.lastBackupStatus).toBe("failed");

      const [cancelledJob] = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.id, runningJob.id));
      expect(cancelledJob.status).toBe("failed");
      expect(cancelledJob.errorMessage).toBe("Installation disconnected by user");

      const [preservedJob] = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.id, completedJob.id));
      expect(preservedJob.status).toBe("completed");
      expect(preservedJob.s3Key).toBe("backups/repo-to-disconnect/historical.bundle");
    });

    it("action: 'suspend' updates installation status to suspended and disables repository backup schedules", async () => {
      const suspendInstId = 99112244;
      const [inst] = await db
        .insert(githubInstallations)
        .values({
          userId: TEST_USER_ID,
          installationId: suspendInstId,
          accountLogin: "suspend-lifecycle-org",
          accountType: "Organization",
          avatarUrl: "https://avatars.githubusercontent.com/u/99112244?v=4",
          targetType: "all",
          status: "active",
        })
        .onConflictDoUpdate({
          target: githubInstallations.installationId,
          set: { status: "active", disconnectedAt: null },
        })
        .returning();

      const [repo] = await db
        .insert(githubRepositories)
        .values({
          installationId: inst.id,
          userId: TEST_USER_ID,
          githubRepoId: 9911224401,
          name: "repo-to-suspend",
          fullName: "suspend-lifecycle-org/repo-to-suspend",
          isPrivate: false,
          defaultBranch: "main",
          backupEnabled: true,
        })
        .returning();

      const payload = {
        action: "suspend",
        installation: {
          id: suspendInstId,
          account: { login: "suspend-lifecycle-org" },
        },
      };

      const body = JSON.stringify(payload);
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "installation",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.success).toBe(true);
      expect(resData.status).toBe("suspended");

      // Verify in DB: status is suspended, disconnectedAt is NOT set, backupEnabled is false
      const [updatedInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, inst.id));
      expect(updatedInst.status).toBe("suspended");
      expect(updatedInst.disconnectedAt).toBeNull();

      const [updatedRepo] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, repo.id));
      expect(updatedRepo.backupEnabled).toBe(false);
    });

    it("action: 'unsuspend' restores installation status to active", async () => {
      const unsuspendInstId = 99112255;
      const [inst] = await db
        .insert(githubInstallations)
        .values({
          userId: TEST_USER_ID,
          installationId: unsuspendInstId,
          accountLogin: "unsuspend-lifecycle-org",
          accountType: "Organization",
          targetType: "all",
          status: "suspended",
        })
        .onConflictDoUpdate({
          target: githubInstallations.installationId,
          set: { status: "suspended" },
        })
        .returning();

      const payload = {
        action: "unsuspend",
        installation: {
          id: unsuspendInstId,
          account: { login: "unsuspend-lifecycle-org" },
        },
      };

      const body = JSON.stringify(payload);
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "installation",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.success).toBe(true);
      expect(resData.status).toBe("active");

      // Verify in DB: status restored to active
      const [updatedInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, inst.id));
      expect(updatedInst.status).toBe("active");
    });

    it("gracefully acknowledges already disconnected installations with 200 OK without re-processing", async () => {
      const alreadyDisconnectedInstId = 99112266;
      const disconnectedDate = new Date("2026-09-01T12:00:00Z");

      const [inst] = await db
        .insert(githubInstallations)
        .values({
          userId: TEST_USER_ID,
          installationId: alreadyDisconnectedInstId,
          accountLogin: "already-disconnected-org",
          accountType: "Organization",
          targetType: "all",
          status: "disconnected",
          disconnectedAt: disconnectedDate,
        })
        .onConflictDoUpdate({
          target: githubInstallations.installationId,
          set: { status: "disconnected", disconnectedAt: disconnectedDate },
        })
        .returning();

      // Test duplicate deleted event
      const payloadDeleted = {
        action: "deleted",
        installation: {
          id: alreadyDisconnectedInstId,
        },
      };
      const bodyDeleted = JSON.stringify(payloadDeleted);
      const sigDeleted = signWebhookPayload(bodyDeleted, WEBHOOK_SECRET);

      const reqDeleted = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": sigDeleted,
          "x-github-event": "installation",
        },
        body: bodyDeleted,
      });

      const resDeleted = await webhookHandler(reqDeleted);
      expect(resDeleted.status).toBe(200);
      const dataDeleted = await resDeleted.json();
      expect(dataDeleted.success).toBe(true);
      expect(dataDeleted.message).toContain("already disconnected");

      // Test suspend event on already disconnected installation
      const payloadSuspend = {
        action: "suspend",
        installation: {
          id: alreadyDisconnectedInstId,
        },
      };
      const bodySuspend = JSON.stringify(payloadSuspend);
      const sigSuspend = signWebhookPayload(bodySuspend, WEBHOOK_SECRET);

      const reqSuspend = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": sigSuspend,
          "x-github-event": "installation",
        },
        body: bodySuspend,
      });

      const resSuspend = await webhookHandler(reqSuspend);
      expect(resSuspend.status).toBe(200);
      const dataSuspend = await resSuspend.json();
      expect(dataSuspend.success).toBe(true);
      expect(dataSuspend.message).toContain("already disconnected");

      // Test unsuspend event on already disconnected installation (should not resurrect)
      const payloadUnsuspend = {
        action: "unsuspend",
        installation: {
          id: alreadyDisconnectedInstId,
        },
      };
      const bodyUnsuspend = JSON.stringify(payloadUnsuspend);
      const sigUnsuspend = signWebhookPayload(bodyUnsuspend, WEBHOOK_SECRET);

      const reqUnsuspend = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": sigUnsuspend,
          "x-github-event": "installation",
        },
        body: bodyUnsuspend,
      });

      const resUnsuspend = await webhookHandler(reqUnsuspend);
      expect(resUnsuspend.status).toBe(200);
      const dataUnsuspend = await resUnsuspend.json();
      expect(dataUnsuspend.success).toBe(true);
      expect(dataUnsuspend.message).toContain("already disconnected");

      // Verify installation record is still disconnected and preserved
      const [finalInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, inst.id));
      expect(finalInst.status).toBe("disconnected");
      expect(finalInst.disconnectedAt?.toISOString()).toBe(disconnectedDate.toISOString());
    });

    it("gracefully acknowledges unrecognized installations on installation events with 200 OK", async () => {
      const unknownInstId = 9999888877;
      const payload = {
        action: "deleted",
        installation: {
          id: unknownInstId,
        },
      };

      const body = JSON.stringify(payload);
      const signature = signWebhookPayload(body, WEBHOOK_SECRET);

      const req = new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
          "x-github-event": "installation",
        },
        body,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("not registered in local database");
    });
  });
});
