import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { renderToString } from "react-dom/server";
import React from "react";
import { db } from "@/db";
import { user, githubInstallations, githubRepositories, backupJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  setMockGitHubClient,
  deleteInstallation,
} from "@/lib/github/client";
import { cancelInFlightJobsForInstallation } from "@/lib/backup/engine";
import { DELETE as deleteSingleInstallationHandler } from "@/app/api/installations/[id]/route";
import {
  GET as installationsHandler,
  DELETE as deleteInstallationHandler,
} from "@/app/api/installations/route";
import { OrganizationCard } from "@/components/github/organization-card";
import { DisconnectInstallationModal } from "@/components/github/disconnect-modal";

describe("User-Initiated Installation Disconnection (Ticket 01)", () => {
  const USER_A_ID = "disc-test-user-a";
  const USER_B_ID = "disc-test-user-b";
  const INSTALLATION_A_ID = 881001;
  const INSTALLATION_B_ID = 881002;

  let dbInstallationAId: string;
  let dbInstallationBId: string;
  let repoA1Id: string;
  let repoA2Id: string;

  beforeAll(async () => {
    // 1. Create test users
    await db
      .insert(user)
      .values([
        {
          id: USER_A_ID,
          name: "Disconnect User A",
          email: "disc-usera@example.com",
        },
        {
          id: USER_B_ID,
          name: "Disconnect User B",
          email: "disc-userb@example.com",
        },
      ])
      .onConflictDoNothing();

    // 2. Insert test installations
    const [instA] = await db
      .insert(githubInstallations)
      .values({
        userId: USER_A_ID,
        installationId: INSTALLATION_A_ID,
        accountLogin: "acme-corp",
        accountType: "Organization",
        targetType: "selected",
        status: "active",
      })
      .returning();
    dbInstallationAId = instA.id;

    const [instB] = await db
      .insert(githubInstallations)
      .values({
        userId: USER_B_ID,
        installationId: INSTALLATION_B_ID,
        accountLogin: "other-org",
        accountType: "Organization",
        targetType: "selected",
        status: "active",
      })
      .returning();
    dbInstallationBId = instB.id;

    // 3. Insert test repositories for installation A
    const [r1, r2] = await db
      .insert(githubRepositories)
      .values([
        {
          installationId: dbInstallationAId,
          userId: USER_A_ID,
          githubRepoId: 9001,
          name: "backend-core",
          fullName: "acme-corp/backend-core",
          isPrivate: true,
          defaultBranch: "main",
          backupEnabled: true,
          backupSchedule: "daily",
        },
        {
          installationId: dbInstallationAId,
          userId: USER_A_ID,
          githubRepoId: 9002,
          name: "frontend-app",
          fullName: "acme-corp/frontend-app",
          isPrivate: false,
          defaultBranch: "main",
          backupEnabled: true,
          backupSchedule: "weekly",
        },
      ])
      .returning();
    repoA1Id = r1.id;
    repoA2Id = r2.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(backupJobs).where(eq(backupJobs.userId, USER_A_ID));
    await db.delete(backupJobs).where(eq(backupJobs.userId, USER_B_ID));
    await db.delete(githubRepositories).where(eq(githubRepositories.userId, USER_A_ID));
    await db.delete(githubRepositories).where(eq(githubRepositories.userId, USER_B_ID));
    await db.delete(githubInstallations).where(eq(githubInstallations.userId, USER_A_ID));
    await db.delete(githubInstallations).where(eq(githubInstallations.userId, USER_B_ID));
    await db.delete(user).where(eq(user.id, USER_A_ID));
    await db.delete(user).where(eq(user.id, USER_B_ID));
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    setMockGitHubClient(null);
  });

  describe("Remote GitHub Client Deletion (Criterion 2)", () => {
    it("deletes remote installation using RS256 JWT and handles 204 No Content as success", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 204, statusText: "No Content" }),
      );

      const result = await deleteInstallation(12345);
      expect(result.success).toBe(true);
      expect(result.alreadyDeleted).toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.github.com/app/installations/12345",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Accept: "application/vnd.github+json",
          }),
        }),
      );
    });

    it("treats remote 404 Not Found as success (already deleted remotely)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          statusText: "Not Found",
        }),
      );

      const result = await deleteInstallation(99999);
      expect(result.success).toBe(true);
      expect(result.alreadyDeleted).toBe(true);
    });

    it("throws error when GitHub API returns unexpected non-2xx status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      await expect(deleteInstallation(12345)).rejects.toThrow(
        "Failed to delete installation from GitHub: 500",
      );
    });

    it("supports mock client override via setMockGitHubClient", async () => {
      let customDeletedId: number | null = null;
      setMockGitHubClient({
        deleteInstallation: (id) => {
          customDeletedId = id;
        },
      });

      const result = await deleteInstallation(777);
      expect(result.success).toBe(true);
      expect(customDeletedId).toBe(777);
    });

    it("throws custom mock error when deleteInstallationError is set", async () => {
      setMockGitHubClient({
        deleteInstallationError: new Error("Simulated network timeout"),
      });

      await expect(deleteInstallation(777)).rejects.toThrow("Simulated network timeout");
    });
  });

  describe("In-Flight Backup Job Abort Logic (Criterion 4)", () => {
    it("cancels running backup jobs for the installation and marks them failed with 'Installation disconnected by user'", async () => {
      // Create a running job and a completed job for repoA1
      const [runningJob] = await db
        .insert(backupJobs)
        .values({
          repositoryId: repoA1Id,
          userId: USER_A_ID,
          status: "running",
          s3Bucket: "test-bucket",
          s3Key: "backups/test/repoA1/bundle1.bundle",
          startedAt: new Date(),
        })
        .returning();

      const [completedJob] = await db
        .insert(backupJobs)
        .values({
          repositoryId: repoA1Id,
          userId: USER_A_ID,
          status: "completed",
          s3Bucket: "test-bucket",
          s3Key: "backups/test/repoA1/bundle0.bundle",
          commitSha: "abc1234",
          bundleSizeBytes: 1024,
          completedAt: new Date(),
        })
        .returning();

      const abortResult = await cancelInFlightJobsForInstallation(dbInstallationAId);
      expect(abortResult.cancelledJobsCount).toBe(1);
      expect(abortResult.cancelledJobIds).toContain(runningJob.id);

      // Verify the running job transitioned to failed with exact cancellation message
      const [checkedJob] = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.id, runningJob.id));
      expect(checkedJob.status).toBe("failed");
      expect(checkedJob.errorMessage).toBe("Installation disconnected by user");
      expect(checkedJob.completedAt).toBeDefined();

      // Verify historical completed job is completely untouched
      const [checkedCompleted] = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.id, completedJob.id));
      expect(checkedCompleted.status).toBe("completed");
      expect(checkedCompleted.s3Key).toBe("backups/test/repoA1/bundle0.bundle");
    });
  });

  describe("Disconnection Route Handler (Criteria 3 & 5)", () => {
    const mockAuthUser = (userId: string) => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: {
          id: userId,
          email: `${userId}@example.com`,
          name: "Test User",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: `session-${userId}`,
          userId,
          expiresAt: new Date(),
          token: `token-${userId}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    };

    it("rejects unauthenticated request with 401", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/installations/${dbInstallationAId}`, {
        method: "DELETE",
      });
      const res = await deleteSingleInstallationHandler(req, {
        params: Promise.resolve({ id: dbInstallationAId }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Authentication required");
    });

    it("rejects non-existent installation with 404", async () => {
      mockAuthUser(USER_A_ID);

      const req = new NextRequest("http://localhost:3000/api/installations/non-existent-id", {
        method: "DELETE",
      });
      const res = await deleteSingleInstallationHandler(req, {
        params: Promise.resolve({ id: "non-existent-id" }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("Installation not found");
    });

    it("rejects unauthorized user attempting to disconnect another user's installation with 403", async () => {
      // User B attempts to disconnect User A's installation
      mockAuthUser(USER_B_ID);

      const req = new NextRequest(`http://localhost:3000/api/installations/${dbInstallationAId}`, {
        method: "DELETE",
      });
      const res = await deleteSingleInstallationHandler(req, {
        params: Promise.resolve({ id: dbInstallationAId }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
    });

    it("successfully disconnects installation: sets status='disconnected', disconnectedAt=now(), disables backup schedules, and preserves records", async () => {
      mockAuthUser(USER_A_ID);
      let remoteDeletedCalled = false;
      setMockGitHubClient({
        deleteInstallation: (id) => {
          if (id === INSTALLATION_A_ID) remoteDeletedCalled = true;
        },
      });

      // Add a running backup job before disconnecting
      const [runningJob] = await db
        .insert(backupJobs)
        .values({
          repositoryId: repoA2Id,
          userId: USER_A_ID,
          status: "running",
          s3Bucket: "test-bucket",
          s3Key: "backups/acme-corp/frontend-app/bundle-in-flight.bundle",
          startedAt: new Date(),
        })
        .returning();

      const req = new NextRequest(`http://localhost:3000/api/installations/${dbInstallationAId}`, {
        method: "DELETE",
      });
      const res = await deleteSingleInstallationHandler(req, {
        params: Promise.resolve({ id: dbInstallationAId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.installation.status).toBe("disconnected");
      expect(data.installation.disconnectedAt).toBeDefined();
      expect(data.disabledRepositoriesCount).toBe(2);
      expect(data.cancelledJobsCount).toBeGreaterThanOrEqual(1);
      expect(remoteDeletedCalled).toBe(true);

      // Verify in DB that installation record is preserved and disconnected
      const [savedInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, dbInstallationAId));
      expect(savedInst.status).toBe("disconnected");
      expect(savedInst.disconnectedAt).toBeDefined();

      // Verify associated repositories have backupEnabled = false
      const savedRepos = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.installationId, dbInstallationAId));
      expect(savedRepos.length).toBe(2);
      expect(savedRepos.every((r) => r.backupEnabled === false)).toBe(true);

      // Verify the in-flight job was marked failed with the exact error message
      const [savedJob] = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.id, runningJob.id));
      expect(savedJob.status).toBe("failed");
      expect(savedJob.errorMessage).toBe("Installation disconnected by user");
      // Historical S3 key was preserved
      expect(savedJob.s3Key).toBe("backups/acme-corp/frontend-app/bundle-in-flight.bundle");
    });

    it("resiliently disconnects locally even if remote GitHub API returns an error", async () => {
      mockAuthUser(USER_B_ID);
      // Mock GitHub failure
      setMockGitHubClient({
        deleteInstallationError: new Error("GitHub API connection timeout"),
      });

      const req = new NextRequest(`http://localhost:3000/api/installations/${dbInstallationBId}`, {
        method: "DELETE",
      });
      const res = await deleteSingleInstallationHandler(req, {
        params: Promise.resolve({ id: dbInstallationBId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.installation.status).toBe("disconnected");
      expect(data.warning).toContain("GitHub API connection timeout");

      // Verify DB updated to disconnected
      const [savedInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, dbInstallationBId));
      expect(savedInst.status).toBe("disconnected");
    });

    it("DELETE /api/installations also supports deletion via JSON body", async () => {
      mockAuthUser(USER_A_ID);
      setMockGitHubClient({ deleteInstallation: () => {} });

      const req = new NextRequest("http://localhost:3000/api/installations", {
        method: "DELETE",
        body: JSON.stringify({ id: dbInstallationAId }),
      });
      const res = await deleteInstallationHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Status Filtering on GET /api/installations (Spec Decision)", () => {
    beforeEach(() => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: {
          id: USER_A_ID,
          email: "disc-usera@example.com",
          name: "Test User A",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-a",
          userId: USER_A_ID,
          expiresAt: new Date(),
          token: "token-a",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    it("GET /api/installations defaults to active installations (excluding disconnected)", async () => {
      const req = new NextRequest("http://localhost:3000/api/installations");
      const res = await installationsHandler(req);

      interface InstallationItem {
        id: string;
        status?: string;
        disconnectedAt?: string | null;
      }

      expect(res.status).toBe(200);
      const data = await res.json();
      // Installation A is disconnected, so it should NOT appear in default active list
      expect(data.installations.some((i: InstallationItem) => i.id === dbInstallationAId)).toBe(false);
    });

    it("GET /api/installations?status=disconnected returns disconnected installations", async () => {
      const req = new NextRequest("http://localhost:3000/api/installations?status=disconnected");
      const res = await installationsHandler(req);

      interface InstallationItem {
        id: string;
        status?: string;
        disconnectedAt?: string | null;
      }

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.installations.some((i: InstallationItem) => i.id === dbInstallationAId)).toBe(true);
      const found = data.installations.find((i: InstallationItem) => i.id === dbInstallationAId);
      expect(found.status).toBe("disconnected");
      expect(found.disconnectedAt).toBeDefined();
    });

    it("GET /api/installations?status=all returns all installations regardless of status", async () => {
      const req = new NextRequest("http://localhost:3000/api/installations?status=all");
      const res = await installationsHandler(req);

      interface InstallationItem {
        id: string;
      }

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.installations.some((i: InstallationItem) => i.id === dbInstallationAId)).toBe(true);
    });
  });

  describe("UI Components & Modal Confirmation Behavior (Criteria 6, 7 & 8)", () => {
    const mockInstallation = {
      id: "inst-modal-1",
      installationId: 54321,
      accountLogin: "acme-corp",
      accountType: "Organization",
      avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
      targetType: "selected",
      repositoryCount: 3,
    };

    it("OrganizationCard renders a destructive Disconnect button adhering to warm-canvas design", () => {
      const html = renderToString(
        <OrganizationCard
          installation={mockInstallation}
          onSync={async () => {}}
        />,
      );

      expect(html).toContain("data-testid=\"disconnect-button\"");
      expect(html).toContain("Disconnect");
      expect(html).toContain("text-error");
    });

    it("DisconnectInstallationModal returns null when closed", () => {
      const html = renderToString(
        <DisconnectInstallationModal
          isOpen={false}
          onClose={() => {}}
          onConfirm={() => {}}
          accountLogin="acme-corp"
        />,
      );

      expect(html).toBe("");
    });

    it("DisconnectInstallationModal renders S3 preservation alert reassuring user", () => {
      const html = renderToString(
        <DisconnectInstallationModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          accountLogin="acme-corp"
        />,
      );

      expect(html).toContain("data-testid=\"disconnect-modal\"");
      expect(html).toContain("data-testid=\"s3-preservation-alert\"");
      expect(html).toContain("Historical Backup Bundles in S3 Remain Safe");
      expect(html).toContain("All past disaster-recovery archives and standalone Git bundles stored in S3 remain completely safe");
    });

    it("DisconnectInstallationModal has confirm button disabled initially when typed login does not match", () => {
      const html = renderToString(
        <DisconnectInstallationModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          accountLogin="acme-corp"
        />,
      );

      // Confirm button is disabled because typed login is empty
      expect(html).toMatch(/<button[^>]*disabled[^>]*data-testid="confirm-disconnect-button"/);
      expect(html).toContain("data-testid=\"disconnect-confirm-input\"");
      expect(html).toContain("acme-corp");
    });
  });
});
