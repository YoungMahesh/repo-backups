"use client";

import React, { useState, useEffect, useMemo } from "react";
import { RepositoryItem } from "./repository-inventory-table";

export interface ExportBackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repositories: RepositoryItem[];
  onExportStarted?: (exportId: string) => void;
}

export interface QuotaInfo {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  hasActiveJob: boolean;
  activeJobId?: string;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function ExportBackupsModal({
  isOpen,
  onClose,
  repositories,
  onExportStarted,
}: ExportBackupsModalProps) {
  const [period, setPeriod] = useState<string>("last_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [includeAllSnapshots, setIncludeAllSnapshots] = useState<boolean>(false);

  const initialRepoIds = useMemo(() => new Set(repositories.map((r) => r.id)), [repositories]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(initialRepoIds);

  // Estimation & Quota states
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [totalEstimatedBytes, setTotalEstimatedBytes] = useState<number>(0);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // In-modal processing & polling states
  const [activeExportId, setActiveExportId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<"idle" | "preparing" | "ready" | "failed">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Sync selected repositories when repositories prop changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedRepoIds(new Set(repositories.map((r) => r.id)));
    }, 0);
    return () => clearTimeout(timer);
  }, [repositories]);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setExportStatus("idle");
        setActiveExportId(null);
        setDownloadUrl(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fetch quota & estimate from API whenever selections change
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;

    async function runEstimate() {
      setIsLoadingEstimate(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams();
        params.set("period", period);
        if (period === "custom") {
          if (startDate) params.set("startDate", startDate);
          if (endDate) params.set("endDate", endDate);
        }
        if (selectedRepoIds.size > 0) {
          params.set("repositoryIds", Array.from(selectedRepoIds).join(","));
        } else {
          params.set("repositoryIds", "none");
        }
        if (includeAllSnapshots) {
          params.set("includeAllSnapshots", "true");
        }

        const res = await fetch(`/api/exports/estimate?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to calculate export estimate.");
        }
        const data = await res.json();
        if (!ignore) {
          setQuota(data.quota);
          setTotalEstimatedBytes(data.estimate.totalSizeBytes || 0);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Error fetching export estimate:", err);
        }
      } finally {
        if (!ignore) {
          setIsLoadingEstimate(false);
        }
      }
    }

    runEstimate();

    return () => {
      ignore = true;
    };
  }, [isOpen, period, startDate, endDate, selectedRepoIds, includeAllSnapshots]);

  // Poll active export status
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (activeExportId && exportStatus === "preparing") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/exports/${activeExportId}`);
          if (res.ok) {
            const data = await res.json();
            const exp = data.export;
            if (exp.status === "completed") {
              setExportStatus("ready");
              setDownloadUrl(exp.downloadUrl);
              // Auto-trigger browser download
              if (exp.downloadUrl) {
                const a = document.createElement("a");
                a.href = exp.downloadUrl;
                a.download = `repo-backups-export-${exp.id.slice(0, 8)}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            } else if (exp.status === "failed") {
              setExportStatus("failed");
              setErrorMessage(exp.errorMessage || "Export generation failed in background.");
            }
          }
        } catch (err) {
          console.error("Error polling export status:", err);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeExportId, exportStatus]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedRepoIds.size === repositories.length) {
      setSelectedRepoIds(new Set());
    } else {
      setSelectedRepoIds(new Set(repositories.map((r) => r.id)));
    }
  };

  const toggleRepo = (id: string) => {
    const next = new Set(selectedRepoIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRepoIds(next);
  };

  const remainingQuota = quota ? quota.remainingBytes : 30 * 1024 * 1024 * 1024;
  const exceedsQuota = totalEstimatedBytes > remainingQuota;
  const hasActiveJob = quota?.hasActiveJob ?? false;
  const isDownloadDisabled =
    selectedRepoIds.size === 0 ||
    exceedsQuota ||
    hasActiveJob ||
    isSubmitting ||
    isLoadingEstimate ||
    exportStatus === "preparing";

  const handleStartExport = async () => {
    if (isDownloadDisabled) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryIds: Array.from(selectedRepoIds),
          period,
          startDate: period === "custom" && startDate ? startDate : undefined,
          endDate: period === "custom" && endDate ? endDate : undefined,
          includeAllSnapshots,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start export job.");
      }

      setActiveExportId(data.export.id);
      setExportStatus("preparing");
      if (onExportStarted) {
        onExportStarted(data.export.id);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to start export.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs"
      data-testid="export-backups-modal"
    >
      <div
        className="relative w-full max-w-2xl rounded-xl border border-hairline bg-canvas p-6 sm:p-8 shadow-xl space-y-6 text-ink max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-sans text-[11px] uppercase tracking-wider text-muted font-medium">
                Data Portability & Backup Takeout
              </span>
            </div>
            <h2
              id="export-modal-title"
              className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-ink"
            >
              Export Git Backup Bundles
            </h2>
            <p className="font-sans text-xs text-body mt-1">
              Package sovereign Git backup bundles into a single compressed ZIP archive with complete commit histories.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-card hover:text-ink transition-colors"
            aria-label="Close export dialog"
            data-testid="close-export-modal-btn"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Preparation State Screen */}
        {exportStatus === "preparing" && (
          <div className="rounded-xl border border-hairline bg-surface-card p-6 text-center space-y-4 animate-pulse" data-testid="export-preparing-state">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-normal text-ink">
                Preparing Your Backup Archive...
              </h3>
              <p className="font-sans text-xs text-muted max-w-md mx-auto">
                Downloading Git bundles from S3, generating the restoration guide, and building your ZIP package. Download will initiate automatically once complete.
              </p>
            </div>
          </div>
        )}

        {/* Ready State Screen */}
        {exportStatus === "ready" && (
          <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center space-y-4" data-testid="export-ready-state">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-normal text-ink">
                Archive Ready for Download!
              </h3>
              <p className="font-sans text-xs text-body max-w-md mx-auto">
                Your download has begun. If it did not start automatically, use the direct link below. This link remains valid for 24 hours.
              </p>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-on-primary hover:bg-primary-active transition-colors shadow-xs"
                data-testid="direct-download-link"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download Archive (.zip)
              </a>
            )}
          </div>
        )}

        {/* Configuration Body (shown when idle) */}
        {exportStatus === "idle" && (
          <div className="space-y-6">
            {/* Step 1: Period Selection */}
            <div className="space-y-2">
              <label htmlFor="period-selector" className="block font-sans text-xs font-semibold uppercase tracking-wider text-muted">
                1. Select Time Period
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "last_month", label: "Last Month (Default)" },
                  { id: "last_7_days", label: "Last 7 Days" },
                  { id: "last_90_days", label: "Last 90 Days" },
                  { id: "all_time", label: "All Time" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPeriod(item.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all text-center ${
                      period === item.id
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                        : "border-hairline bg-surface-card text-body hover:border-muted hover:text-ink"
                    }`}
                    data-testid={`period-option-${item.id}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range Option */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setPeriod(period === "custom" ? "last_month" : "custom")}
                  className="font-sans text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
                  data-testid="toggle-custom-period-btn"
                >
                  {period === "custom" ? "← Back to presets" : "Or pick custom date range..."}
                </button>

                {period === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] text-muted mb-1">From Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-md border border-hairline bg-surface-card px-3 py-1.5 text-xs text-ink focus:border-primary focus:outline-hidden"
                        data-testid="custom-start-date"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted mb-1">To Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-md border border-hairline bg-surface-card px-3 py-1.5 text-xs text-ink focus:border-primary focus:outline-hidden"
                        data-testid="custom-end-date"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Repository Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block font-sans text-xs font-semibold uppercase tracking-wider text-muted">
                  2. Select Repositories ({selectedRepoIds.size} of {repositories.length} selected)
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="font-sans text-xs text-primary hover:underline font-medium"
                  data-testid="select-all-repos-btn"
                >
                  {selectedRepoIds.size === repositories.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              {repositories.length === 0 ? (
                <div className="rounded-md border border-hairline bg-surface-card p-4 text-center text-xs text-muted">
                  No repositories available to export. Connect a GitHub organization and run backups first.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-hairline bg-surface-card divide-y divide-hairline">
                  {repositories.map((repo) => {
                    const isChecked = selectedRepoIds.has(repo.id);
                    return (
                      <label
                        key={repo.id}
                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-canvas transition-colors ${
                          isChecked ? "bg-canvas/50" : ""
                        }`}
                        data-testid={`repo-checkbox-row-${repo.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRepo(repo.id)}
                            className="rounded border-hairline text-primary focus:ring-primary h-4 w-4"
                            data-testid={`repo-checkbox-${repo.id}`}
                          />
                          <div>
                            <p className="font-sans text-xs font-medium text-ink">{repo.fullName}</p>
                            <p className="font-sans text-[11px] text-muted">
                              Default branch: {repo.defaultBranch}
                            </p>
                          </div>
                        </div>
                        <span className="font-sans text-[11px] text-muted font-medium">
                          {repo.backupEnabled ? "Active Backups" : "Manual Only"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Snapshot Options */}
            <div className="rounded-lg border border-hairline bg-surface-card p-4 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAllSnapshots}
                  onChange={(e) => setIncludeAllSnapshots(e.target.checked)}
                  className="rounded border-hairline text-primary focus:ring-primary h-4 w-4 mt-0.5"
                  data-testid="include-all-snapshots-checkbox"
                />
                <div>
                  <p className="font-sans text-xs font-medium text-ink">
                    Include all point-in-time snapshots
                  </p>
                  <p className="font-sans text-[11px] text-muted">
                    By default, only the latest successful backup bundle is included per repository to prevent duplicate historical clones. Check this if you require every individual daily snapshot within the period.
                  </p>
                </div>
              </label>
            </div>

            {/* Real-time Size Counter & 24h Quota Gauge */}
            <div className="rounded-lg border border-hairline bg-surface-soft p-4 space-y-3" data-testid="export-quota-card">
              <div className="flex items-center justify-between text-xs">
                <span className="font-sans font-medium text-body">Estimated Download Size:</span>
                <span className="font-mono text-sm font-semibold text-ink" data-testid="total-download-size">
                  {isLoadingEstimate ? "Calculating..." : formatBytes(totalEstimatedBytes)}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>24-Hour Rolling Quota:</span>
                  <span className="font-mono">
                    {formatBytes(quota ? quota.usedBytes : 0)} / 30.00 GB used (
                    {formatBytes(remainingQuota)} remaining)
                  </span>
                </div>

                {/* Quota Progress Bar */}
                <div className="h-2 w-full rounded-full bg-surface-cream-strong overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      exceedsQuota ? "bg-error" : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (((quota?.usedBytes || 0) + totalEstimatedBytes) / (30 * 1024 * 1024 * 1024)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Warning Banners */}
              {exceedsQuota && (
                <div className="rounded-md border border-error/25 bg-error/10 p-2.5 text-xs text-error" data-testid="quota-exceeded-warning">
                  ⚠️ <strong>Quota Exceeded:</strong> Selected backup size ({formatBytes(totalEstimatedBytes)}) exceeds your remaining daily quota ({formatBytes(remainingQuota)}). Please reduce the time period or selected repositories.
                </div>
              )}

              {hasActiveJob && (
                <div className="rounded-md border border-warning/25 bg-warning/10 p-2.5 text-xs text-warning" data-testid="active-job-warning">
                  ⏳ <strong>Export In Progress:</strong> You have an active export job currently compiling. Please wait for it to complete before starting a new export.
                </div>
              )}

              {errorMessage && (
                <div className="rounded-md border border-error/25 bg-error/10 p-2.5 text-xs text-error" data-testid="export-error-notice">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-hairline pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface-card px-4 py-2 text-xs font-medium text-body hover:bg-surface-cream-strong hover:text-ink transition-colors"
            data-testid="cancel-export-btn"
          >
            {exportStatus === "ready" ? "Close" : "Cancel"}
          </button>

          {exportStatus === "idle" && (
            <button
              type="button"
              disabled={isDownloadDisabled}
              onClick={handleStartExport}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2 text-xs font-medium text-on-primary shadow-xs transition-colors ${
                isDownloadDisabled
                  ? "bg-primary-disabled cursor-not-allowed opacity-60 text-muted"
                  : "bg-primary hover:bg-primary-active"
              }`}
              data-testid="start-export-download-btn"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Starting Export...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download ({formatBytes(totalEstimatedBytes)})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
