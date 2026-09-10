import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  user,
  githubInstallations,
  githubRepositories,
  backupJobs,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { setMockGitHubClient } from "@/lib/github/client";
import { setMockS3Storage, MockS3Storage } from "@/lib/storage/s3";
import {
  setMockGitRunner,
  setRetryDelayOverride,
} from "@/lib/backup/engine";
import { GET as downloadHandler } from "@/app/api/backups/[id]/download/route";
import { POST as retryHandler } from "@/app/api/backups/[id]/retry/route";

describe("Backup Download & Retry Routes", () => {
  const TEST_USER_A = "user-download-test-a";
  const TEST_USER_B = "user-download-test-b";
  const TEST_INSTALLATION_A = "inst-download-test-a";
  const TEST_GITHUB_INSTALL_A = 887766;

  let repoAId: string;
  let completedJobId: string;
  let failedJobId: string;
  let pendingJobId: string;
  let mockS3: MockS3Storage;

  beforeAll(async () => {
    setRetryDelayOverride(0);

    // Create user A & B
    await db
      .insert(user)
      .values([
        { id: TEST_USER_A, name: "User A", email: "usera@example.com" },
        { id: TEST_USER_B, name: "User B", email: "userb@example.com" },
      ])
      .onConflictDoNothing();

    // Create installation for User A
    await db
      .insert(githubInstallations)
      .values({
        id: TEST_INSTALLATION_A,
        userId: TEST_USER_A,
        installationId: TEST_GITHUB_INSTALL_A,
        accountLogin: "test-org-dl",
        accountType: "Organization",
        targetType: "selected",
      })
      .onConflictDoNothing();

    // Create repository for User A
    const [repoA] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_A,
        installationId: TEST_INSTALLATION_A,
        githubRepoId: 999111,
        name: "test-dl-repo",
        fullName: "test-org-dl/test-dl-repo",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "daily",
      })
      .returning();
    repoAId = repoA.id;

    // Create completed backup job
    const [compJob] = await db
      .insert(backupJobs)
      .values({
        userId: TEST_USER_A,
        repositoryId: repoAId,
        status: "completed",
        triggerType: "manual",
        s3Bucket: "repo-backups",
        s3Key: "backups/user-download-test-a/test-org-dl/test-dl-repo/1700000000-c0ffee1234567890abcdef.bundle",
        bundleSizeBytes: 1048576,
        commitSha: "c0ffee1234567890abcdef",
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
      })
      .returning();
    completedJobId = compJob.id;

    // Create failed backup job
    const [failJob] = await db
      .insert(backupJobs)
      .values({
        userId: TEST_USER_A,
        repositoryId: repoAId,
        status: "failed",
        triggerType: "scheduled",
        s3Bucket: "repo-backups",
        errorMessage: "Simulated git mirror clone timeout",
        retryCount: 2,
        startedAt: new Date(Date.now() - 120000),
        completedAt: new Date(Date.now() - 60000),
      })
      .returning();
    failedJobId = failJob.id;

    // Create pending backup job
    const [pendJob] = await db
      .insert(backupJobs)
      .values({
        userId: TEST_USER_A,
        repositoryId: repoAId,
        status: "pending",
        triggerType: "manual",
      })
      .returning();
    pendingJobId = pendJob.id;
  });

  afterAll(async () => {
    setRetryDelayOverride(null);
    setMockGitRunner(null);
    setMockS3Storage(null);

    await db.delete(backupJobs).where(eq(backupJobs.userId, TEST_USER_A));
    await db.delete(backupJobs).where(eq(backupJobs.userId, TEST_USER_B));
    await db.delete(githubRepositories).where(eq(githubRepositories.userId, TEST_USER_A));
    await db.delete(githubInstallations).where(eq(githubInstallations.userId, TEST_USER_A));
    await db.delete(user).where(eq(user.id, TEST_USER_A));
    await db.delete(user).where(eq(user.id, TEST_USER_B));
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    mockS3 = {
      ensureBucketCalls: [],
      uploadCalls: [],
      presignedUrlCalls: [],
    };
    setMockS3Storage(mockS3);

    setMockGitHubClient({
      installation: {
        id: TEST_GITHUB_INSTALL_A,
        account: {
          login: "test-org-dl",
          type: "Organization",
        },
        target_type: "selected",
      },
      repositories: [],
    });

    setMockGitRunner({
      runBundle: async () => ({
        commitSha: "retrynewsha1234567890abcdef1234567890",
        bundleSizeBytes: 2048,
        bundleContent: Buffer.from("mock-new-retry-bundle"),
      }),
    });

    // Default mock session for User A
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: TEST_USER_A,
        email: "usera@example.com",
        name: "User A",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-a",
        userId: TEST_USER_A,
        expiresAt: new Date(),
        token: "token-a",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  describe("GET /api/backups/[id]/download", () => {
    it("returns 401 when user is unauthenticated", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost:3000/api/backups/${completedJobId}/download`,
      );
      const res = await downloadHandler(req, {
        params: Promise.resolve({ id: completedJobId }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Authentication required");
    });

    it("returns 404 when backup job does not exist", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/backups/non-existent-job-id/download",
      );
      const res = await downloadHandler(req, {
        params: Promise.resolve({ id: "non-existent-job-id" }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("Backup job not found");
    });

    it("returns 404 when backup job belongs to another user (authorization check)", async () => {
      // User B tries to download User A's backup
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: {
          id: TEST_USER_B,
          email: "userb@example.com",
          name: "User B",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-b",
          userId: TEST_USER_B,
          expiresAt: new Date(),
          token: "token-b",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/backups/${completedJobId}/download`,
      );
      const res = await downloadHandler(req, {
        params: Promise.resolve({ id: completedJobId }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("Backup job not found");
    });

    it("returns 400 when backup job status is not completed", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/backups/${pendingJobId}/download`,
      );
      const res = await downloadHandler(req, {
        params: Promise.resolve({ id: pendingJobId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Backup bundle is not available for download");
    });

    it("returns 400 when backup job failed", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/backups/${failedJobId}/download`,
      );
      const res = await downloadHandler(req, {
        params: Promise.resolve({ id: failedJobId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Backup bundle is not available for download");
    });

    it("generates 15-minute temporary pre-signed S3 download URL for completed backup", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/backups/${completedJobId}/download`,
      );
      const res = await downloadHandler(req, {
        params: Promise.resolve({ id: completedJobId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.downloadUrl).toBeDefined();
      expect(data.expiresIn).toBe(900); // 15 minutes (900 seconds)
      expect(data.fileName).toBe("1700000000-c0ffee1234567890abcdef.bundle");

      // Verify S3 pre-signer tracking
      expect(mockS3.presignedUrlCalls?.length).toBe(1);
      const call = mockS3.presignedUrlCalls![0];
      expect(call.bucket).toBe("repo-backups");
      expect(call.key).toBe(
        "backups/user-download-test-a/test-org-dl/test-dl-repo/1700000000-c0ffee1234567890abcdef.bundle",
      );
      expect(call.expiresInSeconds).toBe(900);
      expect(call.downloadFilename).toBe("1700000000-c0ffee1234567890abcdef.bundle");
    });
  });

  describe("POST /api/backups/[id]/retry", () => {
    it("returns 401 when user is unauthenticated", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost:3000/api/backups/${failedJobId}/retry`,
        { method: "POST" },
      );
      const res = await retryHandler(req, {
        params: Promise.resolve({ id: failedJobId }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 404 when backup job belongs to another user", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: {
          id: TEST_USER_B,
          email: "userb@example.com",
          name: "User B",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-b",
          userId: TEST_USER_B,
          expiresAt: new Date(),
          token: "token-b",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/backups/${failedJobId}/retry`,
        { method: "POST" },
      );
      const res = await retryHandler(req, {
        params: Promise.resolve({ id: failedJobId }),
      });

      expect(res.status).toBe(404);
    });

    it("retries backup job, re-executing backup and returning new completed job", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/backups/${failedJobId}/retry`,
        { method: "POST" },
      );
      const res = await retryHandler(req, {
        params: Promise.resolve({ id: failedJobId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.job).toBeDefined();
      expect(data.job.status).toBe("completed");
      expect(data.job.commitSha).toBe("retrynewsha1234567890abcdef1234567890");
    });
  });
});
