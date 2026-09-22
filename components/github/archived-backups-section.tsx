"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { BackupHistoryDrawer } from "./backup-history-drawer";
import { RestorationGuideModal } from "./restoration-guide-modal";
import { PurgeArchiveModal, PurgeTargetType } from "./purge-archive-modal";
import type { ConnectedInstallation } from "./organization-card";
import type { RepositoryItem } from "./repository-inventory-table";

export interface ArchivedInstallation extends ConnectedInstallation {
  status?: string;
  disconnectedAt?: string | Date | null;
  repositories?: RepositoryItem[];
}

export interface ArchivedBackupsSectionProps {
  archivedInstallations: ArchivedInstallation[];
  archivedRepositories: RepositoryItem[];
  isLoading?: boolean;
  defaultExpanded?: boolean;
  onRevalidate?: () => Promise<void> | void;
  onPurgeSuccess?: (message: string) => void;
}

interface PurgeModalTarget {
  type: PurgeTargetType;
  id: string;
  name: string;
  bundleCount: number;
}

function formatDisconnectionDate(date: string | Date | null | undefined): string {
  if (!date) return "Recently";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
}

export function ArchivedBackupsSection({
  archivedInstallations = [],
  archivedRepositories = [],
  isLoading = false,
  defaultExpanded = false,
  onRevalidate,
  onPurgeSuccess,
}: ArchivedBackupsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [selectedRepoForDrawer, setSelectedRepoForDrawer] = useState<RepositoryItem | null>(null);
  const [directGuideRepo, setDirectGuideRepo] = useState<RepositoryItem | null>(null);

  // Local state to support immediate removal upon purge
  const [localInstallations, setLocalInstallations] = useState(archivedInstallations);
  const [localRepositories, setLocalRepositories] = useState(archivedRepositories);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalInstallations(archivedInstallations);
    }, 0);
    return () => clearTimeout(timer);
  }, [archivedInstallations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalRepositories(archivedRepositories);
    }, 0);
    return () => clearTimeout(timer);
  }, [archivedRepositories]);

  // Purge state
  const [purgeModalTarget, setPurgeModalTarget] = useState<PurgeModalTarget | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Calculate total preserved bundles across all archived repositories
  const totalPreservedBundles = localRepositories.reduce(
    (acc, r) => acc + (r.retentionCount ?? 0),
    0,
  );

  const handlePurgeConfirm = async () => {
    if (!purgeModalTarget) return;

    setIsPurging(true);
    setPurgeError(null);

    try {
      const endpoint =
        purgeModalTarget.type === "installation"
          ? `/api/installations/${purgeModalTarget.id}/archive`
          : `/api/repositories/${purgeModalTarget.id}/archive`;

      const res = await fetch(endpoint, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setPurgeError(data.error || "Failed to purge archive.");
      } else {
        const successMsg = `Successfully purged archived backups for ${purgeModalTarget.name}.`;
        setToastMessage(successMsg);

        // Optimistically update local state so purged items immediately disappear
        if (purgeModalTarget.type === "installation") {
          const instId = purgeModalTarget.id;
          const instName = purgeModalTarget.name;
          setLocalInstallations((prev) => prev.filter((i) => i.id !== instId));
          setLocalRepositories((prev) =>
            prev.filter(
              (r) => r.installationId !== instId && r.accountLogin !== instName,
            ),
          );
        } else {
          const repoId = purgeModalTarget.id;
          setLocalRepositories((prev) => prev.filter((r) => r.id !== repoId));
        }

        setPurgeModalTarget(null);

        if (onPurgeSuccess) {
          onPurgeSuccess(successMsg);
        }

        if (onRevalidate) {
          await onRevalidate();
        }
      }
    } catch (err: unknown) {
      setPurgeError(
        err instanceof Error ? err.message : "An unexpected error occurred during purge.",
      );
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <section
      className="relative rounded-lg border border-hairline bg-surface-soft/40 shadow-xs transition-colors"
      data-testid="archived-backups-section"
      aria-labelledby="archived-backups-heading"
    >
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div
          role="status"
          data-testid="purge-toast"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-card p-4 shadow-xl text-xs font-sans text-ink max-w-md animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
              </svg>
            </span>
            <span className="font-medium text-body">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="rounded p-1 text-muted hover:text-ink cursor-pointer transition-colors"
            aria-label="Close notification"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="archived-backups-content"
        data-testid="archived-backups-toggle"
        className="flex w-full items-center justify-between p-5 sm:p-6 text-left cursor-pointer hover:bg-surface-soft/80 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <div className="flex items-center gap-3.5">
          {/* Archive Box Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-canvas text-muted">
            <svg
              className="h-5 w-5 text-muted"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1V2Zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5H2Zm13-3H1v2h14V2ZM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Z" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2
                id="archived-backups-heading"
                className="font-serif text-lg sm:text-xl font-normal text-ink"
              >
                Archived Backups
              </h2>
              <Badge variant="pill" data-testid="archived-accounts-count-badge">
                {localInstallations.length}
              </Badge>
            </div>
            <p className="font-sans text-xs text-muted mt-0.5">
              Preserved historical backup bundles and disaster recovery access for disconnected accounts
            </p>
          </div>
        </div>

        {/* Right side summary & toggle chevron */}
        <div className="flex items-center gap-3">
          {totalPreservedBundles > 0 && (
            <span className="hidden sm:inline-flex items-center rounded-full border border-hairline bg-surface-card px-2.5 py-0.5 text-xs font-medium text-muted">
              {`${totalPreservedBundles} ${totalPreservedBundles === 1 ? "bundle" : "bundles"} preserved`}
            </span>
          )}

          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-canvas text-muted transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </div>
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div
          id="archived-backups-content"
          className="border-t border-hairline px-5 pb-6 pt-4 sm:px-6 space-y-6"
          data-testid="archived-backups-content"
        >
          {/* Purge Error Notice if any */}
          {purgeError && (
            <div
              role="alert"
              className="rounded-md border border-error/25 bg-error/10 p-3 text-xs text-error flex items-center justify-between gap-2"
            >
              <span>{purgeError}</span>
              <button
                type="button"
                onClick={() => setPurgeError(null)}
                className="font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Informational Callout */}
          <div className="rounded-lg border border-hairline bg-surface-card/70 p-4 text-xs space-y-1">
            <div className="flex items-center gap-2 font-medium text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span>S3 Disaster Recovery Preservation Guarantee</span>
            </div>
            <p className="text-body leading-relaxed">
              When an account is disconnected, its remote GitHub authorization and active backup
              schedules are terminated. All previously created Git backup bundles stored in S3 remain
              completely intact and downloadable.
            </p>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted space-y-2">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-primary" />
              <p>Loading archived accounts and historical backups...</p>
            </div>
          ) : localInstallations.length === 0 ? (
            <div
              className="py-10 text-center text-xs text-muted space-y-2 rounded-lg border border-dashed border-hairline p-6"
              data-testid="no-archived-backups-msg"
            >
              <p className="font-medium text-body">No archived backups</p>
              <p>
                When accounts are disconnected, their preserved disaster-recovery bundles and repositories
                will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="archived-accounts-list">
              {localInstallations.map((inst) => {
                const accountRepos = localRepositories.filter(
                  (r) => r.installationId === inst.id || r.accountLogin === inst.accountLogin,
                );

                const accountBundleCount = accountRepos.reduce(
                  (acc, r) => acc + (r.retentionCount ?? 0),
                  0,
                );

                return (
                  <div
                    key={inst.id}
                    data-testid={`archived-account-${inst.accountLogin}`}
                    className="rounded-lg border border-hairline bg-canvas p-5 shadow-xs space-y-4"
                  >
                    {/* Disconnected Account Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-hairline">
                      <div className="flex items-center gap-3">
                        {inst.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={inst.avatarUrl}
                            alt={inst.accountLogin}
                            className="h-10 w-10 rounded-full border border-hairline object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface-cream-strong font-serif text-sm font-semibold text-ink">
                            {inst.accountLogin.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-serif text-base font-normal text-ink">
                              {inst.accountLogin}
                            </h3>
                            <Badge variant="pill">{inst.accountType}</Badge>
                            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-cream-strong/70 px-2 py-0.5 text-[11px] font-medium text-muted">
                              Disconnected
                            </span>
                          </div>

                          <p
                            className="font-sans text-xs text-muted mt-0.5"
                            data-testid={`disconnected-date-${inst.accountLogin}`}
                          >
                            {`Disconnected on ${formatDisconnectionDate(inst.disconnectedAt)}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center flex-wrap">
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <span className="font-medium text-ink">{accountRepos.length}</span>
                          <span>{accountRepos.length === 1 ? "repository" : "repositories"}</span>
                          <span>&bull;</span>
                          <span
                            className="font-semibold text-ink"
                            data-testid={`account-bundle-count-${inst.accountLogin}`}
                          >
                            {accountBundleCount}
                          </span>
                          <span>{accountBundleCount === 1 ? "bundle preserved" : "bundles preserved"}</span>
                        </div>

                        {/* Purge Account Archive Button */}
                        <button
                          type="button"
                          data-testid={`purge-archive-account-${inst.accountLogin}`}
                          onClick={() =>
                            setPurgeModalTarget({
                              type: "installation",
                              id: inst.id,
                              name: inst.accountLogin,
                              bundleCount: accountBundleCount,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-2.5 py-1 text-xs font-medium text-muted hover:text-error hover:border-error/40 hover:bg-error/5 active:bg-error/10 transition-colors shadow-2xs cursor-pointer"
                          title="Permanently purge preserved disaster-recovery archive for this account"
                        >
                          <svg className="h-3.5 w-3.5 text-current" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a1.75 1.75 0 0 0 1.744 1.575h2.2a1.75 1.75 0 0 0 1.744-1.575l.66-6.6a.75.75 0 1 0-1.492-.15l-.66 6.6a.25.25 0 0 1-.252.225h-2.2a.25.25 0 0 1-.252-.225l-.66-6.6a.75.75 0 0 0-1.492.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
                          </svg>
                          <span>Purge Archive</span>
                        </button>
                      </div>
                    </div>

                    {/* Associated Repositories List */}
                    {accountRepos.length === 0 ? (
                      <p className="text-xs text-muted italic py-2">
                        No repositories recorded for this account.
                      </p>
                    ) : (
                      <div className="divide-y divide-hairline/80 rounded-md border border-hairline/80 overflow-hidden bg-surface-soft/20">
                        {accountRepos.map((repo) => (
                          <div
                            key={repo.id}
                            data-testid={`archived-repo-row-${repo.name}`}
                            onClick={() => setSelectedRepoForDrawer(repo)}
                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-surface-card/60 transition-colors cursor-pointer"
                          >
                            {/* Repository Info */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <svg
                                className="h-4 w-4 shrink-0 text-muted group-hover:text-primary transition-colors"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 0 .5h-6.5a.25.25 0 0 1-.25-.25Z" />
                              </svg>

                              <div className="truncate">
                                <span className="font-sans text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                                  {repo.name}
                                </span>
                                <span className="text-xs text-muted ml-2 font-mono">
                                  {repo.defaultBranch}
                                </span>
                              </div>

                              {repo.isPrivate ? (
                                <Badge variant="pill">Private</Badge>
                              ) : (
                                <Badge variant="pill">Public</Badge>
                              )}
                            </div>

                            {/* Preserved Bundle Count & Actions */}
                            <div
                              className="flex items-center gap-2.5 self-end sm:self-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                className="text-right"
                                data-testid={`bundle-count-${repo.name}`}
                              >
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ink shadow-2xs">
                                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                  {`${repo.retentionCount ?? 0} ${(repo.retentionCount ?? 0) === 1 ? "bundle" : "bundles"} preserved`}
                                </span>
                              </div>

                              {/* Restore Guide shortcut button */}
                              <button
                                type="button"
                                data-testid={`restore-guide-btn-${repo.name}`}
                                onClick={() => setDirectGuideRepo(repo)}
                                className="inline-flex items-center gap-1 rounded-md bg-canvas border border-hairline px-2.5 py-1 text-xs font-medium text-muted hover:text-ink hover:bg-surface-soft active:bg-surface-card transition-colors shadow-2xs cursor-pointer"
                                title="Open offline recovery guide"
                              >
                                <svg
                                  className="h-3 w-3 text-muted"
                                  viewBox="0 0 16 16"
                                  fill="currentColor"
                                >
                                  <path d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm15 0A8 8 0 1 0 0 8a8 8 0 0 0 16 0ZM5.5 4a.75.75 0 0 0-.75.75v6.5a.75.75 0 0 0 1.28.53l5-3.25a.75.75 0 0 0 0-1.06l-5-3.25A.75.75 0 0 0 5.5 4Z" />
                                </svg>
                                <span>Guide</span>
                              </button>

                              {/* Open Backup History Drawer */}
                              <button
                                type="button"
                                data-testid={`view-archived-history-${repo.name}`}
                                onClick={() => setSelectedRepoForDrawer(repo)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-on-primary hover:bg-primary-active transition-colors shadow-2xs cursor-pointer"
                                title="Inspect backups and generate download links"
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  viewBox="0 0 16 16"
                                  fill="currentColor"
                                >
                                  <path fillRule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm15 0A8 8 0 1 0 0 8a8 8 0 0 0 16 0Zm-8.5-4.25a.75.75 0 0 1 1.5 0v3.5l2.25 1.5a.75.75 0 1 1-.832 1.248l-2.625-1.75A.75.75 0 0 1 7.25 8.5V4.75Z" />
                                </svg>
                                <span>Backups &amp; Restore</span>
                              </button>

                              {/* Purge Individual Repository Archive Button */}
                              <button
                                type="button"
                                data-testid={`purge-repo-archive-${repo.name}`}
                                onClick={() =>
                                  setPurgeModalTarget({
                                    type: "repository",
                                    id: repo.id,
                                    name: repo.name,
                                    bundleCount: repo.retentionCount ?? 0,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-hairline bg-canvas px-2.5 py-1 text-xs font-medium text-muted hover:text-error hover:border-error/40 hover:bg-error/5 active:bg-error/10 transition-colors shadow-2xs cursor-pointer"
                                title="Permanently purge this repository archive"
                              >
                                <svg className="h-3 w-3 text-current" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a1.75 1.75 0 0 0 1.744 1.575h2.2a1.75 1.75 0 0 0 1.744-1.575l.66-6.6a.75.75 0 1 0-1.492-.15l-.66 6.6a.25.25 0 0 1-.252.225h-2.2a.25.25 0 0 1-.252-.225l-.66-6.6a.75.75 0 0 0-1.492.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
                                </svg>
                                <span>Purge</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Backup History Drawer */}
      {selectedRepoForDrawer && (
        <BackupHistoryDrawer
          isOpen={!!selectedRepoForDrawer}
          onClose={() => setSelectedRepoForDrawer(null)}
          repository={selectedRepoForDrawer}
        />
      )}

      {/* Direct Restoration Guide Modal */}
      {directGuideRepo && (
        <RestorationGuideModal
          isOpen={!!directGuideRepo}
          onClose={() => setDirectGuideRepo(null)}
          bundleFileName={`${directGuideRepo.name}.bundle`}
          repoName={directGuideRepo.name}
        />
      )}

      {/* Purge Archive Confirmation Modal */}
      {purgeModalTarget && (
        <PurgeArchiveModal
          isOpen={!!purgeModalTarget}
          onClose={() => {
            if (!isPurging) setPurgeModalTarget(null);
          }}
          onConfirm={handlePurgeConfirm}
          type={purgeModalTarget.type}
          targetName={purgeModalTarget.name}
          bundleCount={purgeModalTarget.bundleCount}
          isPurging={isPurging}
        />
      )}
    </section>
  );
}
