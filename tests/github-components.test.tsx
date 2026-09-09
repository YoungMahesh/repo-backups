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
  });
});
