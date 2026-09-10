"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BackupHistoryDrawer } from "./backup-history-drawer";

export interface RepositoryItem {
  id: string;
  installationId: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  backupEnabled: boolean;
  backupSchedule: string;
  lastBackupAt?: string | Date | null;
  lastBackupStatus?: string | null;
  accountLogin?: string;
  createdAt?: string | Date;
}

interface RepositoryInventoryTableProps {
  repositories: RepositoryItem[];
  isLoading?: boolean;
  onUpdateRepository?: (
    repoId: string,
    updates: {
      backupEnabled?: boolean;
      backupSchedule?: "daily" | "weekly" | "manual";
    },
  ) => Promise<void>;
  onBackupNow?: (repoId: string) => Promise<void>;
  onSelectRepository?: (repo: RepositoryItem) => void;
  selectedRepositoryId?: string | null;
}

function formatBackupDate(date: string | Date): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(date);
  }
}

export function RepositoryInventoryTable({
  repositories,
  isLoading = false,
  onUpdateRepository,
  onBackupNow,
  onSelectRepository,
  selectedRepositoryId,
}: RepositoryInventoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepoForDrawer, setSelectedRepoForDrawer] = useState<RepositoryItem | null>(null);

  const activeDrawerRepo = useMemo(() => {
    if (selectedRepositoryId) {
      return repositories.find((r) => r.id === selectedRepositoryId) || null;
    }
    return selectedRepoForDrawer;
  }, [selectedRepositoryId, repositories, selectedRepoForDrawer]);

  const [updatingRepoIds, setUpdatingRepoIds] = useState<Record<string, boolean>>({});
  const [backingUpRepoIds, setBackingUpRepoIds] = useState<Record<string, boolean>>({});
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { backupEnabled?: boolean; backupSchedule?: string }>
  >({});
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, { lastBackupStatus?: string; lastBackupAt?: Date | string }>
  >({});

  const filteredRepositories = useMemo(() => {
    if (!searchQuery.trim()) return repositories;
    const query = searchQuery.toLowerCase();
    return repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        repo.fullName.toLowerCase().includes(query),
    );
  }, [repositories, searchQuery]);

  const handleToggleBackup = async (repo: RepositoryItem) => {
    const currentEnabled =
      localOverrides[repo.id]?.backupEnabled !== undefined
        ? localOverrides[repo.id].backupEnabled!
        : repo.backupEnabled;

    const newEnabled = !currentEnabled;

    // Optimistic local state update
    setLocalOverrides((prev) => ({
      ...prev,
      [repo.id]: {
        ...prev[repo.id],
        backupEnabled: newEnabled,
      },
    }));

    setUpdatingRepoIds((prev) => ({ ...prev, [repo.id]: true }));

    try {
      if (onUpdateRepository) {
        await onUpdateRepository(repo.id, { backupEnabled: newEnabled });
      } else {
        const res = await fetch(`/api/repositories/${repo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backupEnabled: newEnabled }),
        });
        if (!res.ok) {
          throw new Error("Failed to update backup status");
        }
      }
    } catch (err) {
      console.error("Failed to toggle backup:", err);
      // Revert optimistic update on failure
      setLocalOverrides((prev) => ({
        ...prev,
        [repo.id]: {
          ...prev[repo.id],
          backupEnabled: currentEnabled,
        },
      }));
    } finally {
      setUpdatingRepoIds((prev) => ({ ...prev, [repo.id]: false }));
    }
  };

  const handleScheduleChange = async (
    repo: RepositoryItem,
    newSchedule: "daily" | "weekly" | "manual",
  ) => {
    const currentSchedule =
      localOverrides[repo.id]?.backupSchedule || repo.backupSchedule;

    // Optimistic local update
    setLocalOverrides((prev) => ({
      ...prev,
      [repo.id]: {
        ...prev[repo.id],
        backupSchedule: newSchedule,
      },
    }));

    setUpdatingRepoIds((prev) => ({ ...prev, [repo.id]: true }));

    try {
      if (onUpdateRepository) {
        await onUpdateRepository(repo.id, { backupSchedule: newSchedule });
      } else {
        const res = await fetch(`/api/repositories/${repo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backupSchedule: newSchedule }),
        });
        if (!res.ok) {
          throw new Error("Failed to update schedule");
        }
      }
    } catch (err) {
      console.error("Failed to change schedule:", err);
      // Revert optimistic update
      setLocalOverrides((prev) => ({
        ...prev,
        [repo.id]: {
          ...prev[repo.id],
          backupSchedule: currentSchedule,
        },
      }));
    } finally {
      setUpdatingRepoIds((prev) => ({ ...prev, [repo.id]: false }));
    }
  };

  const handleBackupNow = async (repo: RepositoryItem) => {
    setBackingUpRepoIds((prev) => ({ ...prev, [repo.id]: true }));
    setStatusOverrides((prev) => ({
      ...prev,
      [repo.id]: {
        ...prev[repo.id],
        lastBackupStatus: "running",
      },
    }));

    try {
      if (onBackupNow) {
        await onBackupNow(repo.id);
      } else {
        const res = await fetch(`/api/repositories/${repo.id}/backup`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to execute backup job");
        }
      }
      setStatusOverrides((prev) => ({
        ...prev,
        [repo.id]: {
          lastBackupStatus: "success",
          lastBackupAt: new Date(),
        },
      }));
    } catch (err) {
      console.error("Failed to backup repository:", err);
      setStatusOverrides((prev) => ({
        ...prev,
        [repo.id]: {
          lastBackupStatus: "failed",
        },
      }));
    } finally {
      setBackingUpRepoIds((prev) => ({ ...prev, [repo.id]: false }));
    }
  };

  const handleRowClick = (repo: RepositoryItem) => {
    setSelectedRepoForDrawer(repo);
    if (onSelectRepository) {
      onSelectRepository(repo);
    }
  };

  return (
    <div
      className="space-y-4 rounded-lg border border-hairline bg-canvas p-6 shadow-xs"
      data-testid="repository-inventory"
    >
      {/* Table Header & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-hairline">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg sm:text-xl font-normal text-ink">
              Authorized Repositories
            </h3>
            <Badge variant="pill">{repositories.length}</Badge>
          </div>
          <p className="font-sans text-xs text-muted mt-0.5">
            Repositories authorized for read-only backup via GitHub App installation. Click any row to view backup history.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted space-y-3">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-primary" />
          <p>Loading repository inventory...</p>
        </div>
      ) : filteredRepositories.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted space-y-2">
          {searchQuery ? (
            <>
              <p className="font-medium text-body">No matching repositories found</p>
              <p>Try refining your search query &quot;{searchQuery}&quot;</p>
            </>
          ) : (
            <>
              <p className="font-medium text-body">No repositories authorized yet</p>
              <p>
                Configure repository access in your GitHub App installation to inventory codebases.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-soft/40">
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  Repository
                </th>
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  Privacy
                </th>
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  Default Branch
                </th>
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  Backup Status
                </th>
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  Schedule
                </th>
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredRepositories.map((repo) => {
                const parts = repo.fullName.split("/");
                const orgPrefix = parts.length > 1 ? parts[0] : repo.accountLogin;
                const repoName = parts.length > 1 ? parts[1] : repo.name;

                const isEnrolled =
                  localOverrides[repo.id]?.backupEnabled !== undefined
                    ? localOverrides[repo.id].backupEnabled!
                    : repo.backupEnabled;

                const currentSchedule =
                  localOverrides[repo.id]?.backupSchedule || repo.backupSchedule || "daily";

                const isUpdating = !!updatingRepoIds[repo.id];
                const isBackingUp = !!backingUpRepoIds[repo.id];

                const currentStatus =
                  statusOverrides[repo.id]?.lastBackupStatus !== undefined
                    ? statusOverrides[repo.id].lastBackupStatus
                    : repo.lastBackupStatus;

                const currentLastBackupAt =
                  statusOverrides[repo.id]?.lastBackupAt !== undefined
                    ? statusOverrides[repo.id].lastBackupAt
                    : repo.lastBackupAt;

                return (
                  <tr
                    key={repo.id}
                    onClick={() => handleRowClick(repo)}
                    className={`group cursor-pointer transition-colors ${
                      isBackingUp
                        ? "border-l-2 border-l-primary bg-primary/[0.05] animate-pulse"
                        : isEnrolled
                        ? "border-l-2 border-l-primary bg-primary/[0.02] hover:bg-primary/[0.04]"
                        : "hover:bg-surface-soft/60"
                    }`}
                    data-testid={`repo-row-${repo.name}`}
                    aria-busy={isBackingUp}
                  >
                    {/* Repository Name with Org Prefix */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 shrink-0 text-muted group-hover:text-primary transition-colors"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 0 .5h-6.5a.25.25 0 0 1-.25-.25Z" />
                        </svg>
                        <div className="truncate">
                          {orgPrefix && (
                            <span className="font-sans text-xs text-muted">
                              {orgPrefix} /{" "}
                            </span>
                          )}
                          <span className="font-sans text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                            {repoName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Privacy Status Badge */}
                    <td className="py-3 px-4">
                      {repo.isPrivate ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-cream-strong/60 px-2.5 py-0.5 text-xs font-medium text-ink">
                          <svg
                            className="h-3 w-3 text-muted"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 4v2h-.25A1.75 1.75 0 0 0 2 7.75v5.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0 0 14 13.25v-5.5A1.75 1.75 0 0 0 12.25 6H12V4a4 4 0 0 0-8 0Zm6.5 2V4a2.5 2.5 0 0 0-5 0v2h5Z"
                            />
                          </svg>
                          Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-hairline/60 bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-muted">
                          Public
                        </span>
                      )}
                    </td>

                    {/* Default Branch */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-body">
                        <svg
                          className="h-3.5 w-3.5 text-muted"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 6a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM3.5 4a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                        </svg>
                        <span>{repo.defaultBranch}</span>
                      </div>
                    </td>

                    {/* Backup Status / Enrolled Distinction / Timestamp */}
                    <td className="py-3 px-4">
                      {isEnrolled ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                              <span className="h-1.5 w-1.5 rounded-full bg-success" />
                              Enrolled
                            </span>
                            {isBackingUp || currentStatus === "running" ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
                                data-testid={`backup-badge-running-${repo.name}`}
                              >
                                <span className="h-1.5 w-1.5 animate-spin rounded-full border border-warning border-t-transparent" />
                                Running
                              </span>
                            ) : currentStatus === "success" ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                                data-testid={`backup-badge-success-${repo.name}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                Success
                              </span>
                            ) : currentStatus === "failed" ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/15 px-2 py-0.5 text-xs font-medium text-error"
                                data-testid={`backup-badge-failed-${repo.name}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-error" />
                                Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-hairline bg-surface-card px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted font-sans">
                                {currentSchedule}
                              </span>
                            )}
                          </div>
                          <span className="font-sans text-[11px] text-muted-soft">
                            {currentLastBackupAt
                              ? `Last: ${formatBackupDate(currentLastBackupAt)}`
                              : "Never backed up"}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-hairline/60 bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-muted">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Schedule Selector */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={currentSchedule}
                          onChange={(e) =>
                            handleScheduleChange(
                              repo,
                              e.target.value as "daily" | "weekly" | "manual",
                            )
                          }
                          disabled={isUpdating || isBackingUp}
                          aria-label={`Backup schedule for ${repo.name}`}
                          className="rounded-md border border-hairline bg-canvas px-2.5 py-1 text-xs text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>
                    </td>

                    {/* Actions: On-Demand "Backup Now" Button + History + Toggle Switch */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {/* Backup History Button */}
                        <button
                          type="button"
                          data-testid={`view-history-btn-${repo.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(repo);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-canvas border border-hairline px-2 py-1 text-xs font-medium text-muted hover:text-ink hover:bg-surface-soft active:bg-surface-card transition-colors shadow-2xs cursor-pointer"
                          title="View backup history and restore"
                        >
                          <svg
                            className="h-3.5 w-3.5 text-muted"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path fillRule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm15 0A8 8 0 1 0 0 8a8 8 0 0 0 16 0Zm-8.5-4.25a.75.75 0 0 1 1.5 0v3.5l2.25 1.5a.75.75 0 1 1-.832 1.248l-2.625-1.75A.75.75 0 0 1 7.25 8.5V4.75Z" />
                          </svg>
                          <span>History</span>
                        </button>

                        {isEnrolled && (
                          <button
                            type="button"
                            data-testid={`backup-now-btn-${repo.name}`}
                            disabled={isBackingUp || isUpdating}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBackupNow(repo);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-canvas border border-hairline px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-soft active:bg-surface-card transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                            title="Trigger an immediate backup"
                          >
                            {isBackingUp ? (
                              <>
                                <span className="h-3 w-3 animate-spin rounded-full border border-hairline border-t-primary" />
                                <span>Backing up...</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="h-3 w-3 text-primary"
                                  viewBox="0 0 16 16"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm-.75 4.75a.75.75 0 0 1 1.5 0v3.5l2.25 1.5a.75.75 0 1 1-.832 1.248l-2.625-1.75A.75.75 0 0 1 7.25 8.5V4.75Z" />
                                </svg>
                                <span>Backup Now</span>
                              </>
                            )}
                          </button>
                        )}
                        <span className="sr-only">Enable Backup</span>
                        {isUpdating && (
                          <span className="h-3 w-3 animate-spin rounded-full border border-hairline border-t-primary" />
                        )}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnrolled}
                          aria-label={`Enable Backup for ${repo.name}`}
                          disabled={isUpdating || isBackingUp}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBackup(repo);
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 disabled:opacity-50 ${
                            isEnrolled
                              ? "bg-primary"
                              : "bg-surface-cream-strong border border-hairline"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-on-primary shadow-xs ring-0 transition duration-200 ease-in-out ${
                              isEnrolled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Backup History Drawer */}
      {activeDrawerRepo && (
        <BackupHistoryDrawer
          isOpen={!!activeDrawerRepo}
          onClose={() => setSelectedRepoForDrawer(null)}
          repository={activeDrawerRepo}
          onTriggerBackup={async (repoId) => {
            if (onBackupNow) {
              await onBackupNow(repoId);
            } else {
              await fetch(`/api/repositories/${repoId}/backup`, {
                method: "POST",
              });
            }
          }}
        />
      )}
    </div>
  );
}
