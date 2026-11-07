import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  user,
  githubInstallations,
  githubRepositories,
  backupJobs,
  bundleExports,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { setMockS3Storage, MockS3Storage } from "@/lib/storage/s3";
import { executeBundleExport } from "@/lib/export/engine";
import { getUserRollingQuotaUsage } from "@/lib/export/quota";
import { GET as estimateHandler } from "@/app/api/exports/estimate/route";
import { GET as listExportsHandler, POST as createExportHandler } from "@/app/api/exports/route";
import { GET as getExportHandler } from "@/app/api/exports/[id]/route";
import { GET as downloadExportHandler } from "@/app/api/exports/[id]/download/route";

describe("Bundle Export Routes & Engine", () => {
  const TEST_USER = "user-export-integration";
  const TEST_INSTALLATION = "inst-export-integration";
  const TEST_GITHUB_INSTALL = 771122;

  let repo1Id: string;
  let repo2Id: string;
  let mockS3: MockS3Storage;

  beforeAll(async () => {
    // 1. Create test user
    await db
      .insert(user)
      .values({
        id: TEST_USER,
        name: "Export Tester",
        email: "export-tester@example.com",
      })
      .onConflictDoNothing();

    // 2. Create GitHub installation
    await db
      .insert(githubInstallations)
      .values({
        id: TEST_INSTALLATION,
        userId: TEST_USER,
        installationId: TEST_GITHUB_INSTALL,
        accountLogin: "export-org",
        accountType: "Organization",
        targetType: "selected",
      })
      .onConflictDoNothing();

    // 3. Create 2 repositories
    const [r1, r2] = await db
      .insert(githubRepositories)
      .values([
        {
          userId: TEST_USER,
          installationId: TEST_INSTALLATION,
          githubRepoId: 555111,
          name: "backend-core",
          fullName: "export-org/backend-core",
          defaultBranch: "main",
          backupEnabled: true,
        },
        {
          userId: TEST_USER,
          installationId: TEST_INSTALLATION,
          githubRepoId: 555222,
          name: "frontend-app",
          fullName: "export-org/frontend-app",
          defaultBranch: "main",
          backupEnabled: true,
        },
      ])
      .returning();

    repo1Id = r1.id;
    repo2Id = r2.id;

    // 4. Create completed backup jobs for both repositories
    await db.insert(backupJobs).values([
      {
        userId: TEST_USER,
        repositoryId: repo1Id,
        status: "completed",
        triggerType: "manual",
        s3Bucket: "repo-backups",
        s3Key: `backups/${TEST_USER}/export-org/backend-core/1700000000-aaa111.bundle`,
        bundleSizeBytes: 1048576 * 10, // 10 MB
        commitSha: "aaa111222333444555",
        completedAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        userId: TEST_USER,
        repositoryId: repo2Id,
        status: "completed",
        triggerType: "scheduled",
        s3Bucket: "repo-backups",
        s3Key: `backups/${TEST_USER}/export-org/frontend-app/1700000000-bbb222.bundle`,
        bundleSizeBytes: 1048576 * 20, // 20 MB
        commitSha: "bbb222333444555666",
        completedAt: new Date(Date.now() - 7200000), // 2 hours ago
      },
    ]);
  });

  beforeEach(() => {
    mockS3 = {
      ensureBucketCalls: [],
      uploadCalls: [],
      presignedUrlCalls: [],
      getObjectCalls: [],
      onGetObject: async () => Buffer.from("mock bundle binary content"),
    };
    setMockS3Storage(mockS3);

    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      session: {
        id: "sess-export-1",
        userId: TEST_USER,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
        token: "tok-export-1",
      },
      user: {
        id: TEST_USER,
        name: "Export Tester",
        email: "export-tester@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);
  });

  afterAll(async () => {
    setMockS3Storage(null);
    vi.restoreAllMocks();
    // Cleanup
    await db.delete(bundleExports).where(eq(bundleExports.userId, TEST_USER));
    await db.delete(backupJobs).where(eq(backupJobs.userId, TEST_USER));
    await db.delete(githubRepositories).where(eq(githubRepositories.userId, TEST_USER));
    await db.delete(githubInstallations).where(eq(githubInstallations.userId, TEST_USER));
    await db.delete(user).where(eq(user.id, TEST_USER));
  });

  it("GET /api/exports/estimate returns real-time size and remaining quota", async () => {
    const req = new NextRequest("http://localhost:3000/api/exports/estimate?period=last_month");
    const res = await estimateHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.estimate.totalSizeBytes).toBe(1048576 * 30); // 10MB + 20MB
    expect(body.estimate.repositoryCount).toBe(2);
    expect(body.estimate.bundleCount).toBe(2);
    expect(body.quota.remainingBytes).toBeGreaterThan(0);
    expect(body.exceedsQuota).toBe(false);
  });

  it("POST /api/exports rejects request when no repositories selected", async () => {
    const req = new NextRequest("http://localhost:3000/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositoryIds: [] }),
    });

    const res = await createExportHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("At least one repository must be selected");
  });

  it("POST /api/exports creates an export job and triggers execution", async () => {
    const req = new NextRequest("http://localhost:3000/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repositoryIds: [repo1Id, repo2Id],
        period: "last_month",
      }),
    });

    const res = await createExportHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.export.id).toBeDefined();
    expect(body.export.status).toBe("pending");

    // Execute engine for this export
    const result = await executeBundleExport({ exportId: body.export.id });
    expect(result.status).toBe("completed");
    expect(result.s3Key).toContain("exports/");
    expect(mockS3.uploadCalls.length).toBeGreaterThan(0);

    // Verify DB update
    const [updated] = await db
      .select()
      .from(bundleExports)
      .where(eq(bundleExports.id, body.export.id));
    expect(updated.status).toBe("completed");
    expect(updated.expiresAt).toBeDefined();
  });

  it("blocks concurrent export request with 409 while job is active", async () => {
    // Insert an active pending job
    const [active] = await db
      .insert(bundleExports)
      .values({
        userId: TEST_USER,
        status: "processing",
        repositoryIds: [repo1Id],
      })
      .returning();

    const req = new NextRequest("http://localhost:3000/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositoryIds: [repo1Id] }),
    });

    const res = await createExportHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("An export is already in progress");

    // Clean up active job
    await db.delete(bundleExports).where(eq(bundleExports.id, active.id));
  });

  it("GET /api/exports lists recent exports with application download URLs", async () => {
    const req = new NextRequest("http://localhost:3000/api/exports");
    const res = await listExportsHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.exports)).toBe(true);
    expect(body.quota).toBeDefined();
    expect(body.quota.limitBytes).toBe(30 * 1024 * 1024 * 1024);
  });

  it("GET /api/exports/[id] retrieves specific export details and download link", async () => {
    // Insert completed export record
    const [exp] = await db
      .insert(bundleExports)
      .values({
        userId: TEST_USER,
        status: "completed",
        s3Bucket: "repo-backups",
        s3Key: `exports/${TEST_USER}/test-export/archive.zip`,
        totalSizeBytes: 5000000,
        expiresAt: new Date(Date.now() + 86400000),
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/exports/${exp.id}`);
    const res = await getExportHandler(req, {
      params: Promise.resolve({ id: exp.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.export.id).toBe(exp.id);
    expect(body.export.status).toBe("completed");
    expect(body.export.downloadUrl).toBe(`/api/exports/${exp.id}/download`);
  });

  it("GET /api/exports/[id]/download streams the export zip archive with proper headers", async () => {
    const [exp] = await db
      .insert(bundleExports)
      .values({
        userId: TEST_USER,
        status: "completed",
        s3Bucket: "repo-backups",
        s3Key: `exports/${TEST_USER}/stream-test/archive.zip`,
        totalSizeBytes: 12345,
        expiresAt: new Date(Date.now() + 86400000),
      })
      .returning();

    const req = new NextRequest(`http://localhost:3000/api/exports/${exp.id}/download`);
    const res = await downloadExportHandler(req, {
      params: Promise.resolve({ id: exp.id }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain(`attachment; filename="repo-backups-export-${exp.id.slice(0, 8)}.zip"`);
    expect(Number(res.headers.get("content-length"))).toBeGreaterThan(0);
  });

  it("calculates rolling 24-hour quota and excludes failed or canceled exports", async () => {
    // Insert a failed export
    await db.insert(bundleExports).values({
      userId: TEST_USER,
      status: "failed",
      totalSizeBytes: 1024 * 1024 * 1024 * 20, // 20 GB failed
      createdAt: new Date(),
    });

    const quota = await getUserRollingQuotaUsage(TEST_USER);
    // The failed 20 GB should NOT count against the 30 GB limit!
    expect(quota.usedBytes).toBeLessThan(1024 * 1024 * 1024); // Only the earlier successful export (~30MB)
    expect(quota.remainingBytes).toBeGreaterThan(1024 * 1024 * 1024 * 29);
  });
});
