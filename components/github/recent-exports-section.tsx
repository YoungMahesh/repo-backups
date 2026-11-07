"use client";

import React, { useState, useEffect } from "react";
import { formatBytes } from "./export-backups-modal";

export interface BundleExportItem {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  totalSizeBytes: number;
  repositoryCount: number;
  bundleCount: number;
  selectedPeriod: string;
  errorMessage?: string | null;
  expiresAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  downloadUrl?: string | null;
}

export interface RecentExportsSectionProps {
  exports: BundleExportItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function RecentExportsSection({
  exports,
  isLoading,
  onRefresh,
}: RecentExportsSectionProps) {
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentTimestamp(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (exports.length === 0 && !isLoading) {
    return null; // Don't show if no exports exist
  }

  const formatPeriodLabel = (period: string) => {
    switch (period) {
      case "last_month":
        return "Last Month";
      case "last_7_days":
        return "Last 7 Days";
      case "last_90_days":
        return "Last 90 Days";
      case "all_time":
        return "All Time";
      case "custom":
        return "Custom Range";
      default:
        return period;
    }
  };

  const getStatusBadge = (status: BundleExportItem["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Ready for Download
          </span>
        );
      case "pending":
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
            Packaging Archive
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/20 px-2.5 py-0.5 text-[11px] font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-muted" />
            Expired (24h Window)
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-error/15 px-2.5 py-0.5 text-[11px] font-medium text-error">
            <span className="h-1.5 w-1.5 rounded-full bg-error" />
            Generation Failed
          </span>
        );
    }
  };

  const calculateHoursRemaining = (expiresAtStr?: string | null) => {
    if (!expiresAtStr || currentTimestamp === null) return null;
    const diffMs = new Date(expiresAtStr).getTime() - currentTimestamp;
    if (diffMs <= 0) return "Expired";
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));
    return `Expires in ${hours}h`;
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8 space-y-6" data-testid="recent-exports-section">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-sans text-[11px] uppercase tracking-wider text-muted font-medium">
              Data Takeout History
            </span>
          </div>
          <h2 className="font-serif text-2xl font-normal text-ink">
            Recent Bundle Exports
          </h2>
          <p className="font-sans text-xs text-muted">
            Generated ZIP archives are available for direct download within 24 hours of creation.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-body hover:text-ink transition-colors"
            data-testid="refresh-exports-btn"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-ink divide-y divide-hairline">
          <thead>
            <tr className="text-muted font-medium">
              <th className="py-2.5 pr-4">Export ID & Date</th>
              <th className="py-2.5 px-4">Scope & Period</th>
              <th className="py-2.5 px-4">Archive Size</th>
              <th className="py-2.5 px-4">Status & Retention</th>
              <th className="py-2.5 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {exports.map((exp) => {
              const hoursText = calculateHoursRemaining(exp.expiresAt);
              return (
                <tr key={exp.id} className="hover:bg-canvas/40 transition-colors" data-testid={`export-row-${exp.id}`}>
                  <td className="py-3 pr-4">
                    <p className="font-mono text-[11px] font-semibold text-ink">
                      {exp.id.slice(0, 8)}...
                    </p>
                    <p className="text-[11px] text-muted">
                      {new Date(exp.createdAt).toLocaleString()}
                    </p>
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-medium text-ink">
                      {formatPeriodLabel(exp.selectedPeriod)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {exp.repositoryCount} repos · {exp.bundleCount} bundles
                    </p>
                  </td>

                  <td className="py-3 px-4 font-mono font-medium">
                    {formatBytes(exp.totalSizeBytes)}
                  </td>

                  <td className="py-3 px-4 space-y-1">
                    {getStatusBadge(exp.status)}
                    {exp.status === "completed" && hoursText && (
                      <p className="text-[10px] text-muted font-medium">{hoursText}</p>
                    )}
                    {exp.status === "failed" && exp.errorMessage && (
                      <p className="text-[10px] text-error truncate max-w-xs">{exp.errorMessage}</p>
                    )}
                  </td>

                  <td className="py-3 pl-4 text-right">
                    {exp.status === "completed" && exp.downloadUrl ? (
                      <a
                        href={exp.downloadUrl}
                        download={`repo-backups-export-${exp.id.slice(0, 8)}.zip`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-active transition-colors shadow-xs"
                        data-testid={`download-export-btn-${exp.id}`}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download (.zip)
                      </a>
                    ) : exp.status === "processing" || exp.status === "pending" ? (
                      <span className="text-[11px] text-muted italic">Processing...</span>
                    ) : (
                      <span className="text-[11px] text-muted">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
