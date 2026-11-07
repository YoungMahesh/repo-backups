import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import {
  ExportBackupsModal,
  formatBytes,
} from "@/components/github/export-backups-modal";
import {
  RecentExportsSection,
  BundleExportItem,
} from "@/components/github/recent-exports-section";
import {
  generateRestorationGuideReadme,
  generateExportManifestJson,
  getArchiveBundlePath,
} from "@/lib/export/manifest";
import { resolvePeriodDates, ExportCandidate } from "@/lib/export/selection";

describe("Bundle Export UI Components & Pure Utilities", () => {
  const mockRepos = [
    {
      id: "repo-1",
      installationId: "inst-1",
      githubRepoId: 101,
      name: "web-app",
      fullName: "acme-corp/web-app",
      isPrivate: true,
      defaultBranch: "main",
      backupEnabled: true,
      backupSchedule: "daily" as const,
      lastBackupAt: "2026-11-01T10:00:00.000Z",
      lastBackupStatus: "success" as const,
      createdAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: "repo-2",
      installationId: "inst-1",
      githubRepoId: 102,
      name: "api-service",
      fullName: "acme-corp/api-service",
      isPrivate: false,
      defaultBranch: "main",
      backupEnabled: true,
      backupSchedule: "weekly" as const,
      lastBackupAt: "2026-11-05T12:00:00.000Z",
      lastBackupStatus: "success" as const,
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  ];

  describe("ExportBackupsModal", () => {
    it("renders modal with header, period choices, and repositories when open", () => {
      const html = renderToString(
        <ExportBackupsModal
          isOpen={true}
          onClose={() => {}}
          repositories={mockRepos}
        />,
      );

      expect(html).toContain("Export Git Backup Bundles");
      expect(html).toContain("Data Portability &amp; Backup Takeout");
      expect(html).toContain("Last Month (Default)");
      expect(html).toContain("Last 7 Days");
      expect(html).toContain("Last 90 Days");
      expect(html).toContain("All Time");
      expect(html).toContain("acme-corp/web-app");
      expect(html).toContain("acme-corp/api-service");
      expect(html).toContain("Include all point-in-time snapshots");
      expect(html).toContain("24-Hour Rolling Quota:");
      expect(html).toContain("30.00 GB");
      expect(html).toContain("Download");
    });

    it("returns null when isOpen is false", () => {
      const html = renderToString(
        <ExportBackupsModal
          isOpen={false}
          onClose={() => {}}
          repositories={mockRepos}
        />,
      );
      expect(html).toBe("");
    });
  });

  describe("RecentExportsSection", () => {
    it("renders export history table with status badges and download links", () => {
      const mockExports: BundleExportItem[] = [
        {
          id: "exp-12345678-abcd",
          status: "completed",
          totalSizeBytes: 1024 * 1024 * 500, // 500 MB
          repositoryCount: 2,
          bundleCount: 2,
          selectedPeriod: "last_month",
          createdAt: "2026-11-06T14:30:00.000Z",
          expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
          downloadUrl: "https://s3.example.com/download.zip",
        },
        {
          id: "exp-98765432-ef01",
          status: "failed",
          totalSizeBytes: 0,
          repositoryCount: 1,
          bundleCount: 0,
          selectedPeriod: "last_7_days",
          createdAt: "2026-11-05T09:00:00.000Z",
          errorMessage: "S3 connection timeout",
        },
      ];

      const html = renderToString(
        <RecentExportsSection exports={mockExports} />,
      );

      expect(html).toContain("Recent Bundle Exports");
      expect(html).toContain("exp-1234");
      expect(html).toContain("Last Month");
      expect(html).toContain("500 MB");
      expect(html).toContain("Ready for Download");
      expect(html).toContain("Download (.zip)");
      expect(html).toContain("Generation Failed");
      expect(html).toContain("S3 connection timeout");
    });

    it("returns null when no exports are present", () => {
      const html = renderToString(<RecentExportsSection exports={[]} />);
      expect(html).toBe("");
    });
  });

  describe("formatBytes pure utility", () => {
    it("correctly formats bytes into KB, MB, GB", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
      expect(formatBytes(1024 * 1024 * 1024 * 15)).toBe("15 GB");
    });
  });

  describe("resolvePeriodDates utility", () => {
    it("resolves last_month to a 30-day window", () => {
      const result = resolvePeriodDates("last_month");
      expect(result.period).toBe("last_month");
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      const diffDays = Math.round(
        (result.endDate!.getTime() - result.startDate!.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(30);
    });

    it("resolves last_7_days to a 7-day window", () => {
      const result = resolvePeriodDates("last_7_days");
      expect(result.period).toBe("last_7_days");
      const diffDays = Math.round(
        (result.endDate!.getTime() - result.startDate!.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(7);
    });

    it("resolves all_time with undefined startDate", () => {
      const result = resolvePeriodDates("all_time");
      expect(result.startDate).toBeUndefined();
    });

    it("resolves custom dates", () => {
      const customStart = "2026-01-01T00:00:00.000Z";
      const customEnd = "2026-06-01T00:00:00.000Z";
      const result = resolvePeriodDates("custom", customStart, customEnd);
      expect(result.startDate?.toISOString()).toBe(customStart);
      expect(result.endDate?.toISOString()).toBe(customEnd);
    });
  });

  describe("Restoration Guide README and Manifest Generation", () => {
    const mockCandidates: ExportCandidate[] = [
      {
        jobId: "job-1",
        repositoryId: "repo-1",
        repositoryName: "web-app",
        fullName: "acme/web-app",
        accountLogin: "acme",
        commitSha: "abc1234567890abcdef1234567890abcdef1234",
        bundleSizeBytes: 1024 * 1024 * 50,
        s3Bucket: "repo-backups",
        s3Key: "backups/user-1/acme/web-app/bundle.bundle",
        completedAt: new Date("2026-11-06T12:00:00.000Z"),
      },
    ];

    it("generates restoration README containing canonical clone instructions", () => {
      const readme = generateRestorationGuideReadme(mockCandidates, {
        exportId: "exp-12345",
        createdAt: new Date("2026-11-07T00:00:00.000Z"),
        totalSizeBytes: 1024 * 1024 * 50,
      });

      expect(readme).toContain("# Repo Backups — Export Bundle Archive");
      expect(readme).toContain("git clone <bundle-file> <target-directory>");
      expect(readme).toContain("acme/web-app");
      expect(readme).toContain("50 MB");
      expect(readme).toContain(getArchiveBundlePath(mockCandidates[0]));
    });

    it("generates valid schema v1.0 export manifest JSON", () => {
      const manifestStr = generateExportManifestJson(mockCandidates, {
        exportId: "exp-12345",
        userId: "user-1",
        createdAt: new Date("2026-11-07T00:00:00.000Z"),
        totalSizeBytes: 1024 * 1024 * 50,
      });

      const parsed = JSON.parse(manifestStr);
      expect(parsed.version).toBe("1.0");
      expect(parsed.exportId).toBe("exp-12345");
      expect(parsed.userId).toBe("user-1");
      expect(parsed.totalSizeBytes).toBe(1024 * 1024 * 50);
      expect(parsed.bundles).toHaveLength(1);
      expect(parsed.bundles[0].repository).toBe("acme/web-app");
      expect(parsed.bundles[0].commitSha).toBe(mockCandidates[0].commitSha);
    });
  });
});
