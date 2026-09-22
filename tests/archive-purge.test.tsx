import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { renderToString } from "react-dom/server";
import React from "react";
import { db } from "@/db";
import { user, githubInstallations, githubRepositories, backupJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { setMockS3Storage, MockS3Storage } from "@/lib/storage/s3";
import { DELETE as deleteInstallationArchiveHandler } from "@/app/api/installations/[id]/archive/route";
import { DELETE as deleteRepositoryArchiveHandler } from "@/app/api/repositories/[id]/archive/route";
import { PurgeArchiveModal } from "@/components/github/purge-archive-modal";
import {
  ArchivedBackupsSection,
  ArchivedInstallation,
} from "@/components/github/archived-backups-section";
import { RepositoryItem } from "@/components/github/repository-inventory-table";

describe("User-Initiated Archive Purge for Disconnected Backups (Ticket 05)", () => {
  const USER_A_ID = "purge-test-user-a";
  const USER_B_ID = "purge-test-user-b";

  const ACTIVE_INST_ID = 889001;
  const DISCONNECTED_INST_1_ID = 889002;
  const DISCONNECTED_INST_2_ID = 889003;

  let dbActiveInstId: string;
  let dbDiscInst1Id: string;
  let dbDiscInst2Id: string;

  let activeRepoId: string;
  let discRepo1Id: string;
  let discRepo2Id: string;
  let discRepo3Id: string;

  let mockS3: MockS3Storage;

  beforeAll(async () => {
    // 1. Create test users
    await db
      .insert(user)
      .values([
        {
          id: USER_A_ID,
          name: "Purge Test User A",
          email: "purge-user-a@example.com",
        },
        {
          id: USER_B_ID,
          name: "Purge Test User B",
          email: "purge-user-b@example.com",
        },
      ])
      .onConflictDoNothing();

    // 2. Insert test installations
    const [actInst] = await db
      .insert(githubInstallations)
      .values({
        userId: USER_A_ID,
        installationId: ACTIVE_INST_ID,
        accountLogin: "active-enterprise",
        accountType: "Organization",
        targetType: "selected",
        status: "active",
      })
      .returning();
    dbActiveInstId = actInst.id;

    const [discInst1] = await db
      .insert(githubInstallations)
      .values({
        userId: USER_A_ID,
        installationId: DISCONNECTED_INST_1_ID,
        accountLogin: "defunct-org",
        accountType: "Organization",
        targetType: "selected",
        status: "disconnected",
        disconnectedAt: new Date("2026-09-10T12:00:00Z"),
      })
      .returning();
    dbDiscInst1Id = discInst1.id;

    const [discInst2] = await db
      .insert(githubInstallations)
      .values({
        userId: USER_A_ID,
        installationId: DISCONNECTED_INST_2_ID,
        accountLogin: "retained-org",
        accountType: "Organization",
        targetType: "selected",
        status: "disconnected",
        disconnectedAt: new Date("2026-09-11T12:00:00Z"),
      })
      .returning();
    dbDiscInst2Id = discInst2.id;

    // 3. Insert repositories
    const [actRepo] = await db
      .insert(githubRepositories)
      .values({
        installationId: dbActiveInstId,
        userId: USER_A_ID,
        githubRepoId: 7001,
        name: "live-service",
        fullName: "active-enterprise/live-service",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "daily",
      })
      .returning();
    activeRepoId = actRepo.id;

    const [dRepo1, dRepo2] = await db
      .insert(githubRepositories)
      .values([
        {
          installationId: dbDiscInst1Id,
          userId: USER_A_ID,
          githubRepoId: 7002,
          name: "old-api",
          fullName: "defunct-org/old-api",
          isPrivate: false,
          defaultBranch: "main",
          backupEnabled: false,
          backupSchedule: "daily",
        },
        {
          installationId: dbDiscInst1Id,
          userId: USER_A_ID,
          githubRepoId: 7003,
          name: "old-web",
          fullName: "defunct-org/old-web",
          isPrivate: true,
          defaultBranch: "main",
          backupEnabled: false,
          backupSchedule: "manual",
        },
      ])
      .returning();
    discRepo1Id = dRepo1.id;
    discRepo2Id = dRepo2.id;

    const [dRepo3] = await db
      .insert(githubRepositories)
      .values({
        installationId: dbDiscInst2Id,
        userId: USER_A_ID,
        githubRepoId: 7004,
        name: "prune-target",
        fullName: "retained-org/prune-target",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: false,
        backupSchedule: "daily",
      })
      .returning();
    discRepo3Id = dRepo3.id;

    // 4. Insert backup jobs with S3 references
    await db.insert(backupJobs).values([
      // Live repo job
      {
        repositoryId: activeRepoId,
        userId: USER_A_ID,
        status: "completed",
        s3Bucket: "test-backups",
        s3Key: "backups/user-a/active-enterprise/live-service/live-1.bundle",
        bundleSizeBytes: 1048576,
        commitSha: "1111222233334444555566667777888899990000",
        completedAt: new Date(),
      },
      // defunct-org / old-api jobs
      {
        repositoryId: discRepo1Id,
        userId: USER_A_ID,
        status: "completed",
        s3Bucket: "test-backups",
        s3Key: "backups/user-a/defunct-org/old-api/bundle-1.bundle",
        bundleSizeBytes: 2048576,
        commitSha: "aaaabbbbccccddddeeeeffff0000111122223333",
        completedAt: new Date(),
      },
      {
        repositoryId: discRepo1Id,
        userId: USER_A_ID,
        status: "completed",
        s3Bucket: "test-backups",
        s3Key: "backups/user-a/defunct-org/old-api/bundle-2.bundle",
        bundleSizeBytes: 2048576,
        commitSha: "bbbbccccddddeeeeffff00001111222233334444",
        completedAt: new Date(),
      },
      // defunct-org / old-web job
      {
        repositoryId: discRepo2Id,
        userId: USER_A_ID,
        status: "completed",
        s3Bucket: "test-backups",
        s3Key: "backups/user-a/defunct-org/old-web/bundle-1.bundle",
        bundleSizeBytes: 3048576,
        commitSha: "ccccddddeeeeffff000011112222333344445555",
        completedAt: new Date(),
      },
      // retained-org / prune-target job
      {
        repositoryId: discRepo3Id,
        userId: USER_A_ID,
        status: "completed",
        s3Bucket: "test-backups",
        s3Key: "backups/user-a/retained-org/prune-target/bundle-1.bundle",
        bundleSizeBytes: 4048576,
        commitSha: "ddddeeeeffff0000111122223333444455556666",
        completedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    setMockS3Storage(null);
    await db.delete(backupJobs).where(eq(backupJobs.userId, USER_A_ID));
    await db.delete(githubRepositories).where(eq(githubRepositories.userId, USER_A_ID));
    await db.delete(githubInstallations).where(eq(githubInstallations.userId, USER_A_ID));
    await db.delete(user).where(eq(user.id, USER_A_ID));
    await db.delete(user).where(eq(user.id, USER_B_ID));
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    mockS3 = {
      ensureBucketCalls: [],
      uploadCalls: [],
      deleteCalls: [],
    };
    setMockS3Storage(mockS3);

    // Default session for USER_A_ID
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: USER_A_ID,
        email: "purge-user-a@example.com",
        name: "Purge Test User A",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-purge-a",
        userId: USER_A_ID,
        expiresAt: new Date(),
        token: "token-purge-a",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  describe("API Route: DELETE /api/installations/[id]/archive (Criterion 1 & 3)", () => {
    it("returns 401 when request is unauthenticated", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(null as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      const req = new NextRequest("http://localhost:3000/api/installations/any-id/archive", {
        method: "DELETE",
      });
      const res = await deleteInstallationArchiveHandler(req, {
        params: Promise.resolve({ id: "any-id" }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain("Authentication required");
    });

    it("returns 404 when installation does not exist", async () => {
      const req = new NextRequest("http://localhost:3000/api/installations/non-existent-id/archive", {
        method: "DELETE",
      });
      const res = await deleteInstallationArchiveHandler(req, {
        params: Promise.resolve({ id: "non-existent-id" }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("Installation not found");
    });

    it("returns 403 when user does not own the installation", async () => {
      // Mock session for USER_B_ID
      vi.spyOn(auth.api, "getSession").mockResolvedValueOnce({
        user: {
          id: USER_B_ID,
          email: "purge-user-b@example.com",
          name: "Purge Test User B",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-purge-b",
          userId: USER_B_ID,
          expiresAt: new Date(),
          token: "token-purge-b",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const req = new NextRequest(`http://localhost:3000/api/installations/${dbDiscInst1Id}/archive`, {
        method: "DELETE",
      });
      const res = await deleteInstallationArchiveHandler(req, {
        params: Promise.resolve({ id: dbDiscInst1Id }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("Forbidden");
    });

    it("returns 400 when attempting to purge an active (non-disconnected) installation", async () => {
      const req = new NextRequest(`http://localhost:3000/api/installations/${dbActiveInstId}/archive`, {
        method: "DELETE",
      });
      const res = await deleteInstallationArchiveHandler(req, {
        params: Promise.resolve({ id: dbActiveInstId }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Cannot purge active or suspended installation");
    });

    it("successfully purges disconnected installation, issues S3 delete calls, and cascades DB deletion", async () => {
      const req = new NextRequest(`http://localhost:3000/api/installations/${dbDiscInst1Id}/archive`, {
        method: "DELETE",
      });
      const res = await deleteInstallationArchiveHandler(req, {
        params: Promise.resolve({ id: dbDiscInst1Id }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.purgedRepositoriesCount).toBe(2); // old-api & old-web
      expect(body.purgedBundlesCount).toBe(3); // 2 bundles from old-api + 1 from old-web

      // Verify S3 delete calls
      const deleteCalls = mockS3.deleteCalls ?? [];
      expect(deleteCalls.length).toBe(3);
      expect(deleteCalls.map((c) => c.key)).toEqual(
        expect.arrayContaining([
          "backups/user-a/defunct-org/old-api/bundle-1.bundle",
          "backups/user-a/defunct-org/old-api/bundle-2.bundle",
          "backups/user-a/defunct-org/old-web/bundle-1.bundle",
        ]),
      );

      // Verify DB records are cascade-deleted
      const [deletedInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, dbDiscInst1Id));
      expect(deletedInst).toBeUndefined();

      const remainingRepos = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.installationId, dbDiscInst1Id));
      expect(remainingRepos.length).toBe(0);

      const remainingJobs = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.repositoryId, discRepo1Id));
      expect(remainingJobs.length).toBe(0);
    });

    it("handles missing S3 objects (NoSuchKey) gracefully during installation purge (idempotency)", async () => {
      // Create a temporary disconnected installation with 1 repo and 1 bundle
      const [tempInst] = await db
        .insert(githubInstallations)
        .values({
          userId: USER_A_ID,
          installationId: 889099,
          accountLogin: "ghost-org",
          accountType: "Organization",
          targetType: "selected",
          status: "disconnected",
        })
        .returning();

      const [tempRepo] = await db
        .insert(githubRepositories)
        .values({
          installationId: tempInst.id,
          userId: USER_A_ID,
          githubRepoId: 7099,
          name: "ghost-repo",
          fullName: "ghost-org/ghost-repo",
          isPrivate: false,
          defaultBranch: "main",
        })
        .returning();

      await db.insert(backupJobs).values({
        repositoryId: tempRepo.id,
        userId: USER_A_ID,
        status: "completed",
        s3Bucket: "test-backups",
        s3Key: "backups/user-a/ghost-org/ghost-repo/nonexistent.bundle",
      });

      // Simulate NoSuchKey error on S3 delete
      mockS3.onDelete = async () => {
        const err = new Error("The specified key does not exist.");
        err.name = "NoSuchKey";
        throw err;
      };

      const req = new NextRequest(`http://localhost:3000/api/installations/${tempInst.id}/archive`, {
        method: "DELETE",
      });
      const res = await deleteInstallationArchiveHandler(req, {
        params: Promise.resolve({ id: tempInst.id }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify the installation record was deleted despite NoSuchKey
      const [checkInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, tempInst.id));
      expect(checkInst).toBeUndefined();
    });
  });

  describe("API Route: DELETE /api/repositories/[id]/archive (Criterion 2 & 3)", () => {
    it("returns 401 when request is unauthenticated", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(null as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);

      const req = new NextRequest("http://localhost:3000/api/repositories/any-id/archive", {
        method: "DELETE",
      });
      const res = await deleteRepositoryArchiveHandler(req, {
        params: Promise.resolve({ id: "any-id" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 404 when repository does not exist", async () => {
      const req = new NextRequest("http://localhost:3000/api/repositories/non-existent-repo/archive", {
        method: "DELETE",
      });
      const res = await deleteRepositoryArchiveHandler(req, {
        params: Promise.resolve({ id: "non-existent-repo" }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("Repository not found");
    });

    it("returns 403 when user does not own the repository", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValueOnce({
        user: {
          id: USER_B_ID,
          email: "purge-user-b@example.com",
          name: "Purge Test User B",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-purge-b",
          userId: USER_B_ID,
          expiresAt: new Date(),
          token: "token-purge-b",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const req = new NextRequest(`http://localhost:3000/api/repositories/${discRepo3Id}/archive`, {
        method: "DELETE",
      });
      const res = await deleteRepositoryArchiveHandler(req, {
        params: Promise.resolve({ id: discRepo3Id }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 400 when attempting to purge a repository from an active installation", async () => {
      const req = new NextRequest(`http://localhost:3000/api/repositories/${activeRepoId}/archive`, {
        method: "DELETE",
      });
      const res = await deleteRepositoryArchiveHandler(req, {
        params: Promise.resolve({ id: activeRepoId }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Cannot purge repository from an active installation");
    });

    it("successfully purges repository archive, deletes S3 bundle, and leaves parent installation shell intact", async () => {
      const req = new NextRequest(`http://localhost:3000/api/repositories/${discRepo3Id}/archive`, {
        method: "DELETE",
      });
      const res = await deleteRepositoryArchiveHandler(req, {
        params: Promise.resolve({ id: discRepo3Id }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.repositoryId).toBe(discRepo3Id);
      expect(body.purgedBundlesCount).toBe(1);

      // Verify S3 delete call for prune-target
      const deleteCalls = mockS3.deleteCalls ?? [];
      expect(deleteCalls.some((c) => c.key === "backups/user-a/retained-org/prune-target/bundle-1.bundle")).toBe(true);

      // Verify repository is deleted
      const [deletedRepo] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, discRepo3Id));
      expect(deletedRepo).toBeUndefined();

      // Verify parent installation record STILL exists (retained-org shell preserved)
      const [parentInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, dbDiscInst2Id));
      expect(parentInst).toBeDefined();
      expect(parentInst.accountLogin).toBe("retained-org");
    });
  });

  describe("UI Components & Modal Confirmation Behavior (Criteria 4 & 5)", () => {
    const mockArchivedInstallations: ArchivedInstallation[] = [
      {
        id: "inst-ui-1",
        installationId: 777001,
        accountLogin: "acme-archive",
        accountType: "Organization",
        avatarUrl: "https://avatars.githubusercontent.com/u/777001?v=4",
        targetType: "selected",
        status: "disconnected",
        disconnectedAt: new Date("2026-09-18T10:00:00Z"),
        repositoryCount: 1,
      },
    ];

    const mockArchivedRepositories: RepositoryItem[] = [
      {
        id: "repo-ui-1",
        installationId: "inst-ui-1",
        githubRepoId: 9901,
        name: "service-core",
        fullName: "acme-archive/service-core",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: false,
        backupSchedule: "daily",
        accountLogin: "acme-archive",
        retentionCount: 3,
      },
    ];

    it("ArchivedBackupsSection renders Purge Archive button in account header (Criterion 5)", () => {
      const html = renderToString(
        <ArchivedBackupsSection
          archivedInstallations={mockArchivedInstallations}
          archivedRepositories={mockArchivedRepositories}
          defaultExpanded={true}
        />,
      );

      expect(html).toContain("data-testid=\"purge-archive-account-acme-archive\"");
      expect(html).toContain("Purge Archive");
      expect(html).toContain("text-error");
    });

    it("ArchivedBackupsSection renders Purge button on each repository row (Criterion 5)", () => {
      const html = renderToString(
        <ArchivedBackupsSection
          archivedInstallations={mockArchivedInstallations}
          archivedRepositories={mockArchivedRepositories}
          defaultExpanded={true}
        />,
      );

      expect(html).toContain("data-testid=\"purge-repo-archive-service-core\"");
      expect(html).toContain("Purge");
    });

    it("PurgeArchiveModal returns null when closed", () => {
      const html = renderToString(
        <PurgeArchiveModal
          isOpen={false}
          onClose={() => {}}
          onConfirm={() => {}}
          type="installation"
          targetName="acme-archive"
        />,
      );

      expect(html).toBe("");
    });

    it("PurgeArchiveModal renders explicit warning of permanent S3 data destruction (Criterion 4)", () => {
      const html = renderToString(
        <PurgeArchiveModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          type="installation"
          targetName="acme-archive"
          bundleCount={3}
        />,
      );

      expect(html).toContain("data-testid=\"purge-archive-modal\"");
      expect(html).toContain("data-testid=\"s3-destruction-warning\"");
      expect(html).toContain("Irreversible S3 Data Destruction");
      expect(html).toContain("Danger Zone");
      expect(html).toContain("Permanent Archive Purge");
    });

    it("PurgeArchiveModal has confirm button disabled initially until typed name matches target (Criterion 4)", () => {
      const html = renderToString(
        <PurgeArchiveModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          type="installation"
          targetName="acme-archive"
          bundleCount={3}
        />,
      );

      // Confirm button is disabled because input is empty
      expect(html).toMatch(/<button[^>]*disabled[^>]*data-testid="confirm-purge-button"/);
      expect(html).toContain("data-testid=\"purge-confirm-input\"");
      expect(html).toContain("acme-archive");
    });

    it("PurgeArchiveModal adapts copy for repository purge", () => {
      const html = renderToString(
        <PurgeArchiveModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          type="repository"
          targetName="service-core"
          bundleCount={3}
        />,
      );

      expect(html).toContain("Purge Repository Archive: service-core");
      expect(html).toContain("When you purge this repository archive:");
      expect(html).toContain("service-core");
    });
  });
});
