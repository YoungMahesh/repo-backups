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
import {
  POST as backupHandler,
  GET as backupJobsHandler,
} from "@/app/api/repositories/[id]/backup/route";

describe("On-Demand Backup Execution Route & Engine", () => {
  const TEST_USER_ID = "backup-test-user-1";
  const TEST_INSTALLATION_DB_ID = "inst-db-backup-1";
  const TEST_GITHUB_INSTALL_ID = 998877;
  let enrolledRepoId: string;
  let unenrolledRepoId: string;

  let mockS3: MockS3Storage;

  beforeAll(async () => {
    // Override retry delays to 0ms for fast tests
    setRetryDelayOverride(0);

    // Setup user
    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Backup Tester",
        email: "backuptester@example.com",
      })
      .onConflictDoNothing();

    // Setup installation
    await db
      .insert(githubInstallations)
      .values({
        id: TEST_INSTALLATION_DB_ID,
        userId: TEST_USER_ID,
        installationId: TEST_GITHUB_INSTALL_ID,
        accountLogin: "backup-org",
        accountType: "Organization",
        targetType: "selected",
      })
      .onConflictDoNothing();

    // Setup enrolled repository
    const [enrolled] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALLATION_DB_ID,
        githubRepoId: 888001,
        name: "enrolled-repo",
        fullName: "backup-org/enrolled-repo",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "daily",
      })
      .returning();
    enrolledRepoId = enrolled.id;

    // Setup unenrolled repository
    const [unenrolled] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALLATION_DB_ID,
        githubRepoId: 888002,
        name: "unenrolled-repo",
        fullName: "backup-org/unenrolled-repo",
        isPrivate: false,
        defaultBranch: "main",
        backupEnabled: false,
        backupSchedule: "manual",
      })
      .returning();
    unenrolledRepoId = unenrolled.id;
  });

  afterAll(async () => {
    setRetryDelayOverride(null);
    setMockGitRunner(null);
    setMockS3Storage(null);

    // Cleanup
    await db
      .delete(backupJobs)
      .where(eq(backupJobs.userId, TEST_USER_ID));
    await db
      .delete(githubRepositories)
      .where(eq(githubRepositories.userId, TEST_USER_ID));
    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.userId, TEST_USER_ID));
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    mockS3 = {
      ensureBucketCalls: [],
      uploadCalls: [],
    };
    setMockS3Storage(mockS3);

    setMockGitHubClient({
      installation: {
        id: TEST_GITHUB_INSTALL_ID,
        account: {
          login: "backup-org",
          type: "Organization",
        },
        target_type: "selected",
      },
      repositories: [],
    });

    setMockGitRunner({
      runBundle: async () => ({
        commitSha: "c0ffee1234567890abcdef1234567890abcdef12",
        bundleSizeBytes: 2048,
        bundleContent: Buffer.from("mock-bundle-binary-content-12345"),
      }),
    });

    // Default mock auth session
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: TEST_USER_ID,
        email: "backuptester@example.com",
        name: "Backup Tester",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-backup-1",
        userId: TEST_USER_ID,
        expiresAt: new Date(),
        token: "token-backup-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  it("returns 401 when user is unauthenticated", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

    const req = new NextRequest(
      `http://localhost:3000/api/repositories/${enrolledRepoId}/backup`,
      { method: "POST" },
    );
    const res = await backupHandler(req, {
      params: Promise.resolve({ id: enrolledRepoId }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Authentication required");
  });

  it("returns 404 when repository does not exist or belongs to another user", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/repositories/non-existent-repo-id/backup",
      { method: "POST" },
    );
    const res = await backupHandler(req, {
      params: Promise.resolve({ id: "non-existent-repo-id" }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("Repository not found");
  });

  it("returns 400 when repository is not enrolled for backups", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/repositories/${unenrolledRepoId}/backup`,
      { method: "POST" },
    );
    const res = await backupHandler(req, {
      params: Promise.resolve({ id: unenrolledRepoId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Repository is not enrolled for backups");
  });

  it("dispatches backup job, auto-verifies S3 bucket, executes bundle, streams to S3 with SSE-S3, and updates database", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/repositories/${enrolledRepoId}/backup`,
      { method: "POST" },
    );
    const res = await backupHandler(req, {
      params: Promise.resolve({ id: enrolledRepoId }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.job).toBeDefined();
    expect(data.job.status).toBe("completed");
    expect(data.job.commitSha).toBe("c0ffee1234567890abcdef1234567890abcdef12");
    expect(data.job.bundleSizeBytes).toBeGreaterThan(0);
    expect(data.job.startedAt).toBeDefined();
    expect(data.job.completedAt).toBeDefined();
    expect(data.job.retryCount).toBe(0);

    // Execution duration check
    const start = new Date(data.job.startedAt).getTime();
    const end = new Date(data.job.completedAt).getTime();
    expect(end).toBeGreaterThanOrEqual(start);

    // Verify S3 calls
    expect(mockS3.ensureBucketCalls.length).toBeGreaterThan(0);
    expect(mockS3.uploadCalls.length).toBe(1);
    const upload = mockS3.uploadCalls[0];
    expect(upload.bucket).toBeDefined();
    expect(upload.encryption).toBe("AES256");
    expect(upload.key).toMatch(
      /^backups\/backup-test-user-1\/backup-org\/enrolled-repo\/\d+-c0ffee1234567890abcdef1234567890abcdef12\.bundle$/,
    );

    // Verify repository update in DB
    const [updatedRepo] = await db
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.id, enrolledRepoId));
    expect(updatedRepo.lastBackupStatus).toBe("success");
    expect(updatedRepo.lastBackupAt).toBeDefined();
  });

  it("automatically retries transient errors up to 2 times before succeeding", async () => {
    let callCount = 0;
    setMockGitRunner({
      runBundle: async (_repo, _token, attempt) => {
        callCount++;
        if (attempt < 2) {
          throw new Error(`Transient network failure on attempt ${attempt}`);
        }
        return {
          commitSha: "retrysuccess1234567890abcdef1234567890ab",
          bundleSizeBytes: 4096,
          bundleContent: Buffer.from("recovered-bundle-content"),
        };
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/repositories/${enrolledRepoId}/backup`,
      { method: "POST" },
    );
    const res = await backupHandler(req, {
      params: Promise.resolve({ id: enrolledRepoId }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.job.status).toBe("completed");
    expect(data.job.retryCount).toBe(2);
    expect(callCount).toBe(3); // attempt 0, attempt 1, attempt 2

    // Verify DB record
    const [jobInDb] = await db
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, data.job.id));
    expect(jobInDb.status).toBe("completed");
    expect(jobInDb.retryCount).toBe(2);
  });

  it("records failed status with actionable error details when retries are exhausted", async () => {
    setMockGitRunner({
      runBundle: async (_repo, _token, attempt) => {
        throw new Error(`Permanent error on attempt ${attempt}`);
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/repositories/${enrolledRepoId}/backup`,
      { method: "POST" },
    );
    const res = await backupHandler(req, {
      params: Promise.resolve({ id: enrolledRepoId }),
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.job.status).toBe("failed");
    expect(data.job.retryCount).toBe(2);
    expect(data.job.errorMessage).toContain("Permanent error on attempt 2");

    // Verify repository marked as failed
    const [updatedRepo] = await db
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.id, enrolledRepoId));
    expect(updatedRepo.lastBackupStatus).toBe("failed");
  });

  it("GET /api/repositories/[id]/backup returns backup job history", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/repositories/${enrolledRepoId}/backup`,
    );
    const res = await backupJobsHandler(req, {
      params: Promise.resolve({ id: enrolledRepoId }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs).toBeDefined();
    expect(Array.isArray(data.jobs)).toBe(true);
    expect(data.jobs.length).toBeGreaterThan(0);
    expect(data.jobs[0].repositoryId).toBe(enrolledRepoId);
  });
});
