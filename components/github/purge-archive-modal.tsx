"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PurgeTargetType = "installation" | "repository";

export interface PurgeArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  type: PurgeTargetType;
  targetName: string; // accountLogin for installation, name for repository
  bundleCount?: number;
  isPurging?: boolean;
}

export function PurgeArchiveModal({
  isOpen,
  onClose,
  onConfirm,
  type,
  targetName,
  bundleCount = 0,
  isPurging = false,
}: PurgeArchiveModalProps) {
  const [typedName, setTypedName] = useState("");

  // Reset input on open/close
  useEffect(() => {
    if (!isOpen) {
      setTypedName("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatched = typedName.trim() === targetName;

  const handleClose = () => {
    if (isPurging) return;
    setTypedName("");
    onClose();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMatched && !isPurging) {
      onConfirm();
    }
  };

  const isInstallation = type === "installation";
  const entityLabel = isInstallation ? "Account Archive" : "Repository Archive";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="purge-archive-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs"
      data-testid="purge-archive-modal"
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
                Danger Zone &bull; Permanent Archive Purge
              </span>
            </div>
            <h2
              id="purge-archive-modal-title"
              className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-ink"
            >
              {`Purge ${entityLabel}: ${targetName}`}
            </h2>
            <p className="font-sans text-xs text-muted mt-1">
              Permanently delete all historical Git backup bundles from S3 storage and erase database records.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isPurging}
            aria-label="Close purge archive modal"
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

        {/* Warning Alert on Permanent S3 Storage Destruction */}
        <div
          className="rounded-lg border border-error/25 bg-error/10 p-4 text-xs font-sans text-body space-y-1.5"
          data-testid="s3-destruction-warning"
        >
          <div className="flex items-center gap-2 font-medium text-error">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error/15 text-error">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </span>
            <span className="font-semibold">Irreversible S3 Data Destruction</span>
          </div>
          <p className="text-muted leading-relaxed pl-7">
            This action permanently and irreversibly deletes all disaster-recovery Git backup bundles
            stored in AWS S3 object storage via delete commands. Associated database records will be
            removed. This operation cannot be undone.
          </p>
        </div>

        {/* Consequences bullet list */}
        <div className="rounded-lg bg-surface-soft p-4 text-xs font-sans text-muted space-y-2">
          <p className="font-medium text-ink">
            {`When you purge this ${isInstallation ? "account archive" : "repository archive"}:`}
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>
              All Git backup bundles in S3 (
              <span className="font-medium text-ink">
                {bundleCount} {bundleCount === 1 ? "bundle" : "bundles"}
              </span>
              ) will be permanently destroyed.
            </li>
            <li>
              Historical disaster-recovery access and pre-signed download links will become permanently unavailable.
            </li>
            <li>
              {isInstallation
                ? "The installation record and all associated repository metadata will be permanently deleted from the database."
                : "The repository record and its backup job history will be permanently deleted from the database."}
            </li>
          </ul>
        </div>

        {/* Confirmation Form requiring typed target name */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <label
              htmlFor="purge-confirm-input"
              className="block font-sans text-xs font-medium text-body"
            >
              To confirm archive purge, please type{" "}
              <span className="font-semibold text-ink select-all font-mono">
                {targetName}
              </span>{" "}
              below:
            </label>
            <Input
              id="purge-confirm-input"
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={targetName}
              disabled={isPurging}
              autoComplete="off"
              data-testid="purge-confirm-input"
              className="font-mono text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isPurging}
              data-testid="cancel-purge-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive-primary"
              disabled={!isMatched || isPurging}
              isLoading={isPurging}
              data-testid="confirm-purge-button"
              className="px-5 text-xs font-medium"
            >
              Purge Archive
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
