import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { OrganizationCard } from "@/components/github/organization-card";
import { RepositoryInventoryTable } from "@/components/github/repository-inventory-table";

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
  });
});
