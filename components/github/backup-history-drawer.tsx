"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { RestorationGuideModal } from "./restoration-guide-modal";

export interface BackupJobItem {
  id: string;
  repositoryId: string;
  userId: string;
  status: "pending" | "running" | "completed" | "failed" | string;
  triggerType: "manual" | "scheduled" | string;
  s3Bucket?: string | null;
  s3Key?: string | null;
  bundleSizeBytes?: number | null;
  commitSha?: string | null;
  errorMessage?: string | null;
  retryCount?: number;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  createdAt: string | Date;
}

export interface BackupHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  repository: {
    id: string;
    name: string;
    fullName: string;
    isPrivate: boolean;
    defaultBranch: string;
    backupEnabled: boolean;
    backupSchedule: string;
    accountLogin?: string;
  } | null;
  initialJobs?: BackupJobItem[];
  onTriggerBackup?: (repoId: string) => Promise<void>;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(date);
  }
}

export function BackupHistoryDrawer({
  isOpen,
  onClose,
  repository,
  initialJobs,
  onTriggerBackup,
}: BackupHistoryDrawerProps) {
  const [fetchedJobs, setFetchedJobs] = useState<BackupJobItem[]>([]);
  const jobs = initialJobs ?? fetchedJobs;
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeGuideJob, setActiveGuideJob] = useState<BackupJobItem | null>(null);

  const repoId = repository?.id;

  const fetchHistory = useCallback(async () => {
    if (!repoId) return;
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/repositories/${repoId}/backup`);
      if (res.ok) {
        const data = await res.json();
        setFetchedJobs(data.jobs || []);
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to load backup history");
      }
    } catch (err) {
      console.error("Failed to load backup history:", err);
      setActionError(
        err instanceof Error ? err.message : "Failed to load backup history",
      );
    } finally {
      setIsLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (isOpen && repoId && !initialJobs) {
        setIsLoading(true);
        setActionError(null);
        try {
          const res = await fetch(`/api/repositories/${repoId}/backup`);
          if (!ignore) {
            if (res.ok) {
              const data = await res.json();
              setFetchedJobs(data.jobs || []);
            } else {
              const data = await res.json();
              setActionError(data.error || "Failed to load backup history");
            }
          }
        } catch (err) {
          if (!ignore) {
            console.error("Failed to load backup history:", err);
            setActionError(
              err instanceof Error ? err.message : "Failed to load backup history",
            );
          }
        } finally {
          if (!ignore) {
            setIsLoading(false);
          }
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [isOpen, repoId, initialJobs]);

  if (!isOpen || !repository) return null;

  const handleDownload = async (job: BackupJobItem) => {
    setDownloadingJobId(job.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/backups/${job.id}/download`);
      const data = await res.json();
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || "Failed to get download URL");
      }

      // Trigger browser download via invisible link
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = data.fileName || `${repository.name}.bundle`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download error:", err);
      setActionError(
        err instanceof Error ? err.message : "Failed to download backup bundle",
      );
    } finally {
      setDownloadingJobId(null);
    }
  };

  const handleRetry = async (job: BackupJobItem) => {
    setRetryingJobId(job.id);
    setActionError(null);
    try {
      if (onTriggerBackup) {
        await onTriggerBackup(repository.id);
      } else {
        const res = await fetch(`/api/backups/${job.id}/retry`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to retry backup");
        }
      }
      await fetchHistory();
    } catch (err) {
      console.error("Retry error:", err);
      setActionError(
        err instanceof Error ? err.message : "Failed to retry backup job",
      );
    } finally {
      setRetryingJobId(null);
    }
  };

  const getBundleFilename = (job: BackupJobItem) => {
    if (job.s3Key) {
      const parts = job.s3Key.split("/");
      return parts[parts.length - 1];
    }
    return `${repository.name}.bundle`;
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
        data-testid="drawer-backdrop"
      />

      <aside
        role="dialog"
        aria-label={`Backup History for ${repository.fullName}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-canvas border-l border-hairline shadow-2xl transition-transform duration-300 ease-in-out text-ink"
        data-testid="backup-history-drawer"
      >
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-hairline p-6 bg-surface-soft/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-sans text-xs uppercase tracking-wider text-muted font-medium">
                Backup History &amp; Restoration
              </span>
            </div>
            <h2 className="font-serif text-2xl font-normal text-ink flex items-center gap-2">
              {repository.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>{repository.fullName}</span>
              <span>&bull;</span>
              <span>Branch: <code className="font-mono text-ink">{repository.defaultBranch}</code></span>
              {repository.isPrivate ? (
                <Badge variant="pill">Private</Badge>
              ) : (
                <Badge variant="pill">Public</Badge>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-full p-2 text-muted hover:text-ink hover:bg-surface-card transition-colors cursor-pointer"
            data-testid="close-drawer-btn"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Global Action Error Alert */}
        {actionError && (
          <div
            role="alert"
            className="m-4 rounded-md border border-error/25 bg-error/10 p-3 text-xs text-error"
          >
            <p className="font-semibold">Action Error</p>
            <p>{actionError}</p>
          </div>
        )}

        {/* Summary Info Banner */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-hairline bg-surface-card/60 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted">
              Total Backups: <strong className="text-ink font-semibold">{jobs.length}</strong>
            </span>
            <span className="text-muted-soft">&bull;</span>
            <span className="text-muted">
              Schedule: <span className="uppercase text-ink font-medium">{repository.backupSchedule}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            disabled={isLoading}
            className="text-xs text-primary hover:text-primary-active underline underline-offset-4 cursor-pointer disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {/* Drawer Body: History List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted space-y-3">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-primary" />
              <p>Loading backup history...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted space-y-3 border border-dashed border-hairline rounded-lg p-8">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft text-muted">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 0 .5h-6.5a.25.25 0 0 1-.25-.25Z" />
                </svg>
              </div>
              <p className="font-medium text-body">No backup history available</p>
              <p>Trigger an on-demand backup to create your first standalone Git bundle.</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="backup-history-list">
              {jobs.map((job) => {
                const isDownloading = downloadingJobId === job.id;
                const isRetrying = retryingJobId === job.id;

                return (
                  <div
                    key={job.id}
                    data-testid={`backup-job-${job.id}`}
                    className={`rounded-lg border p-4 space-y-3 transition-colors ${
                      job.status === "completed"
                        ? "border-hairline bg-surface-card hover:border-hairline/80"
                        : job.status === "failed"
                        ? "border-error/30 bg-error/[0.04]"
                        : "border-hairline bg-surface-soft/40"
                    }`}
                  >
                    {/* Header: Date + Status + Trigger */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-xs font-semibold text-ink">
                          {formatDateTime(job.createdAt)}
                        </span>
                        <span className="rounded-full border border-hairline/80 bg-surface-soft px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted font-medium">
                          {job.triggerType === "scheduled" ? "Scheduled" : "Manual"}
                        </span>
                      </div>

                      {/* Status Badges */}
                      {job.status === "completed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          Completed
                        </span>
                      ) : job.status === "pruned" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-cream-strong/80 px-2.5 py-0.5 text-xs font-medium text-muted">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                          Pruned
                        </span>
                      ) : job.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/15 px-2.5 py-0.5 text-xs font-medium text-error">
                          <span className="h-1.5 w-1.5 rounded-full bg-error" />
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
                          <span className="h-1.5 w-1.5 animate-spin rounded-full border border-warning border-t-transparent" />
                          {job.status === "running" ? "Running" : "Pending"}
                        </span>
                      )}
                    </div>

                    {/* Metadata Row: Commit SHA + Bundle Size */}
                    <div className="grid grid-cols-2 gap-2 text-xs py-1 border-t border-hairline/60">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted">Commit:</span>
                        {job.commitSha ? (
                          <span className="font-mono text-body font-medium flex items-center gap-1">
                            <svg
                              className="h-3.5 w-3.5 text-muted"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M10.5 7.75a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm1.43.75a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 1 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 1 1 0 1.5h-3.32Z" />
                            </svg>
                            {job.commitSha.slice(0, 7)}
                          </span>
                        ) : (
                          <span className="text-muted-soft font-mono">—</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-muted">Size:</span>
                        <span className="font-mono text-body font-medium">
                          {formatBytes(job.bundleSizeBytes)}
                        </span>
                      </div>
                    </div>

                    {/* Failure details if status is failed */}
                    {job.status === "failed" && (
                      <div className="rounded-md border border-error/25 bg-surface-dark p-3 text-xs text-on-dark space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-error">
                            Error Details
                          </span>
                          {job.retryCount !== undefined && job.retryCount > 0 && (
                            <span className="text-[10px] text-on-dark-soft">
                              {`Retried ${job.retryCount} times`}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-on-dark leading-relaxed break-words">
                          {job.errorMessage || "Unknown backup failure"}
                        </p>
                      </div>
                    )}

                    {/* Actions: Download / Restore Guide / Retry */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {job.status === "pruned" && (
                        <span className="font-sans text-[11px] text-muted-soft italic">
                          Bundle object removed per rolling retention limit (10)
                        </span>
                      )}
                      {job.status === "completed" && (
                        <>
                          <button
                            type="button"
                            data-testid={`download-backup-btn-${job.id}`}
                            disabled={isDownloading}
                            onClick={() => handleDownload(job)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-canvas border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-soft active:bg-surface-card transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                          >
                            {isDownloading ? (
                              <>
                                <span className="h-3 w-3 animate-spin rounded-full border border-hairline border-t-primary" />
                                <span>Generating URL...</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="h-3.5 w-3.5 text-muted"
                                  viewBox="0 0 16 16"
                                  fill="currentColor"
                                >
                                  <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z" />
                                  <path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z" />
                                </svg>
                                <span>Download</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            data-testid={`restore-guide-btn-${job.id}`}
                            onClick={() => setActiveGuideJob(job)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-active transition-colors shadow-2xs cursor-pointer"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm15 0A8 8 0 1 0 0 8a8 8 0 0 0 16 0ZM5.5 4a.75.75 0 0 0-.75.75v6.5a.75.75 0 0 0 1.28.53l5-3.25a.75.75 0 0 0 0-1.06l-5-3.25A.75.75 0 0 0 5.5 4Z" />
                            </svg>
                            <span>Restore Guide</span>
                          </button>
                        </>
                      )}

                      {job.status === "failed" && (
                        <button
                          type="button"
                          data-testid={`retry-backup-btn-${job.id}`}
                          disabled={isRetrying}
                          onClick={() => handleRetry(job)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-active transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                          {isRetrying ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border border-on-primary border-t-transparent" />
                              <span>Retrying...</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                              >
                                <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
                                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
                              </svg>
                              <span>Retry Backup</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Restoration Guide Modal */}
      {activeGuideJob && (
        <RestorationGuideModal
          isOpen={!!activeGuideJob}
          onClose={() => setActiveGuideJob(null)}
          bundleFileName={getBundleFilename(activeGuideJob)}
          repoName={repository.name}
          commitSha={activeGuideJob.commitSha}
        />
      )}
    </>
  );
}
