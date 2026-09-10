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
import { setMockGitHubClient } from "@/lib/github/client";
import { setMockS3Storage, MockS3Storage } from "@/lib/storage/s3";
import {
  setMockGitRunner,
  setRetryDelayOverride,
  pruneRetentionWindow,
  MAX_RETENTION_BUNDLES,
} from "@/lib/backup/engine";
import {
  isRepositoryDue,
  getNextBackupTime,
  findDueRepositories,
} from "@/lib/backup/scheduler";
import {
  startLocalDevCronRunner,
  stopLocalDevCronRunner,
  isLocalDevCronRunnerActive,
} from "@/lib/backup/dev-runner";
import {
  GET as cronGetHandler,
  POST as cronPostHandler,
} from "@/app/api/cron/backups/route";

describe("Scheduled Backups & Rolling Retention Pruning (Ticket 05)", () => {
  const TEST_USER_ID = "cron-test-user-1";
  const TEST_INSTALL_ID = "inst-cron-test-1";
  const TEST_GITHUB_INSTALL_ID = 554433;
  const VALID_CRON_SECRET = process.env.CRON_SECRET || "test-cron-secret-12345";

  let dailyDueRepoId: string;
  let dailyNotDueRepoId: string;
  let weeklyDueRepoId: string;
  let weeklyNotDueRepoId: string;
  let manualRepoId: string;
  let unenrolledRepoId: string;
  let retentionRepoId: string;

  let mockS3: MockS3Storage;

  beforeAll(async () => {
    setRetryDelayOverride(0);

    // Setup User
    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Cron Tester",
        email: "crontester@example.com",
      })
      .onConflictDoNothing();

    // Setup Installation
    await db
      .insert(githubInstallations)
      .values({
        id: TEST_INSTALL_ID,
        userId: TEST_USER_ID,
        installationId: TEST_GITHUB_INSTALL_ID,
        accountLogin: "cron-org",
        accountType: "Organization",
        targetType: "selected",
      })
      .onConflictDoNothing();

    const now = Date.now();

    // 1. Daily Due Repository (last backup 26 hours ago)
    const [dailyDue] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALL_ID,
        githubRepoId: 70001,
        name: "daily-due-repo",
        fullName: "cron-org/daily-due-repo",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "daily",
        lastBackupAt: new Date(now - 26 * 60 * 60 * 1000),
      })
      .returning();
    dailyDueRepoId = dailyDue.id;

    // 2. Daily Not Due Repository (last backup 5 hours ago)
    const [dailyNotDue] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALL_ID,
        githubRepoId: 70002,
        name: "daily-not-due-repo",
        fullName: "cron-org/daily-not-due-repo",
        isPrivate: false,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "daily",
        lastBackupAt: new Date(now - 5 * 60 * 60 * 1000),
      })
      .returning();
    dailyNotDueRepoId = dailyNotDue.id;

    // 3. Weekly Due Repository (last backup 8 days ago)
    const [weeklyDue] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALL_ID,
        githubRepoId: 70003,
        name: "weekly-due-repo",
        fullName: "cron-org/weekly-due-repo",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "weekly",
        lastBackupAt: new Date(now - 8 * 24 * 60 * 60 * 1000),
      })
      .returning();
    weeklyDueRepoId = weeklyDue.id;

    // 4. Weekly Not Due Repository (last backup 2 days ago)
    const [weeklyNotDue] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALL_ID,
        githubRepoId: 70004,
        name: "weekly-not-due-repo",
        fullName: "cron-org/weekly-not-due-repo",
        isPrivate: false,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "weekly",
        lastBackupAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      })
      .returning();
    weeklyNotDueRepoId = weeklyNotDue.id;

    // 5. Manual Repository (never automatically due)
    const [manual] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALL_ID,
        githubRepoId: 70005,
        name: "manual-repo",
        fullName: "cron-org/manual-repo",
        isPrivate: false,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "manual",
        lastBackupAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
      })
      .returning();
    manualRepoId = manual.id;

    // 6. Unenrolled Repository
    const [unenrolled] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALL_ID,
        githubRepoId: 70006,
        name: "unenrolled-repo",
        fullName: "cron-org/unenrolled-repo",
        isPrivate: false,
        defaultBranch: "main",
        backupEnabled: false,
        backupSchedule: "daily",
        lastBackupAt: new Date(now - 50 * 24 * 60 * 60 * 1000),
      })
      .returning();
    unenrolledRepoId = unenrolled.id;

    // 7. Retention Testing Repository
    const [retentionRepo] = await db
      .insert(githubRepositories)
      .values({
        userId: TEST_USER_ID,
        installationId: TEST_INSTALL_ID,
        githubRepoId: 70007,
        name: "retention-repo",
        fullName: "cron-org/retention-repo",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "daily",
      })
      .returning();
    retentionRepoId = retentionRepo.id;
  });

  afterAll(async () => {
    stopLocalDevCronRunner();
    setRetryDelayOverride(null);
    setMockGitRunner(null);
    setMockS3Storage(null);

    // Cleanup test data
    await db.delete(backupJobs).where(eq(backupJobs.userId, TEST_USER_ID));
    await db
      .delete(githubRepositories)
      .where(eq(githubRepositories.userId, TEST_USER_ID));
    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.userId, TEST_USER_ID));
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
  });

  beforeEach(async () => {
    vi.restoreAllMocks();

    const now = Date.now();
    await db
      .update(githubRepositories)
      .set({ lastBackupAt: new Date(now - 26 * 60 * 60 * 1000) })
      .where(eq(githubRepositories.id, dailyDueRepoId));
    await db
      .update(githubRepositories)
      .set({ lastBackupAt: new Date(now - 8 * 24 * 60 * 60 * 1000) })
      .where(eq(githubRepositories.id, weeklyDueRepoId));

    mockS3 = {
      ensureBucketCalls: [],
      uploadCalls: [],
      deleteCalls: [],
    };
    setMockS3Storage(mockS3);

    setMockGitHubClient({
      installation: {
        id: TEST_GITHUB_INSTALL_ID,
        account: {
          login: "cron-org",
          type: "Organization",
        },
        target_type: "selected",
      },
      repositories: [],
    });

    setMockGitRunner({
      runBundle: async () => ({
        commitSha: "a1b2c3d4e5f678901234567890abcdef12345678",
        bundleSizeBytes: 1024,
        bundleContent: Buffer.from("mock-bundle-content"),
      }),
    });
  });

  describe("Protected Route (/api/cron/backups) Authorization", () => {
    it("returns 401 Unauthorized when Authorization header is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/backups", {
        method: "GET",
      });
      const res = await cronGetHandler(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Unauthorized");
    });

    it("returns 401 Unauthorized when Bearer token does not match CRON_SECRET", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/backups", {
        method: "GET",
        headers: {
          Authorization: "Bearer invalid-wrong-secret",
        },
      });
      const res = await cronGetHandler(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Unauthorized");
    });

    it("authorizes successfully via valid Bearer CRON_SECRET", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/backups", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${VALID_CRON_SECRET}`,
        },
      });
      const res = await cronGetHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.dueCount).toBeDefined();
      expect(data.results).toBeDefined();
    });

    it("supports POST method with Bearer CRON_SECRET", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/backups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VALID_CRON_SECRET}`,
        },
      });
      const res = await cronPostHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Cron Eligibility Queries & Interval Calculations", () => {
    it("evaluates daily schedule eligibility correctly (>= 24h threshold)", () => {
      const now = new Date("2026-09-10T12:00:00Z");

      // 1. Never backed up: due immediately
      expect(
        isRepositoryDue(
          { backupEnabled: true, backupSchedule: "daily", lastBackupAt: null },
          now,
        ),
      ).toBe(true);

      // 2. Backed up 23 hours ago: NOT due
      const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      expect(
        isRepositoryDue(
          {
            backupEnabled: true,
            backupSchedule: "daily",
            lastBackupAt: twentyThreeHoursAgo,
          },
          now,
        ),
      ).toBe(false);

      // 3. Backed up exactly 24 hours ago: due
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(
        isRepositoryDue(
          {
            backupEnabled: true,
            backupSchedule: "daily",
            lastBackupAt: twentyFourHoursAgo,
          },
          now,
        ),
      ).toBe(true);

      // 4. Backed up 25 hours ago: due
      const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      expect(
        isRepositoryDue(
          {
            backupEnabled: true,
            backupSchedule: "daily",
            lastBackupAt: twentyFiveHoursAgo,
          },
          now,
        ),
      ).toBe(true);
    });

    it("evaluates weekly schedule eligibility correctly (>= 7d threshold)", () => {
      const now = new Date("2026-09-10T12:00:00Z");

      // 1. Never backed up: due immediately
      expect(
        isRepositoryDue(
          { backupEnabled: true, backupSchedule: "weekly", lastBackupAt: null },
          now,
        ),
      ).toBe(true);

      // 2. Backed up 6 days ago: NOT due
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      expect(
        isRepositoryDue(
          {
            backupEnabled: true,
            backupSchedule: "weekly",
            lastBackupAt: sixDaysAgo,
          },
          now,
        ),
      ).toBe(false);

      // 3. Backed up 7 days ago: due
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      expect(
        isRepositoryDue(
          {
            backupEnabled: true,
            backupSchedule: "weekly",
            lastBackupAt: sevenDaysAgo,
          },
          now,
        ),
      ).toBe(true);

      // 4. Backed up 8 days ago: due
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      expect(
        isRepositoryDue(
          {
            backupEnabled: true,
            backupSchedule: "weekly",
            lastBackupAt: eightDaysAgo,
          },
          now,
        ),
      ).toBe(true);
    });

    it("never considers manual schedule or unenrolled repositories as due", () => {
      const now = new Date();
      const aMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      expect(
        isRepositoryDue(
          {
            backupEnabled: true,
            backupSchedule: "manual",
            lastBackupAt: aMonthAgo,
          },
          now,
        ),
      ).toBe(false);

      expect(
        isRepositoryDue(
          {
            backupEnabled: false,
            backupSchedule: "daily",
            lastBackupAt: aMonthAgo,
          },
          now,
        ),
      ).toBe(false);
    });

    it("findDueRepositories returns only eligible repositories from DB", async () => {
      const dueRepos = await findDueRepositories();
      const dueIds = dueRepos.map((r) => r.id);

      expect(dueIds).toContain(dailyDueRepoId);
      expect(dueIds).toContain(weeklyDueRepoId);
      expect(dueIds).not.toContain(dailyNotDueRepoId);
      expect(dueIds).not.toContain(weeklyNotDueRepoId);
      expect(dueIds).not.toContain(manualRepoId);
      expect(dueIds).not.toContain(unenrolledRepoId);
    });

    it("computes next scheduled backup time accurately", () => {
      const base = new Date("2026-09-10T00:00:00Z");

      const nextDaily = getNextBackupTime({
        backupEnabled: true,
        backupSchedule: "daily",
        lastBackupAt: base,
      });
      expect(nextDaily?.toISOString()).toBe("2026-09-11T00:00:00.000Z");

      const nextWeekly = getNextBackupTime({
        backupEnabled: true,
        backupSchedule: "weekly",
        lastBackupAt: base,
      });
      expect(nextWeekly?.toISOString()).toBe("2026-09-17T00:00:00.000Z");

      expect(
        getNextBackupTime({
          backupEnabled: false,
          backupSchedule: "daily",
          lastBackupAt: base,
        }),
      ).toBeNull();

      expect(
        getNextBackupTime({
          backupEnabled: true,
          backupSchedule: "manual",
          lastBackupAt: base,
        }),
      ).toBeNull();
    });
  });

  describe("Scheduled Execution and Trigger Type Recording", () => {
    it("executes due backup with triggerType='scheduled' and updates lastBackupAt", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/backups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VALID_CRON_SECRET}`,
        },
      });
      const res = await cronPostHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify the due repository was processed
      const processedDailyDue = data.results.find(
        (r: { repositoryId: string }) => r.repositoryId === dailyDueRepoId,
      );
      expect(processedDailyDue).toBeDefined();
      expect(processedDailyDue.success).toBe(true);

      // Check DB backup_job trigger_type
      const [jobInDb] = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.id, processedDailyDue.jobId));
      expect(jobInDb.triggerType).toBe("scheduled");
      expect(jobInDb.status).toBe("completed");

      // Check DB repository last_backup_at updated
      const [repoInDb] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, dailyDueRepoId));
      expect(repoInDb.lastBackupStatus).toBe("success");
      const elapsedSinceRun = Date.now() - new Date(repoInDb.lastBackupAt!).getTime();
      expect(elapsedSinceRun).toBeLessThan(10000); // executed just now
    });
  });

  describe("Rolling Retention Window Pruning & S3 Deletion (Limit 10)", () => {
    it("retains up to 10 completed backup bundles without deleting S3 objects", async () => {
      // Clean previous jobs for retentionRepo
      await db
        .delete(backupJobs)
        .where(eq(backupJobs.repositoryId, retentionRepoId));

      // Insert exactly 10 completed backup bundles
      const jobValues = Array.from({ length: 10 }, (_, i) => ({
        repositoryId: retentionRepoId,
        userId: TEST_USER_ID,
        status: "completed",
        triggerType: "scheduled",
        s3Bucket: "repo-backups",
        s3Key: `backups/${TEST_USER_ID}/cron-org/retention-repo/bundle-${i}.bundle`,
        bundleSizeBytes: 1000 + i,
        commitSha: `sha-retention-${i}`,
        completedAt: new Date(Date.now() - (10 - i) * 60000), // ascending order
      }));

      await db.insert(backupJobs).values(jobValues);

      // Run retention pruning
      const pruneResult = await pruneRetentionWindow(
        retentionRepoId,
        MAX_RETENTION_BUNDLES,
      );

      expect(pruneResult.totalCompleted).toBe(10);
      expect(pruneResult.prunedCount).toBe(0);
      expect(mockS3.deleteCalls?.length || 0).toBe(0);

      // Verify all 10 remain completed
      const remainingJobs = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.repositoryId, retentionRepoId));
      expect(remainingJobs.length).toBe(10);
      expect(remainingJobs.every((j) => j.status === "completed")).toBe(true);
    });

    it("permanently deletes excess oldest S3 objects and updates records to status='pruned' when completed > 10", async () => {
      // Insert 2 additional completed backups (making 12 total)
      const extraJobs = [
        {
          repositoryId: retentionRepoId,
          userId: TEST_USER_ID,
          status: "completed",
          triggerType: "scheduled",
          s3Bucket: "repo-backups",
          s3Key: `backups/${TEST_USER_ID}/cron-org/retention-repo/bundle-10.bundle`,
          bundleSizeBytes: 1010,
          commitSha: "sha-retention-10",
          completedAt: new Date(Date.now() - 30000),
        },
        {
          repositoryId: retentionRepoId,
          userId: TEST_USER_ID,
          status: "completed",
          triggerType: "scheduled",
          s3Bucket: "repo-backups",
          s3Key: `backups/${TEST_USER_ID}/cron-org/retention-repo/bundle-11.bundle`,
          bundleSizeBytes: 1011,
          commitSha: "sha-retention-11",
          completedAt: new Date(Date.now()),
        },
      ];
      await db.insert(backupJobs).values(extraJobs);

      // Run pruning
      const pruneResult = await pruneRetentionWindow(
        retentionRepoId,
        MAX_RETENTION_BUNDLES,
      );

      expect(pruneResult.totalCompleted).toBe(12);
      expect(pruneResult.prunedCount).toBe(2);
      expect(pruneResult.prunedJobs.length).toBe(2);

      // Verify S3 deletion calls: the 2 oldest bundles (bundle-0 and bundle-1) must be deleted
      expect(mockS3.deleteCalls).toBeDefined();
      expect(mockS3.deleteCalls!.length).toBe(2);
      const deletedKeys = mockS3.deleteCalls!.map((d) => d.key);
      expect(deletedKeys).toContain(
        `backups/${TEST_USER_ID}/cron-org/retention-repo/bundle-0.bundle`,
      );
      expect(deletedKeys).toContain(
        `backups/${TEST_USER_ID}/cron-org/retention-repo/bundle-1.bundle`,
      );

      // Verify DB records: 10 completed, 2 pruned
      const allJobs = await db
        .select()
        .from(backupJobs)
        .where(eq(backupJobs.repositoryId, retentionRepoId));
      expect(allJobs.length).toBe(12);

      const completedJobs = allJobs.filter((j) => j.status === "completed");
      const prunedJobs = allJobs.filter((j) => j.status === "pruned");

      expect(completedJobs.length).toBe(10);
      expect(prunedJobs.length).toBe(2);

      const prunedDbKeys = prunedJobs.map((j) => j.s3Key);
      expect(prunedDbKeys).toContain(
        `backups/${TEST_USER_ID}/cron-org/retention-repo/bundle-0.bundle`,
      );
      expect(prunedDbKeys).toContain(
        `backups/${TEST_USER_ID}/cron-org/retention-repo/bundle-1.bundle`,
      );
    });

    it("does not count failed backups towards the retention limit and does not delete their logs", async () => {
      // Insert a failed backup job
      await db.insert(backupJobs).values({
        repositoryId: retentionRepoId,
        userId: TEST_USER_ID,
        status: "failed",
        triggerType: "scheduled",
        errorMessage: "Simulated failure",
        retryCount: 2,
        createdAt: new Date(),
      });

      mockS3.deleteCalls = [];
      const pruneResult = await pruneRetentionWindow(
        retentionRepoId,
        MAX_RETENTION_BUNDLES,
      );

      // Still exactly 10 completed jobs, so no additional pruning occurs
      expect(pruneResult.totalCompleted).toBe(10);
      expect(pruneResult.prunedCount).toBe(0);
      expect(mockS3.deleteCalls?.length || 0).toBe(0);
    });
  });

  describe("In-Process Development Timer", () => {
    it("starts and stops the development runner timer cleanly", () => {
      const prevDevCron = process.env.ENABLE_DEV_CRON;

      try {
        process.env.ENABLE_DEV_CRON = "true";

        const started = startLocalDevCronRunner(5000);
        expect(started).toBe(true);
        expect(isLocalDevCronRunnerActive()).toBe(true);

        // Calling start again should not create duplicate timers
        const duplicateStart = startLocalDevCronRunner(5000);
        expect(duplicateStart).toBe(false);

        const stopped = stopLocalDevCronRunner();
        expect(stopped).toBe(true);
        expect(isLocalDevCronRunnerActive()).toBe(false);

        // Calling stop again returns false
        const duplicateStop = stopLocalDevCronRunner();
        expect(duplicateStop).toBe(false);
      } finally {
        process.env.ENABLE_DEV_CRON = prevDevCron;
        stopLocalDevCronRunner();
      }
    });
  });
});
