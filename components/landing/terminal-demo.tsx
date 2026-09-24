"use client";

import React, { useState } from "react";

type TabId = "verify" | "clone" | "s3";

interface TabConfig {
  id: TabId;
  label: string;
  command: string;
  output: string[];
  note: string;
}

const TABS: TabConfig[] = [
  {
    id: "verify",
    label: "git bundle verify",
    command: "git bundle verify backups/core-api-2026-09-22T040000Z.bundle",
    output: [
      "The bundle contains these 3 refs:",
      "7a4f912c4e1a5f6e8b2d1c3a7e5f9a1b3c5d7e9f refs/heads/main",
      "b89e2110c73d4e6a8f1b2c5d7e9f0a2b4c6d8e1a refs/heads/release/v2.4",
      "f4118a9902b53c7e9a1b2d4e6f8a0c2e4b6d8f0a refs/tags/v2.4.1",
      "",
      "The bundle records a complete commit graph.",
      "Ref and commit integrity verification: OK",
    ],
    note: "Validates packfile cryptographic signatures, branch refs, and commit ancestry without extracting.",
  },
  {
    id: "clone",
    label: "git clone restore",
    command: "git clone backups/core-api-2026-09-22T040000Z.bundle core-api-restored",
    output: [
      "Cloning into 'core-api-restored'...",
      "Receiving objects: 100% (14,820/14,820), 42.18 MiB | 31.40 MiB/s, done.",
      "Resolving deltas: 100% (9,412/9,412), done.",
      "Switched to a new branch 'main'",
      "",
      "Local repository successfully reconstructed from Git bundle.",
      "Total history: 1,842 commits across 2 branches and 1 tag.",
      "Zero platform dependencies required. Sovereign point-in-time recovery.",
    ],
    note: "Reconstructs an authentic, functional working Git repository from the standalone bundle file.",
  },
  {
    id: "s3",
    label: "aws s3 storage",
    command: "aws s3 ls s3://repo-backups/installations/inst_99182/repositories/core-api/",
    output: [
      "2026-09-22 04:00:12  44231840  core-api-2026-09-22T040000Z.bundle",
      "  StorageClass:          STANDARD",
      "  ServerSideEncryption:  aws:kms (aws/s3)",
      "  KmsKeyId:              arn:aws:kms:us-east-1:123456789012:key/repo-backups-vault",
      "  ETag:                  \"8f48b9c2a11b7d5e4932d0e7a1c4b2a9-6\"",
      "",
      "Point-in-time bundle stored with AES-256 server-side encryption.",
      "Retention Window active: 10 snapshots retained, older bundles pruned automatically.",
    ],
    note: "Encrypted at rest in dedicated S3 object storage; retrievable via time-limited presigned URLs.",
  },
];

export interface TerminalDemoProps {
  initialTab?: TabId;
}

export const TerminalDemo: React.FC<TerminalDemoProps> = ({
  initialTab = "verify",
}) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [copied, setCopied] = useState(false);

  const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(currentTab.command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy command to clipboard:", err);
    }
  };

  return (
    <div
      data-testid="terminal-demo"
      className="w-full rounded-xl border border-surface-dark-elevated bg-surface-dark text-on-dark shadow-xl overflow-hidden font-mono"
    >
      {/* Chrome Window Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-surface-dark-elevated bg-surface-dark-soft/80 px-4 py-3 gap-2">
        {/* Window controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56]/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e]/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f]/80 inline-block" />
          </div>
          <span className="ml-2 font-sans text-xs text-on-dark-soft">
            restoration-inspector — git bundle
          </span>
        </div>

        {/* Copy command button */}
        <button
          type="button"
          onClick={handleCopy}
          data-testid="terminal-copy-button"
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-dark-elevated bg-surface-dark-elevated px-2.5 py-1 text-[11px] font-sans font-medium text-on-dark transition-colors hover:bg-surface-dark-elevated/80 cursor-pointer"
          aria-label="Copy terminal command"
        >
          {copied ? (
            <>
              <svg
                className="h-3.5 w-3.5 text-success"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
              </svg>
              <span className="text-success">Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="h-3.5 w-3.5 text-on-dark-soft"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
              </svg>
              <span>Copy snippet</span>
            </>
          )}
        </button>
      </div>

      {/* Interactive Tabs */}
      <div
        className="flex border-b border-surface-dark-elevated bg-surface-dark px-3 pt-2 gap-1 overflow-x-auto"
        role="tablist"
        aria-label="Terminal inspector modes"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-md px-3.5 py-2 text-xs font-sans font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-surface-dark-elevated text-on-dark border-t-2 border-primary"
                  : "text-on-dark-soft hover:text-on-dark hover:bg-surface-dark-soft"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Terminal Body */}
      <div
        id={`panel-${currentTab.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${currentTab.id}`}
        className="p-5 space-y-4 text-xs"
      >
        {/* Command Prompt */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-primary">
          <span className="text-accent-teal select-none" aria-hidden="true">
            user@workstation:~$
          </span>
          <span className="font-semibold text-on-dark whitespace-nowrap">
            {currentTab.command}
          </span>
        </div>

        {/* Command Output */}
        <div className="rounded-lg bg-surface-dark-soft p-4 border border-surface-dark-elevated overflow-x-auto">
          <pre
            data-testid="terminal-output"
            className="text-[12.5px] leading-relaxed text-on-dark font-mono whitespace-pre"
          >
            {currentTab.output.map((line, idx) => {
              const isSuccess =
                line.includes("OK") ||
                line.includes("successfully") ||
                line.includes("100%");
              const isHighlight =
                line.includes("refs/heads") ||
                line.includes("refs/tags") ||
                line.includes("StorageClass");
              return (
                <div
                  key={idx}
                  className={
                    isSuccess
                      ? "text-success font-medium"
                      : isHighlight
                      ? "text-accent-amber"
                      : "text-on-dark-soft"
                  }
                >
                  {line || "\u00A0"}
                </div>
              );
            })}
          </pre>
        </div>

        {/* Informative Note */}
        <div className="flex items-center gap-2 font-sans text-xs text-on-dark-soft pt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-teal shrink-0" />
          <span>{currentTab.note}</span>
        </div>
      </div>
    </div>
  );
};
