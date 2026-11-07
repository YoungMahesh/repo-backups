import { ExportCandidate } from "./selection";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function getArchiveBundlePath(candidate: ExportCandidate): string {
  const dateStr = formatTimestamp(new Date(candidate.completedAt));
  const shortSha = candidate.commitSha.slice(0, 7);
  return `${candidate.accountLogin}/${candidate.repositoryName}-${dateStr}-${shortSha}.bundle`;
}

/**
 * Generates the canonical README.md restoration guide included inside every export archive.
 */
export function generateRestorationGuideReadme(
  candidates: ExportCandidate[],
  exportMetadata: {
    exportId: string;
    createdAt: Date;
    totalSizeBytes: number;
  },
): string {
  const distinctRepos = new Set(candidates.map((c) => c.fullName)).size;

  let tableRows = candidates
    .map((c) => {
      const bundlePath = getArchiveBundlePath(c);
      const sizeStr = formatBytes(c.bundleSizeBytes);
      const dateStr = new Date(c.completedAt).toISOString();
      return `| \`${c.fullName}\` | \`${bundlePath}\` | \`${c.commitSha.slice(0, 7)}\` | ${sizeStr} | ${dateStr} |`;
    })
    .join("\n");

  if (!tableRows) {
    tableRows = "| _No repositories included_ | - | - | - | - |";
  }

  return `# Repo Backups — Export Bundle Archive

Generated at: ${exportMetadata.createdAt.toISOString()}  
Export ID: \`${exportMetadata.exportId}\`  
Total Repositories: ${distinctRepos}  
Total Bundles: ${candidates.length}  
Total Archive Size: ${formatBytes(exportMetadata.totalSizeBytes)}

---

## Restoration Guide

Each file in this archive is a self-contained Git **Backup Bundle** (\`.bundle\`). A Git bundle encapsulates complete commit history, branches, and tags in a portable binary format.

### Canonical Clone Command

To restore and clone any repository from this bundle, run:

\`\`\`bash
git clone <bundle-file> <target-directory>
\`\`\`

#### Example:
\`\`\`bash
git clone ${candidates[0] ? getArchiveBundlePath(candidates[0]) : "org-name/repo-name-2026-11-07.bundle"} restored-repo
cd restored-repo
git status
git log -n 5
\`\`\`

### Fetching into an Existing Repository

If you already have a local or remote git repository and want to restore or merge references from this bundle:

\`\`\`bash
git remote add backup-bundle /path/to/<bundle-file>
git fetch backup-bundle
\`\`\`

---

## Bundles Included in This Export

| Repository | Archive Path | Commit SHA | Size | Backup Date |
| :--- | :--- | :--- | :--- | :--- |
${tableRows}

---

_Created with [Repo Backups](https://repo-backups.dev) — Sovereign Git Backups to S3._
`;
}

export interface ExportManifest {
  version: "1.0";
  exportId: string;
  userId: string;
  generatedAt: string;
  totalSizeBytes: number;
  repositoryCount: number;
  bundleCount: number;
  bundles: Array<{
    repository: string;
    accountLogin: string;
    repositoryName: string;
    bundlePath: string;
    commitSha: string;
    sizeBytes: number;
    completedAt: string;
  }>;
}

export function generateExportManifestJson(
  candidates: ExportCandidate[],
  exportMetadata: {
    exportId: string;
    userId: string;
    createdAt: Date;
    totalSizeBytes: number;
  },
): string {
  const distinctRepos = new Set(candidates.map((c) => c.fullName)).size;

  const manifest: ExportManifest = {
    version: "1.0",
    exportId: exportMetadata.exportId,
    userId: exportMetadata.userId,
    generatedAt: exportMetadata.createdAt.toISOString(),
    totalSizeBytes: exportMetadata.totalSizeBytes,
    repositoryCount: distinctRepos,
    bundleCount: candidates.length,
    bundles: candidates.map((c) => ({
      repository: c.fullName,
      accountLogin: c.accountLogin,
      repositoryName: c.repositoryName,
      bundlePath: getArchiveBundlePath(c),
      commitSha: c.commitSha,
      sizeBytes: c.bundleSizeBytes,
      completedAt: new Date(c.completedAt).toISOString(),
    })),
  };

  return JSON.stringify(manifest, null, 2);
}
