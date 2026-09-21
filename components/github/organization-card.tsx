"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisconnectInstallationModal } from "@/components/github/disconnect-modal";

export interface ConnectedInstallation {
  id: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  avatarUrl?: string | null;
  targetType: string;
  status?: string;
  disconnectedAt?: string | Date | null;
  repositoryCount: number;
  updatedAt?: string | Date;
}

interface OrganizationCardProps {
  installation: ConnectedInstallation;
  onSync: (installationId: number) => Promise<void>;
  isSyncing?: boolean;
  onDisconnect?: (installation: ConnectedInstallation) => Promise<void> | void;
  isDisconnecting?: boolean;
}

export function OrganizationCard({
  installation,
  onSync,
  isSyncing = false,
  onDisconnect,
  isDisconnecting = false,
}: OrganizationCardProps) {
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

  return (
    <>
      <div
        className="rounded-lg border border-hairline bg-surface-card p-6 sm:p-8 shadow-xs transition-colors"
        data-testid="organization-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Organization Identity & Scope */}
          <div className="flex items-start sm:items-center gap-4">
            {/* 40px circular avatar per DESIGN.md */}
            {installation.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={installation.avatarUrl}
                alt={`${installation.accountLogin} avatar`}
                className="h-10 w-10 shrink-0 rounded-full border border-hairline object-cover bg-canvas"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas font-serif text-sm font-medium text-ink">
                {installation.accountLogin.substring(0, 2).toUpperCase()}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif text-xl sm:text-2xl font-normal text-ink tracking-tight">
                  {installation.accountLogin}
                </h2>
                <Badge variant="pill">{installation.accountType}</Badge>
                <Badge variant="outline">
                  {installation.targetType === "selected"
                    ? "Select Repositories"
                    : "All Repositories"}
                </Badge>
              </div>

              <p className="mt-1 font-sans text-xs text-muted flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-success" />
                Connected via fine-grained GitHub App &bull;{" "}
                <span className="font-semibold text-ink">
                  {`${installation.repositoryCount} ${
                    installation.repositoryCount === 1
                      ? "authorized repository"
                      : "authorized repositories"
                  }`}
                </span>
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0 flex-wrap">
            <Button
              variant="secondary"
              onClick={() => onSync(installation.installationId)}
              isLoading={isSyncing}
              disabled={isDisconnecting}
              className="flex items-center gap-2 text-xs font-medium"
              data-testid="sync-button"
            >
              {!isSyncing && (
                <svg
                  className="h-3.5 w-3.5 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              )}
              Sync from GitHub
            </Button>

            <a
              href="/api/github/connect"
              className="inline-flex items-center justify-center h-10 px-3.5 rounded-md border border-hairline bg-canvas text-xs font-medium text-muted hover:text-ink transition-colors"
              title="Configure or grant access to more repositories on GitHub"
            >
              Manage Permissions
            </a>

            {/* Destructive Disconnect Action adhering to DESIGN.md */}
            <Button
              variant="destructive"
              onClick={() => setIsDisconnectModalOpen(true)}
              disabled={isSyncing || isDisconnecting}
              isLoading={isDisconnecting}
              className="text-xs font-medium"
              data-testid="disconnect-button"
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      <DisconnectInstallationModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        accountLogin={installation.accountLogin}
        isDisconnecting={isDisconnecting}
        onConfirm={async () => {
          if (onDisconnect) {
            await onDisconnect(installation);
          }
          setIsDisconnectModalOpen(false);
        }}
      />
    </>
  );
}
