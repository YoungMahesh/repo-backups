import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { user, githubInstallations, githubRepositories } from "@/db/schema";
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
});
