import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, githubInstallations, githubRepositories, backupJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { signState } from "@/lib/github/crypto";
import { setMockGitHubClient } from "@/lib/github/client";
import { GET as callbackHandler } from "@/app/api/github/callback/route";
import { GET as installationsHandler } from "@/app/api/installations/route";
import { GET as repositoriesHandler } from "@/app/api/repositories/route";

describe("Reconnection Reconciliation for Previously Disconnected Installations (Ticket 04)", () => {
  const TEST_USER_ID = "reconnect-test-user-04";
  const INSTALLATION_SAME_ID = 771001;
  const INSTALLATION_OLD_ID = 772001;
  const INSTALLATION_NEW_ID = 772002;
  const INSTALLATION_SUSPENDED_ID = 773001;

  let dbInstSameId: string;
  let dbInstOldId: string;
  let dbInstSuspendedId: string;

  let repo1SameId: string;
  let backupJob1SameId: string;

  let repoOldOrgId: string;
  let backupJobOldOrgId: string;

  beforeAll(async () => {
    // 1. Create test user
    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Reconnect Test User",
        email: "reconnect-test-user@example.com",
      })
      .onConflictDoNothing();

    // 2. Setup mock session for route queries
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: TEST_USER_ID,
        email: "reconnect-test-user@example.com",
        name: "Reconnect Test User",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-reconnect-1",
        userId: TEST_USER_ID,
        expiresAt: new Date(),
        token: "token-reconnect-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 3. Seed Installation 1: Disconnected installation with the same installationId
    const [instSame] = await db
      .insert(githubInstallations)
      .values({
        userId: TEST_USER_ID,
        installationId: INSTALLATION_SAME_ID,
        accountLogin: "reconnect-same-org",
        accountType: "Organization",
        targetType: "selected",
        status: "disconnected",
        disconnectedAt: new Date("2026-09-10T10:00:00Z"),
      })
      .returning();
    dbInstSameId = instSame.id;

    // Seed repository for instSame
    const [repo1] = await db
      .insert(githubRepositories)
      .values({
        installationId: dbInstSameId,
        userId: TEST_USER_ID,
        githubRepoId: 7001,
        name: "web-portal",
        fullName: "reconnect-same-org/web-portal",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: false,
        backupSchedule: "daily",
        lastBackupAt: new Date("2026-09-09T12:00:00Z"),
        lastBackupStatus: "success",
      })
      .returning();
    repo1SameId = repo1.id;

    // Seed completed backup job for repo1 with S3 references
    const [job1] = await db
      .insert(backupJobs)
      .values({
        repositoryId: repo1SameId,
        userId: TEST_USER_ID,
        status: "completed",
        triggerType: "manual",
        s3Bucket: "test-backup-bucket",
        s3Key: "backups/reconnect-same-org/web-portal/2026-09-09.bundle",
        bundleSizeBytes: 1048576,
        commitSha: "sha-portal-111",
      })
      .returning();
    backupJob1SameId = job1.id;

    // 4. Seed Installation 2: Disconnected installation where GitHub will assign a new installationId
    const [instOld] = await db
      .insert(githubInstallations)
      .values({
        userId: TEST_USER_ID,
        installationId: INSTALLATION_OLD_ID,
        accountLogin: "reconnect-new-id-org",
        accountType: "Organization",
        targetType: "selected",
        status: "disconnected",
        disconnectedAt: new Date("2026-09-12T14:00:00Z"),
      })
      .returning();
    dbInstOldId = instOld.id;

    // Seed repository for instOld
    const [repoOld] = await db
      .insert(githubRepositories)
      .values({
        installationId: dbInstOldId,
        userId: TEST_USER_ID,
        githubRepoId: 8001,
        name: "core-service",
        fullName: "reconnect-new-id-org/core-service",
        isPrivate: false,
        defaultBranch: "main",
        backupEnabled: false,
        backupSchedule: "daily",
        lastBackupAt: new Date("2026-09-11T12:00:00Z"),
        lastBackupStatus: "success",
      })
      .returning();
    repoOldOrgId = repoOld.id;

    // Seed completed backup job for repoOld with S3 references
    const [jobOld] = await db
      .insert(backupJobs)
      .values({
        repositoryId: repoOldOrgId,
        userId: TEST_USER_ID,
        status: "completed",
        triggerType: "scheduled",
        s3Bucket: "test-backup-bucket",
        s3Key: "backups/reconnect-new-id-org/core-service/2026-09-11.bundle",
        bundleSizeBytes: 2097152,
        commitSha: "sha-service-222",
      })
      .returning();
    backupJobOldOrgId = jobOld.id;

    // 5. Seed Installation 3: Suspended installation
    const [instSuspended] = await db
      .insert(githubInstallations)
      .values({
        userId: TEST_USER_ID,
        installationId: INSTALLATION_SUSPENDED_ID,
        accountLogin: "reconnect-suspended-org",
        accountType: "Organization",
        targetType: "selected",
        status: "suspended",
      })
      .returning();
    dbInstSuspendedId = instSuspended.id;
  });

  afterAll(async () => {
    // Clean up all seeded test data
    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.userId, TEST_USER_ID));
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: TEST_USER_ID,
        email: "reconnect-test-user@example.com",
        name: "Reconnect Test User",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-reconnect-1",
        userId: TEST_USER_ID,
        expiresAt: new Date(),
        token: "token-reconnect-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  describe("Criterion 1 & 2: Reconnection by Same installationId", () => {
    it("detects existing installation by installationId, restores status to 'active', and clears disconnectedAt to null", async () => {
      // Configure mock GitHub client to simulate reconnection with same installationId
      // and returning 1 existing repository (updated) + 1 newly added repository
      setMockGitHubClient({
        installation: {
          id: INSTALLATION_SAME_ID,
          account: {
            login: "reconnect-same-org",
            type: "Organization",
            avatar_url: "https://avatars.githubusercontent.com/u/771001?v=4",
          },
          target_type: "selected",
          repository_selection: "selected",
        },
        repositories: [
          {
            id: 7001,
            name: "web-portal-renamed",
            full_name: "reconnect-same-org/web-portal-renamed",
            private: true,
            default_branch: "develop",
            owner: {
              login: "reconnect-same-org",
              avatar_url: "https://avatars.githubusercontent.com/u/771001?v=4",
              type: "Organization",
            },
          },
          {
            id: 7002,
            name: "api-gateway",
            full_name: "reconnect-same-org/api-gateway",
            private: false,
            default_branch: "main",
            owner: {
              login: "reconnect-same-org",
              avatar_url: "https://avatars.githubusercontent.com/u/771001?v=4",
              type: "Organization",
            },
          },
        ],
      });

      const validState = signState(TEST_USER_ID);
      const req = new NextRequest(
        `http://localhost:3000/api/github/callback?installation_id=${INSTALLATION_SAME_ID}&state=${validState}&format=json`,
      );

      const res = await callbackHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.installation.status).toBe("active");
      expect(data.installation.disconnectedAt).toBeNull();
      expect(data.installation.id).toBe(dbInstSameId);
      expect(data.installation.accountLogin).toBe("reconnect-same-org");

      // Verify DB record directly
      const [updatedInst] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, dbInstSameId));

      expect(updatedInst.status).toBe("active");
      expect(updatedInst.disconnectedAt).toBeNull();
      expect(updatedInst.avatarUrl).toBe("https://avatars.githubusercontent.com/u/771001?v=4");
    });
  });

  describe("Criterion 1 & 2: Reconnection by Account Login (New installationId from GitHub)", () => {
    it("detects existing installation by accountLogin, updates installationId, restores status to 'active', and clears disconnectedAt", async () => {
      // Simulate user reinstalling the app on GitHub for the same org, receiving INSTALLATION_NEW_ID
      setMockGitHubClient({
        installation: {
          id: INSTALLATION_NEW_ID,
          account: {
            login: "reconnect-new-id-org",
            type: "Organization",
            avatar_url: "https://avatars.githubusercontent.com/u/772002?v=4",
          },
          target_type: "selected",
          repository_selection: "selected",
        },
        repositories: [
          {
            id: 8001,
            name: "core-service",
            full_name: "reconnect-new-id-org/core-service",
            private: false,
            default_branch: "main",
            owner: {
              login: "reconnect-new-id-org",
              avatar_url: "https://avatars.githubusercontent.com/u/772002?v=4",
              type: "Organization",
            },
          },
        ],
      });

      const validState = signState(TEST_USER_ID);
      const req = new NextRequest(
        `http://localhost:3000/api/github/callback?installation_id=${INSTALLATION_NEW_ID}&state=${validState}&format=json`,
      );

      const res = await callbackHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.installation.status).toBe("active");
      expect(data.installation.disconnectedAt).toBeNull();
      expect(data.installation.installationId).toBe(INSTALLATION_NEW_ID);
      // Ensure the DB primary key is preserved so relations aren't broken
      expect(data.installation.id).toBe(dbInstOldId);

      // Verify no duplicate installations exist for this account
      const allMatchingInsts = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.accountLogin, "reconnect-new-id-org"));
      expect(allMatchingInsts.length).toBe(1);
      expect(allMatchingInsts[0].installationId).toBe(INSTALLATION_NEW_ID);
      expect(allMatchingInsts[0].status).toBe("active");
      expect(allMatchingInsts[0].disconnectedAt).toBeNull();
    });
  });

  describe("Criterion 3: Historical Repository and Backup Job Preservation", () => {
    it("preserves pre-existing repository records and their historical backup jobs and S3 references", async () => {
      // Verify repo1 from installation 1
      const [repo1] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, repo1SameId));

      expect(repo1).toBeDefined();
      expect(repo1.id).toBe(repo1SameId);
      expect(repo1.installationId).toBe(dbInstSameId);
      // Name was updated via sync, but primary key is intact
      expect(repo1.name).toBe("web-portal-renamed");

      // Verify backup job is intact with all S3 references
      const [job1] = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.id, backupJob1SameId));

      expect(job1).toBeDefined();
      expect(job1.repositoryId).toBe(repo1SameId);
      expect(job1.status).toBe("completed");
      expect(job1.s3Bucket).toBe("test-backup-bucket");
      expect(job1.s3Key).toBe("backups/reconnect-same-org/web-portal/2026-09-09.bundle");
      expect(job1.bundleSizeBytes).toBe(1048576);
      expect(job1.commitSha).toBe("sha-portal-111");

      // Verify repoOld from installation 2
      const [repoOld] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, repoOldOrgId));

      expect(repoOld).toBeDefined();
      expect(repoOld.id).toBe(repoOldOrgId);
      expect(repoOld.installationId).toBe(dbInstOldId);

      // Verify backup job for repoOld
      const [jobOld] = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.id, backupJobOldOrgId));

      expect(jobOld).toBeDefined();
      expect(jobOld.repositoryId).toBe(repoOldOrgId);
      expect(jobOld.status).toBe("completed");
      expect(jobOld.s3Bucket).toBe("test-backup-bucket");
      expect(jobOld.s3Key).toBe("backups/reconnect-new-id-org/core-service/2026-09-11.bundle");
      expect(jobOld.commitSha).toBe("sha-service-222");
    });
  });

  describe("Criterion 4: Newly Authorized Repositories & Existing Metadata Refresh", () => {
    it("inserts newly authorized repositories while updating existing repository metadata", async () => {
      // Newly authorized repo (id 7002: api-gateway) should have been inserted
      const [newRepo] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.githubRepoId, 7002));

      expect(newRepo).toBeDefined();
      expect(newRepo.name).toBe("api-gateway");
      expect(newRepo.fullName).toBe("reconnect-same-org/api-gateway");
      expect(newRepo.installationId).toBe(dbInstSameId);
      expect(newRepo.isPrivate).toBe(false);
      expect(newRepo.defaultBranch).toBe("main");

      // Existing repo (id 7001: web-portal) should have had metadata updated
      const [existingRepo] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.githubRepoId, 7001));

      expect(existingRepo).toBeDefined();
      expect(existingRepo.name).toBe("web-portal-renamed");
      expect(existingRepo.fullName).toBe("reconnect-same-org/web-portal-renamed");
      expect(existingRepo.defaultBranch).toBe("develop");
      // Original ID preserved
      expect(existingRepo.id).toBe(repo1SameId);
    });
  });

  describe("Suspended Installation Reconnection", () => {
    it("restores suspended installation back to active on reconnection", async () => {
      setMockGitHubClient({
        installation: {
          id: INSTALLATION_SUSPENDED_ID,
          account: {
            login: "reconnect-suspended-org",
            type: "Organization",
            avatar_url: undefined,
          },
          target_type: "all",
          repository_selection: "all",
        },
        repositories: [],
      });

      const validState = signState(TEST_USER_ID);
      const req = new NextRequest(
        `http://localhost:3000/api/github/callback?installation_id=${INSTALLATION_SUSPENDED_ID}&state=${validState}&format=json`,
      );

      const res = await callbackHandler(req);
      expect(res.status).toBe(200);

      const [updatedSuspended] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.id, dbInstSuspendedId));

      expect(updatedSuspended.status).toBe("active");
      expect(updatedSuspended.disconnectedAt).toBeNull();
    });
  });

  describe("API Visibility & Transitions", () => {
    it("reconnected installations and repositories appear in active GET endpoints and leave disconnected lists", async () => {
      // 1. GET /api/installations (default active) should contain the reconnected installations
      const activeInstReq = new NextRequest("http://localhost:3000/api/installations");
      const activeInstRes = await installationsHandler(activeInstReq);
      expect(activeInstRes.status).toBe(200);
      const activeInstData = await activeInstRes.json();

      const activeLogins = activeInstData.installations.map((i: { accountLogin: string }) => i.accountLogin);
      expect(activeLogins).toContain("reconnect-same-org");
      expect(activeLogins).toContain("reconnect-new-id-org");
      expect(activeLogins).toContain("reconnect-suspended-org");

      // 2. GET /api/installations?status=disconnected should NOT contain any of the reconnected installations
      const discInstReq = new NextRequest("http://localhost:3000/api/installations?status=disconnected");
      const discInstRes = await installationsHandler(discInstReq);
      expect(discInstRes.status).toBe(200);
      const discInstData = await discInstRes.json();

      const discLogins = discInstData.installations.map((i: { accountLogin: string }) => i.accountLogin);
      expect(discLogins).not.toContain("reconnect-same-org");
      expect(discLogins).not.toContain("reconnect-new-id-org");
      expect(discLogins).not.toContain("reconnect-suspended-org");

      // 3. GET /api/repositories (default active) should contain the repositories from reconnected installations
      const reposReq = new NextRequest("http://localhost:3000/api/repositories");
      const reposRes = await repositoriesHandler(reposReq);
      expect(reposRes.status).toBe(200);
      const reposData = await reposRes.json();

      const repoNames = reposData.repositories.map((r: { name: string }) => r.name);
      expect(repoNames).toContain("web-portal-renamed");
      expect(repoNames).toContain("api-gateway");
      expect(repoNames).toContain("core-service");
    });
  });
});
