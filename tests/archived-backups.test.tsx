import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { renderToString } from "react-dom/server";
import React from "react";
import { db } from "@/db";
import { user, githubInstallations, githubRepositories, backupJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { GET as installationsHandler } from "@/app/api/installations/route";
import { GET as repositoriesHandler } from "@/app/api/repositories/route";
import {
  ArchivedBackupsSection,
  ArchivedInstallation,
} from "@/components/github/archived-backups-section";
import { RepositoryInventoryTable, RepositoryItem } from "@/components/github/repository-inventory-table";

describe("Collapsible Archived Backups Section & Historical Restoration Access (Ticket 03)", () => {
  const TEST_USER_ID = "archived-test-user-03";
  const ACTIVE_INSTALLATION_ID = 993001;
  const DISCONNECTED_INSTALLATION_ID = 993002;

  let dbActiveInstId: string;
  let dbDisconnectedInstId: string;
  let activeRepoId: string;
  let disconnectedRepo1Id: string;
  let disconnectedRepo2Id: string;

  beforeAll(async () => {
    // 1. Create test user
    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Archived Backups Test User",
        email: "archived-backups-test@example.com",
      })
      .onConflictDoNothing();

    // 2. Insert one active installation and one disconnected installation
    const [activeInst] = await db
      .insert(githubInstallations)
      .values({
        userId: TEST_USER_ID,
        installationId: ACTIVE_INSTALLATION_ID,
        accountLogin: "active-org",
        accountType: "Organization",
        targetType: "selected",
        status: "active",
      })
      .returning();
    dbActiveInstId = activeInst.id;

    const [discInst] = await db
      .insert(githubInstallations)
      .values({
        userId: TEST_USER_ID,
        installationId: DISCONNECTED_INSTALLATION_ID,
        accountLogin: "archived-org",
        accountType: "Organization",
        targetType: "selected",
        status: "disconnected",
        disconnectedAt: new Date("2026-09-15T12:00:00Z"),
      })
      .returning();
    dbDisconnectedInstId = discInst.id;

    // 3. Insert repositories
    const [actRepo] = await db
      .insert(githubRepositories)
      .values({
        installationId: dbActiveInstId,
        userId: TEST_USER_ID,
        githubRepoId: 9101,
        name: "active-service",
        fullName: "active-org/active-service",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: true,
        backupSchedule: "daily",
      })
      .returning();
    activeRepoId = actRepo.id;

    const [discRepo1, discRepo2] = await db
      .insert(githubRepositories)
      .values([
        {
          installationId: dbDisconnectedInstId,
          userId: TEST_USER_ID,
          githubRepoId: 9102,
          name: "archived-core",
          fullName: "archived-org/archived-core",
          isPrivate: false,
          defaultBranch: "main",
          backupEnabled: false,
          backupSchedule: "daily",
        },
        {
          installationId: dbDisconnectedInstId,
          userId: TEST_USER_ID,
          githubRepoId: 9103,
          name: "archived-web",
          fullName: "archived-org/archived-web",
          isPrivate: true,
          defaultBranch: "develop",
          backupEnabled: false,
          backupSchedule: "weekly",
        },
      ])
      .returning();
    disconnectedRepo1Id = discRepo1.id;
    disconnectedRepo2Id = discRepo2.id;

    // 4. Insert completed backup jobs for disconnected repositories
    await db.insert(backupJobs).values([
      {
        repositoryId: disconnectedRepo1Id,
        userId: TEST_USER_ID,
        status: "completed",
        s3Bucket: "backup-vault",
        s3Key: "backups/archived-org/archived-core/bundle-1.bundle",
        bundleSizeBytes: 2048576,
        commitSha: "111122223333444455556666777788889999aaaa",
        completedAt: new Date("2026-09-10T10:00:00Z"),
      },
      {
        repositoryId: disconnectedRepo1Id,
        userId: TEST_USER_ID,
        status: "completed",
        s3Bucket: "backup-vault",
        s3Key: "backups/archived-org/archived-core/bundle-2.bundle",
        bundleSizeBytes: 2097152,
        commitSha: "22223333444455556666777788889999aaaabbbb",
        completedAt: new Date("2026-09-14T10:00:00Z"),
      },
      {
        repositoryId: disconnectedRepo2Id,
        userId: TEST_USER_ID,
        status: "completed",
        s3Bucket: "backup-vault",
        s3Key: "backups/archived-org/archived-web/bundle-1.bundle",
        bundleSizeBytes: 4194304,
        commitSha: "3333444455556666777788889999aaaabbbbcccc",
        completedAt: new Date("2026-09-12T15:30:00Z"),
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(backupJobs).where(eq(backupJobs.userId, TEST_USER_ID));
    await db.delete(githubRepositories).where(eq(githubRepositories.userId, TEST_USER_ID));
    await db.delete(githubInstallations).where(eq(githubInstallations.userId, TEST_USER_ID));
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: TEST_USER_ID,
        email: "archived-backups-test@example.com",
        name: "Archived Backups Test User",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-archived-03",
        userId: TEST_USER_ID,
        expiresAt: new Date(),
        token: "token-archived-03",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  describe("API Status Filtering (Criterion 1 & 2)", () => {
    it("GET /api/installations defaults to active installations (excluding disconnected)", async () => {
      const req = new NextRequest("http://localhost:3000/api/installations");
      const res = await installationsHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.installations)).toBe(true);

      const activeInst = data.installations.find((i: { id: string }) => i.id === dbActiveInstId);
      expect(activeInst).toBeDefined();
      expect(activeInst.accountLogin).toBe("active-org");

      const discInst = data.installations.find((i: { id: string }) => i.id === dbDisconnectedInstId);
      expect(discInst).toBeUndefined();
    });

    it("GET /api/installations?status=disconnected returns disconnected installations", async () => {
      const req = new NextRequest("http://localhost:3000/api/installations?status=disconnected");
      const res = await installationsHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      const discInst = data.installations.find((i: { id: string }) => i.id === dbDisconnectedInstId);

      expect(discInst).toBeDefined();
      expect(discInst.accountLogin).toBe("archived-org");
      expect(discInst.status).toBe("disconnected");
      expect(discInst.disconnectedAt).toBeDefined();
    });

    it("GET /api/installations?status=all returns both active and disconnected installations", async () => {
      const req = new NextRequest("http://localhost:3000/api/installations?status=all");
      const res = await installationsHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.installations.some((i: { id: string }) => i.id === dbActiveInstId)).toBe(true);
      expect(data.installations.some((i: { id: string }) => i.id === dbDisconnectedInstId)).toBe(true);
    });

    it("GET /api/repositories defaults to active installation repositories (hiding disconnected)", async () => {
      const req = new NextRequest("http://localhost:3000/api/repositories");
      const res = await repositoriesHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.repositories)).toBe(true);

      // Active repository is included
      expect(data.repositories.some((r: { id: string }) => r.id === activeRepoId)).toBe(true);

      // Disconnected repositories are NOT included in the default active query
      expect(data.repositories.some((r: { id: string }) => r.id === disconnectedRepo1Id)).toBe(false);
      expect(data.repositories.some((r: { id: string }) => r.id === disconnectedRepo2Id)).toBe(false);
    });

    it("GET /api/repositories?status=disconnected returns only repositories from disconnected installations with retention counts", async () => {
      const req = new NextRequest("http://localhost:3000/api/repositories?status=disconnected");
      const res = await repositoriesHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      // Disconnected repositories are included
      const repo1 = data.repositories.find((r: { id: string }) => r.id === disconnectedRepo1Id);
      const repo2 = data.repositories.find((r: { id: string }) => r.id === disconnectedRepo2Id);

      expect(repo1).toBeDefined();
      expect(repo1.name).toBe("archived-core");
      expect(repo1.retentionCount).toBe(2); // 2 completed backup jobs

      expect(repo2).toBeDefined();
      expect(repo2.name).toBe("archived-web");
      expect(repo2.retentionCount).toBe(1); // 1 completed backup job

      // Active repository is NOT included
      expect(data.repositories.some((r: { id: string }) => r.id === activeRepoId)).toBe(false);
    });

    it("GET /api/repositories?status=all returns all repositories regardless of status", async () => {
      const req = new NextRequest("http://localhost:3000/api/repositories?status=all");
      const res = await repositoriesHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.repositories.some((r: { id: string }) => r.id === activeRepoId)).toBe(true);
      expect(data.repositories.some((r: { id: string }) => r.id === disconnectedRepo1Id)).toBe(true);
      expect(data.repositories.some((r: { id: string }) => r.id === disconnectedRepo2Id)).toBe(true);
    });
  });

  describe("Active Dashboard Isolation (Criterion 2)", () => {
    it("RepositoryInventoryTable only renders active repositories when passed filtered active list", () => {
      const activeRepositories: RepositoryItem[] = [
        {
          id: activeRepoId,
          installationId: dbActiveInstId,
          githubRepoId: 9101,
          name: "active-service",
          fullName: "active-org/active-service",
          isPrivate: true,
          defaultBranch: "main",
          backupEnabled: true,
          backupSchedule: "daily",
          retentionCount: 0,
        },
      ];

      const html = renderToString(
        <RepositoryInventoryTable repositories={activeRepositories} />,
      );

      expect(html).toContain("active-service");
      expect(html).toContain("active-org");
      expect(html).not.toContain("archived-core");
      expect(html).not.toContain("archived-web");
      expect(html).not.toContain("archived-org");
    });
  });

  describe("ArchivedBackupsSection Component (Criteria 3, 4, 5)", () => {
    const mockArchivedInstallations: ArchivedInstallation[] = [
      {
        id: "archived-inst-1",
        installationId: 888777,
        accountLogin: "legacy-corp",
        accountType: "Organization",
        avatarUrl: "https://avatars.githubusercontent.com/u/1000?v=4",
        targetType: "selected",
        status: "disconnected",
        disconnectedAt: new Date("2026-09-18T14:00:00Z"),
        repositoryCount: 2,
      },
    ];

    const mockArchivedRepositories: RepositoryItem[] = [
      {
        id: "archived-repo-1",
        installationId: "archived-inst-1",
        githubRepoId: 1001,
        name: "data-pipeline",
        fullName: "legacy-corp/data-pipeline",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: false,
        backupSchedule: "daily",
        accountLogin: "legacy-corp",
        retentionCount: 5,
      },
      {
        id: "archived-repo-2",
        installationId: "archived-inst-1",
        githubRepoId: 1002,
        name: "legacy-docs",
        fullName: "legacy-corp/legacy-docs",
        isPrivate: false,
        defaultBranch: "master",
        backupEnabled: false,
        backupSchedule: "manual",
        accountLogin: "legacy-corp",
        retentionCount: 2,
      },
    ];

    it("renders collapsible section header with title, badge count, and subtle warm-canvas tokens (Criterion 3)", () => {
      const html = renderToString(
        <ArchivedBackupsSection
          archivedInstallations={mockArchivedInstallations}
          archivedRepositories={mockArchivedRepositories}
          defaultExpanded={false}
        />,
      );

      expect(html).toContain("data-testid=\"archived-backups-section\"");
      expect(html).toContain("data-testid=\"archived-backups-toggle\"");
      expect(html).toContain("Archived Backups");
      expect(html).toContain("data-testid=\"archived-accounts-count-badge\"");
      expect(html).toContain("1"); // 1 archived account
      expect(html).toContain("7 bundles preserved"); // 5 + 2 = 7 total bundles
      expect(html).toContain("bg-surface-soft/40");
      expect(html).toContain("border-hairline");

      // Collapsed content is hidden initially
      expect(html).not.toContain("data-testid=\"archived-backups-content\"");
    });

    it("renders empty state notice when expanded with no archived accounts", () => {
      const html = renderToString(
        <ArchivedBackupsSection
          archivedInstallations={[]}
          archivedRepositories={[]}
          defaultExpanded={true}
        />,
      );

      expect(html).toContain("data-testid=\"archived-backups-content\"");
      expect(html).toContain("data-testid=\"no-archived-backups-msg\"");
      expect(html).toContain("No archived backups");
    });

    it("renders disconnected account identity, disconnection date, repository list, and preserved bundle count (Criterion 4)", () => {
      const html = renderToString(
        <ArchivedBackupsSection
          archivedInstallations={mockArchivedInstallations}
          archivedRepositories={mockArchivedRepositories}
          defaultExpanded={true}
        />,
      );

      // Account identity & status
      expect(html).toContain("data-testid=\"archived-account-legacy-corp\"");
      expect(html).toContain("legacy-corp");
      expect(html).toContain("Organization");
      expect(html).toContain("Disconnected");

      // Disconnection date
      expect(html).toContain("data-testid=\"disconnected-date-legacy-corp\"");
      expect(html).toContain("Disconnected on Sep 18, 2026");

      // Account total bundle count summary
      expect(html).toContain("data-testid=\"account-bundle-count-legacy-corp\"");
      expect(html).toContain("7");

      // Repositories listed under account
      expect(html).toContain("data-testid=\"archived-repo-row-data-pipeline\"");
      expect(html).toContain("data-testid=\"archived-repo-row-legacy-docs\"");
      expect(html).toContain("data-pipeline");
      expect(html).toContain("legacy-docs");

      // Preserved bundle counts per repository
      expect(html).toContain("data-testid=\"bundle-count-data-pipeline\"");
      expect(html).toContain("5 bundles preserved");

      expect(html).toContain("data-testid=\"bundle-count-legacy-docs\"");
      expect(html).toContain("2 bundles preserved");

      // Action triggers for History & Restore Guide (Criterion 5)
      expect(html).toContain("data-testid=\"view-archived-history-data-pipeline\"");
      expect(html).toContain("data-testid=\"restore-guide-btn-data-pipeline\"");
      expect(html).toContain("Backups &amp; Restore");
      expect(html).toContain("Guide");
    });

    it("displays S3 Disaster Recovery Preservation Guarantee alert reassuring users", () => {
      const html = renderToString(
        <ArchivedBackupsSection
          archivedInstallations={mockArchivedInstallations}
          archivedRepositories={mockArchivedRepositories}
          defaultExpanded={true}
        />,
      );

      expect(html).toContain("S3 Disaster Recovery Preservation Guarantee");
      expect(html).toContain("All previously created Git backup bundles stored in S3 remain completely intact and downloadable");
    });
  });
});
