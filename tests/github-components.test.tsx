import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { OrganizationCard } from "@/components/github/organization-card";
import { RepositoryInventoryTable } from "@/components/github/repository-inventory-table";
import { RestorationGuideModal } from "@/components/github/restoration-guide-modal";
import { BackupHistoryDrawer, formatBytes } from "@/components/github/backup-history-drawer";

describe("GitHub UI Components (Warm-Canvas Editorial)", () => {
  describe("OrganizationCard", () => {
    const mockInstallation = {
      id: "inst-1",
      installationId: 1234567,
      accountLogin: "acme-corp",
      accountType: "Organization",
      avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
      targetType: "selected",
      repositoryCount: 4,
    };

    it("renders connected organization card with avatar, account name, and repo count", () => {
      const html = renderToString(
        <OrganizationCard
          installation={mockInstallation}
          onSync={async () => {}}
        />,
      );

      expect(html).toContain("acme-corp");
      expect(html).toContain("Organization");
      expect(html).toContain("Select Repositories");
      expect(html).toContain("4 authorized repositories");
      expect(html).toContain("Sync from GitHub");
      expect(html).toContain("Manage Permissions");
      expect(html).toContain("bg-surface-card");
      expect(html).toContain("border-hairline");
    });

    it("renders fallback monogram when avatarUrl is missing", () => {
      const html = renderToString(
        <OrganizationCard
          installation={{ ...mockInstallation, avatarUrl: null }}
          onSync={async () => {}}
        />,
      );

      expect(html).toContain("AC");
    });

    it("renders loading spinner state when isSyncing is true", () => {
      const html = renderToString(
        <OrganizationCard
          installation={mockInstallation}
          onSync={async () => {}}
          isSyncing={true}
        />,
      );

      expect(html).toContain("animate-spin");
    });
  });

  describe("RepositoryInventoryTable", () => {
    const mockRepositories = [
      {
        id: "repo-1",
        installationId: "inst-1",
        githubRepoId: 101,
        name: "core-platform",
        fullName: "acme-corp/core-platform",
        isPrivate: true,
        defaultBranch: "main",
        backupEnabled: false,
        backupSchedule: "daily",
        accountLogin: "acme-corp",
      },
      {
        id: "repo-2",
        installationId: "inst-1",
        githubRepoId: 102,
        name: "docs-site",
        fullName: "acme-corp/docs-site",
        isPrivate: false,
        defaultBranch: "develop",
        backupEnabled: true,
        backupSchedule: "weekly",
        accountLogin: "acme-corp",
      },
    ];

    it("renders inventory table with repository names, org prefixes, privacy badges, and default branches", () => {
      const html = renderToString(
        <RepositoryInventoryTable repositories={mockRepositories} />,
      );

      expect(html).toContain("core-platform");
      expect(html).toContain("docs-site");
      expect(html).toContain("acme-corp");
      expect(html).toContain("Private");
      expect(html).toContain("Public");
      expect(html).toContain("main");
      expect(html).toContain("develop");
      expect(html).toContain("font-serif");
      expect(html).toContain("font-mono");
      expect(html).toContain("Authorized Repositories");
    });

    it("renders empty state message when repositories list is empty", () => {
      const html = renderToString(
        <RepositoryInventoryTable repositories={[]} />,
      );

      expect(html).toContain("No repositories authorized yet");
      expect(html).toContain("Configure repository access in your GitHub App installation");
    });

    it("renders interactive 'Enable Backup' toggle switches with proper aria attributes", () => {
      const html = renderToString(
        <RepositoryInventoryTable repositories={mockRepositories} />,
      );

      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain("Enable Backup");
    });

    it("renders schedule selector offering Daily, Weekly, and Manual options", () => {
      const html = renderToString(
        <RepositoryInventoryTable repositories={mockRepositories} />,
      );

      expect(html).toContain("<select");
      expect(html).toContain('value="daily"');
      expect(html).toContain('value="weekly"');
      expect(html).toContain('value="manual"');
      expect(html).toContain("Daily");
      expect(html).toContain("Weekly");
      expect(html).toContain("Manual");
    });

    it("displays clear visual distinction and active badges for Enrolled Repositories", () => {
      const html = renderToString(
        <RepositoryInventoryTable repositories={mockRepositories} />,
      );

      // Enrolled repository (repo-2) displays Enrolled badge and active schedule badge
      expect(html).toContain("Enrolled");
      expect(html).toContain("border-l-2");
      expect(html).toContain("border-l-primary");

      // Non-enrolled repository (repo-1) displays Inactive
      expect(html).toContain("Inactive");
    });

    it("renders on-demand 'Backup Now' action button for Enrolled Repositories", () => {
      const html = renderToString(
        <RepositoryInventoryTable repositories={mockRepositories} />,
      );

      // Enrolled repo-2 should display Backup Now button
      expect(html).toContain("Backup Now");
      expect(html).toContain("data-testid=\"backup-now-btn-docs-site\"");
      // Inactive repo-1 should NOT display a Backup Now button for core-platform
      expect(html).not.toContain("data-testid=\"backup-now-btn-core-platform\"");
    });

    it("renders updated backup status badges (Success, Failed, Running) and last backup timestamp", () => {
      const reposWithStatuses = [
        {
          ...mockRepositories[1],
          id: "repo-success",
          name: "success-repo",
          fullName: "acme-corp/success-repo",
          backupEnabled: true,
          lastBackupStatus: "success",
          lastBackupAt: new Date("2026-09-10T14:30:00Z"),
        },
        {
          ...mockRepositories[1],
          id: "repo-failed",
          name: "failed-repo",
          fullName: "acme-corp/failed-repo",
          backupEnabled: true,
          lastBackupStatus: "failed",
          lastBackupAt: new Date("2026-09-09T10:15:00Z"),
        },
        {
          ...mockRepositories[1],
          id: "repo-running",
          name: "running-repo",
          fullName: "acme-corp/running-repo",
          backupEnabled: true,
          lastBackupStatus: "running",
          lastBackupAt: null,
        },
      ];

      const html = renderToString(
        <RepositoryInventoryTable repositories={reposWithStatuses} />,
      );

      expect(html).toContain("Success");
      expect(html).toContain("Failed");
      expect(html).toContain("Running");
      expect(html).toContain("backup-badge-success-success-repo");
      expect(html).toContain("backup-badge-failed-failed-repo");
      expect(html).toContain("backup-badge-running-running-repo");
      expect(html).toContain("Last: Sep 10");
      expect(html).toContain("Last: Sep 9");
      expect(html).toContain("Never backed up");
    });

    it("renders History action button on each repository row for opening backup history drawer", () => {
      const html = renderToString(
        <RepositoryInventoryTable repositories={mockRepositories} />,
      );

      expect(html).toContain("History");
      expect(html).toContain("data-testid=\"view-history-btn-core-platform\"");
      expect(html).toContain("data-testid=\"view-history-btn-docs-site\"");
      expect(html).toContain("cursor-pointer");
    });

    it("renders next scheduled run time and retention count indicators per repository", () => {
      const reposWithRetention = [
        {
          ...mockRepositories[1],
          id: "repo-retention-test",
          name: "retention-tested-repo",
          fullName: "acme-corp/retention-tested-repo",
          backupEnabled: true,
          backupSchedule: "daily",
          retentionCount: 7,
          lastBackupAt: new Date("2026-09-10T10:00:00Z"),
          nextBackupAt: new Date("2026-09-11T10:00:00Z"),
        },
      ];

      const html = renderToString(
        <RepositoryInventoryTable repositories={reposWithRetention} />,
      );

      expect(html).toContain("Next:");
      expect(html).toContain("data-testid=\"next-run-retention-tested-repo\"");
      expect(html).toContain("7 / 10");
      expect(html).toContain("data-testid=\"retention-count-retention-tested-repo\"");
      expect(html).toContain("Retention");
    });
  });

  describe("RestorationGuideModal (Warm-Canvas Editorial)", () => {
    it("renders modal with canonical git clone command, copy button, and offline guidance", () => {
      const html = renderToString(
        <RestorationGuideModal
          isOpen={true}
          onClose={() => {}}
          repoName="my-service"
          bundleFileName="my-service-2026-09-10.bundle"
          commitSha="abcdef1234567890abcdef1234567890abcdef12"
        />,
      );

      // Title & Header
      expect(html).toContain("Offline Repository Restoration");
      expect(html).toContain("Disaster Recovery Guide");
      expect(html).toContain("font-serif");

      // Canonical generic command
      expect(html).toContain("git clone &lt;bundle-file&gt; &lt;target-folder&gt;");
      expect(html).toContain("Copy Command");
      expect(html).toContain("data-testid=\"copy-canonical-cmd-btn\"");

      // Contextual command for this specific backup
      expect(html).toContain("git clone my-service-2026-09-10.bundle ./my-service");
      expect(html).toContain("data-testid=\"copy-specific-cmd-btn\"");

      // Clear guidance explaining offline bundle restoration
      expect(html).toContain("The bundle restores complete git branches and tags offline.");
      expect(html).toContain("Complete Offline Recovery Point");

      // Warm-canvas tokens: dark code surface and hairline border
      expect(html).toContain("bg-surface-dark");
      expect(html).toContain("text-on-dark");
      expect(html).toContain("border-hairline");
      expect(html).toContain("bg-canvas");
    });

    it("returns null when isOpen is false", () => {
      const html = renderToString(
        <RestorationGuideModal
          isOpen={false}
          onClose={() => {}}
          repoName="my-service"
        />,
      );

      expect(html).toBe("");
    });
  });

  describe("BackupHistoryDrawer (Warm-Canvas Editorial)", () => {
    const mockRepo = {
      id: "repo-drawer-1",
      name: "payment-service",
      fullName: "acme-corp/payment-service",
      isPrivate: true,
      defaultBranch: "main",
      backupEnabled: true,
      backupSchedule: "daily",
      accountLogin: "acme-corp",
    };

    const mockJobs = [
      {
        id: "job-completed-1",
        repositoryId: "repo-drawer-1",
        userId: "user-1",
        status: "completed",
        triggerType: "manual",
        s3Bucket: "repo-backups",
        s3Key: "backups/user-1/acme-corp/payment-service/1700000000-c0ffee12.bundle",
        bundleSizeBytes: 2450000, // ~2.34 MB
        commitSha: "c0ffee1234567890abcdef",
        createdAt: new Date("2026-09-10T12:00:00Z"),
      },
      {
        id: "job-scheduled-1",
        repositoryId: "repo-drawer-1",
        userId: "user-1",
        status: "completed",
        triggerType: "scheduled",
        s3Bucket: "repo-backups",
        s3Key: "backups/user-1/acme-corp/payment-service/1699900000-deadbeef.bundle",
        bundleSizeBytes: 1073741824, // 1 GB
        commitSha: "deadbeef1234567890abcdef",
        createdAt: new Date("2026-09-09T03:00:00Z"),
      },
      {
        id: "job-failed-1",
        repositoryId: "repo-drawer-1",
        userId: "user-1",
        status: "failed",
        triggerType: "manual",
        errorMessage: "Network timeout: git mirror clone failed after 2 retries",
        retryCount: 2,
        createdAt: new Date("2026-09-08T18:30:00Z"),
      },
    ];

    it("renders drawer with repository metadata and historical backup jobs", () => {
      const html = renderToString(
        <BackupHistoryDrawer
          isOpen={true}
          onClose={() => {}}
          repository={mockRepo}
          initialJobs={mockJobs}
        />,
      );

      // Repository info
      expect(html).toContain("payment-service");
      expect(html).toContain("acme-corp/payment-service");
      expect(html).toContain("main");
      expect(html).toContain("Private");
      expect(html).toContain("Total Backups");
      expect(html).toContain("3");

      // Completed job 1: timestamp, formatted file size (2.34 MB), commit SHA, manual trigger
      expect(html).toContain("c0ffee1");
      expect(html).toContain("2.34 MB");
      expect(html).toContain("Manual");
      expect(html).toContain("Completed");

      // Completed job 2: scheduled trigger, formatted file size (1 GB)
      expect(html).toContain("deadbee");
      expect(html).toContain("1 GB");
      expect(html).toContain("Scheduled");

      // Actions on completed jobs: Download and Restore Guide buttons
      expect(html).toContain("data-testid=\"download-backup-btn-job-completed-1\"");
      expect(html).toContain("data-testid=\"restore-guide-btn-job-completed-1\"");
      expect(html).toContain("Download");
      expect(html).toContain("Restore Guide");

      // Failed job: displays error message details and Retry action button
      expect(html).toContain("Failed");
      expect(html).toContain("Network timeout: git mirror clone failed after 2 retries");
      expect(html).toContain("Retried 2 times");
      expect(html).toContain("data-testid=\"retry-backup-btn-job-failed-1\"");
      expect(html).toContain("Retry Backup");

      // Design tokens
      expect(html).toContain("bg-canvas");
      expect(html).toContain("border-hairline");
      expect(html).toContain("font-serif");
    });

    it("renders pruned badge and retention policy note for pruned backup jobs", () => {
      const prunedJob = {
        id: "job-pruned-1",
        repositoryId: "repo-1",
        userId: "user-1",
        status: "pruned",
        triggerType: "scheduled",
        commitSha: "prunedcommit1234567890abcdef1234567890",
        bundleSizeBytes: 2048,
        createdAt: new Date("2026-09-08T12:00:00Z"),
      };

      const html = renderToString(
        <BackupHistoryDrawer
          isOpen={true}
          onClose={() => {}}
          repository={mockRepo}
          initialJobs={[prunedJob]}
        />,
      );

      expect(html).toContain("Pruned");
      expect(html).toContain("Bundle object removed per rolling retention limit");
      expect(html).not.toContain("data-testid=\"download-backup-btn-job-pruned-1\"");
    });

    it("renders empty state message when there are no backup jobs", () => {
      const html = renderToString(
        <BackupHistoryDrawer
          isOpen={true}
          onClose={() => {}}
          repository={mockRepo}
          initialJobs={[]}
        />,
      );

      expect(html).toContain("No backup history available");
      expect(html).toContain("Trigger an on-demand backup to create your first standalone Git bundle.");
    });

    it("returns null when isOpen is false or repository is null", () => {
      const htmlClosed = renderToString(
        <BackupHistoryDrawer
          isOpen={false}
          onClose={() => {}}
          repository={mockRepo}
        />,
      );
      expect(htmlClosed).toBe("");

      const htmlNoRepo = renderToString(
        <BackupHistoryDrawer
          isOpen={true}
          onClose={() => {}}
          repository={null}
        />,
      );
      expect(htmlNoRepo).toBe("");
    });
  });

  describe("formatBytes utility", () => {
    it("formats bytes into human readable KB, MB, and GB values", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(null)).toBe("0 B");
      expect(formatBytes(undefined)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(2048)).toBe("2 KB");
      expect(formatBytes(1048576)).toBe("1 MB");
      expect(formatBytes(2500000)).toBe("2.38 MB");
      expect(formatBytes(1073741824)).toBe("1 GB");
      expect(formatBytes(5368709120)).toBe("5 GB");
    });
  });
});

