"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface DisconnectInstallationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  accountLogin: string;
  isDisconnecting?: boolean;
}

export function DisconnectInstallationModal({
  isOpen,
  onClose,
  onConfirm,
  accountLogin,
  isDisconnecting = false,
}: DisconnectInstallationModalProps) {
  const [typedLogin, setTypedLogin] = useState("");

  if (!isOpen) return null;

  const isMatched = typedLogin.trim() === accountLogin;

  const handleClose = () => {
    setTypedLogin("");
    onClose();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMatched && !isDisconnecting) {
      setTypedLogin("");
      onConfirm();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disconnect-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs"
      data-testid="disconnect-modal"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl border border-hairline bg-surface-card p-6 sm:p-8 shadow-xl space-y-6 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-error" />
              <span className="font-sans text-[11px] uppercase tracking-wider text-muted font-medium">
                Danger Zone &bull; Installation Offboarding
              </span>
            </div>
            <h2
              id="disconnect-modal-title"
              className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-ink"
            >
              Disconnect {accountLogin}
            </h2>
            <p className="font-sans text-xs text-muted mt-1">
              Sever GitHub App authorization and deactivate all scheduled repository backups.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isDisconnecting}
            aria-label="Close disconnect modal"
            className="rounded-full p-1.5 text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer disabled:opacity-50"
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

        {/* Informative Alert on S3 Historical Backup Preservation (Criterion 17) */}
        <div
          className="rounded-lg border border-hairline bg-canvas p-4 text-xs font-sans text-body space-y-1.5"
          data-testid="s3-preservation-alert"
        >
          <div className="flex items-center gap-2 font-medium text-ink">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </span>
            <span>Historical Backup Bundles in S3 Remain Safe</span>
          </div>
          <p className="text-muted leading-relaxed pl-7">
            All past disaster-recovery archives and standalone Git bundles stored in S3 remain completely safe, preserved, and downloadable. Disconnecting an installation will never delete historical backups or commit history.
          </p>
        </div>

        {/* Consequences bullet list */}
        <div className="rounded-lg bg-surface-soft p-4 text-xs font-sans text-muted space-y-2">
          <p className="font-medium text-ink">When you disconnect this installation:</p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Any in-flight running backup jobs will be cleanly terminated.</li>
            <li>Future automated backup schedules will be deactivated for all repositories.</li>
            <li>The GitHub App will be uninstalled remotely from GitHub settings.</li>
            <li>Active repository cards will be removed from your daily operations dashboard.</li>
          </ul>
        </div>

        {/* Confirmation Form requiring typed account login */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <label
              htmlFor="disconnect-confirm-input"
              className="block font-sans text-xs font-medium text-body"
            >
              To confirm disconnection, please type{" "}
              <span className="font-semibold text-ink select-all font-mono">
                {accountLogin}
              </span>{" "}
              below:
            </label>
            <Input
              id="disconnect-confirm-input"
              type="text"
              value={typedLogin}
              onChange={(e) => setTypedLogin(e.target.value)}
              placeholder={accountLogin}
              disabled={isDisconnecting}
              autoComplete="off"
              data-testid="disconnect-confirm-input"
              className="font-mono text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isDisconnecting}
              data-testid="cancel-disconnect-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive-primary"
              disabled={!isMatched || isDisconnecting}
              isLoading={isDisconnecting}
              data-testid="confirm-disconnect-button"
              className="px-5 text-xs font-medium"
            >
              Disconnect Installation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
