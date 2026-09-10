"use client";

import React, { useState } from "react";

export interface RestorationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundleFileName?: string | null;
  repoName?: string;
  commitSha?: string | null;
}

export function RestorationGuideModal({
  isOpen,
  onClose,
  bundleFileName,
  repoName = "restored-repo",
  commitSha,
}: RestorationGuideModalProps) {
  const [copiedGeneric, setCopiedGeneric] = useState(false);
  const [copiedSpecific, setCopiedSpecific] = useState(false);

  if (!isOpen) return null;

  const canonicalGenericCommand = "git clone <bundle-file> <target-folder>";
  const effectiveBundleName = bundleFileName || `${repoName}.bundle`;
  const specificCommand = `git clone ${effectiveBundleName} ./${repoName}`;

  const handleCopy = async (text: string, isSpecific: boolean) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    if (isSpecific) {
      setCopiedSpecific(true);
      setTimeout(() => setCopiedSpecific(false), 2000);
    } else {
      setCopiedGeneric(true);
      setTimeout(() => setCopiedGeneric(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="restoration-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs"
      data-testid="restoration-guide-modal"
    >
      {/* Modal Container */}
      <div
        className="relative w-full max-w-xl rounded-xl border border-hairline bg-canvas p-6 sm:p-8 shadow-xl space-y-6 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-sans text-[11px] uppercase tracking-wider text-muted font-medium">
                Disaster Recovery Guide
              </span>
            </div>
            <h2
              id="restoration-modal-title"
              className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-ink"
            >
              Offline Repository Restoration
            </h2>
            <p className="font-sans text-xs text-muted mt-1">
              Reconstruct the complete Git repository offline using your standalone Git bundle
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close restoration guide"
            className="rounded-full p-1.5 text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
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

        {/* Informational Callout explaining offline capabilities */}
        <div className="rounded-lg border border-hairline bg-surface-card p-4 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-ink">
            <svg
              className="h-4 w-4 text-primary shrink-0"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Zm-.75 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
            </svg>
            <span>Complete Offline Recovery Point</span>
          </div>
          <p className="text-body leading-relaxed">
            The bundle restores complete git branches and tags offline. Git bundles are cryptographic,
            self-contained binary packages that preserve 100% of commit histories, branches, and tags
            without requiring an active internet connection or GitHub access.
          </p>
        </div>

        {/* Step-by-Step Guide */}
        <div className="space-y-4">
          {/* Step 1: Canonical Command */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-muted">
                Canonical Command
              </span>
              <button
                type="button"
                data-testid="copy-canonical-cmd-btn"
                onClick={() => handleCopy(canonicalGenericCommand, false)}
                className="inline-flex items-center gap-1.5 rounded-md bg-canvas border border-hairline px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-soft active:bg-surface-card transition-colors cursor-pointer"
              >
                {copiedGeneric ? (
                  <>
                    <svg
                      className="h-3.5 w-3.5 text-success"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                    <span className="text-success">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3.5 w-3.5 text-muted"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                    </svg>
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Window Card (Dark surface token) */}
            <div className="rounded-lg border border-hairline bg-surface-dark p-3.5 text-on-dark font-mono text-xs overflow-x-auto shadow-inner">
              <code>git clone &lt;bundle-file&gt; &lt;target-folder&gt;</code>
            </div>
          </div>

          {/* Contextual Parameterized Command */}
          {bundleFileName && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-muted">
                  Ready-to-run for this backup
                </span>
                <button
                  type="button"
                  data-testid="copy-specific-cmd-btn"
                  onClick={() => handleCopy(specificCommand, true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-canvas border border-hairline px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-soft active:bg-surface-card transition-colors cursor-pointer"
                >
                  {copiedSpecific ? (
                    <>
                      <svg
                        className="h-3.5 w-3.5 text-success"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                      </svg>
                      <span className="text-success">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-3.5 w-3.5 text-muted"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                        <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-dark-elevated p-3.5 text-on-dark font-mono text-xs overflow-x-auto shadow-inner">
                <code>{specificCommand}</code>
              </div>
            </div>
          )}

          {/* Verification / Next steps */}
          <div className="space-y-1 text-xs text-muted">
            <p className="font-semibold text-body">Restoration Verification:</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Navigate to your restored directory: <code className="font-mono text-ink">cd ./{repoName}</code></li>
              <li>Inspect restored branches: <code className="font-mono text-ink">git branch -a</code></li>
              <li>Inspect restored tags: <code className="font-mono text-ink">git tag -l</code></li>
              {commitSha && (
                <li>Verify target commit: <code className="font-mono text-ink">{commitSha.slice(0, 8)}</code></li>
              )}
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-5 py-2 text-xs font-medium text-on-primary hover:bg-primary-active transition-colors shadow-xs cursor-pointer"
          >
            Got it, close
          </button>
        </div>
      </div>
    </div>
  );
}
