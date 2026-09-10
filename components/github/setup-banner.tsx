"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { GitHubAppConfigStatus } from "@/lib/github/config";

interface GitHubAppSetupBannerProps {
  status?: GitHubAppConfigStatus | null;
  className?: string;
  forceShow?: boolean;
}

export function GitHubAppSetupBanner({
  status,
  className = "",
  forceShow = false,
}: GitHubAppSetupBannerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // If status indicates everything is configured and not force-shown, hide banner
  if (status && status.isConfigured && !forceShow) {
    return null;
  }

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "http://localhost:3000";

  const callbackUrl = `${origin}/api/github/callback`;
  const webhookUrl = `${origin}/api/github/webhook`;

  const envSnippet = `# GitHub App Credentials
GITHUB_APP_ID="<your_numeric_app_id>"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_WEBHOOK_SECRET="<your_chosen_webhook_secret>"
GITHUB_APP_SLUG="<your_app_slug>"`;

  return (
    <div
      className={`rounded-xl border border-hairline bg-surface-card p-6 sm:p-8 shadow-sm text-ink transition-all ${className}`}
      data-testid="github-setup-banner"
      role="region"
      aria-label="GitHub App Setup Guide"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              data-testid="missing-credentials-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 border border-amber-500/30"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
              Configuration Required
            </span>
            <span className="text-xs text-muted font-sans">
              Setup Experience &amp; Permission Guide
            </span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-ink tracking-tight">
            Configure Your GitHub App
          </h2>

          <p className="font-sans text-sm text-body max-w-2xl">
            To enable repository organization linking, automated Git bundle backups,
            and real-time webhook inventory sync, configure your GitHub App credentials.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline bg-canvas text-xs font-medium text-muted hover:text-ink hover:border-body-strong transition-colors cursor-pointer"
          data-testid="toggle-setup-details"
        >
          <span>{isExpanded ? "Collapse Guide" : "Expand Guide"}</span>
          <svg
            className={`h-3.5 w-3.5 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Environment Variable Status Pills */}
      <div className="pt-5 pb-2">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted mb-3 font-sans">
          Environment Variable Status
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* GITHUB_APP_ID */}
          <div className="rounded-lg border border-hairline bg-surface-soft p-3 flex items-center justify-between">
            <div>
              <code className="font-mono text-xs font-semibold text-ink">
                GITHUB_APP_ID
              </code>
              <p className="text-[11px] text-muted">Numeric App ID</p>
            </div>
            {status?.appIdConfigured ? (
              <Badge variant="pill" className="bg-success/15 text-success border-success/30">
                Configured
              </Badge>
            ) : (
              <Badge variant="pill" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                Missing
              </Badge>
            )}
          </div>

          {/* GITHUB_APP_PRIVATE_KEY */}
          <div className="rounded-lg border border-hairline bg-surface-soft p-3 flex items-center justify-between">
            <div>
              <code className="font-mono text-xs font-semibold text-ink">
                GITHUB_APP_PRIVATE_KEY
              </code>
              <p className="text-[11px] text-muted">RSA Private Key (.pem)</p>
            </div>
            {status?.privateKeyConfigured ? (
              <Badge variant="pill" className="bg-success/15 text-success border-success/30">
                Configured
              </Badge>
            ) : (
              <Badge variant="pill" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                Missing
              </Badge>
            )}
          </div>

          {/* GITHUB_APP_WEBHOOK_SECRET */}
          <div className="rounded-lg border border-hairline bg-surface-soft p-3 flex items-center justify-between">
            <div>
              <code className="font-mono text-xs font-semibold text-ink">
                GITHUB_APP_WEBHOOK_SECRET
              </code>
              <p className="text-[11px] text-muted">HMAC-SHA256 Secret</p>
            </div>
            {status?.webhookSecretConfigured ? (
              <Badge variant="pill" className="bg-success/15 text-success border-success/30">
                Configured
              </Badge>
            ) : (
              <Badge variant="pill" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                Missing
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Step-by-Step Instructions */}
      {isExpanded && (
        <div className="mt-6 space-y-6 pt-6 border-t border-hairline" data-testid="setup-steps-container">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary font-mono text-xs font-bold">
                1
              </span>
              <h3 className="font-serif text-lg font-medium text-ink">
                Create a New GitHub App
              </h3>
            </div>
            <p className="font-sans text-xs text-body pl-8">
              Navigate to{" "}
              <a
                href="https://github.com/settings/apps/new"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                GitHub Developer Settings &rarr; New GitHub App
              </a>
              . Set a distinctive name (e.g. <span className="font-semibold text-ink">Repo Manage</span>)
              and specify your Homepage URL.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary font-mono text-xs font-bold">
                2
              </span>
              <h3 className="font-serif text-lg font-medium text-ink">
                Configure Callback &amp; Webhook URLs
              </h3>
            </div>
            <div className="pl-8 space-y-3">
              <div className="rounded-lg border border-hairline bg-surface-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink font-sans">
                    Callback URL
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(callbackUrl, "callback")}
                    className="text-xs text-primary hover:underline font-mono cursor-pointer"
                  >
                    {copiedKey === "callback" ? "Copied!" : "Copy URL"}
                  </button>
                </div>
                <code className="block mt-1 font-mono text-xs text-body break-all bg-canvas p-1.5 rounded border border-hairline">
                  {callbackUrl}
                </code>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink font-sans">
                    Webhook URL
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookUrl, "webhook")}
                    className="text-xs text-primary hover:underline font-mono cursor-pointer"
                  >
                    {copiedKey === "webhook" ? "Copied!" : "Copy URL"}
                  </button>
                </div>
                <code className="block mt-1 font-mono text-xs text-body break-all bg-canvas p-1.5 rounded border border-hairline">
                  {webhookUrl}
                </code>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary font-mono text-xs font-bold">
                3
              </span>
              <h3 className="font-serif text-lg font-medium text-ink">
                Configure Strict Read-Only Permissions
              </h3>
            </div>
            <div className="pl-8 space-y-2.5">
              <p className="font-sans text-xs text-body">
                In the <span className="font-semibold text-ink">Repository permissions</span> section, configure the following access levels:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-hairline bg-canvas p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-ink">
                      Contents: read
                    </span>
                    <Badge variant="pill" className="bg-success/15 text-success border-success/30 text-[11px]">
                      Read-only
                    </Badge>
                  </div>
                  <p className="font-sans text-[11px] text-muted">
                    Allows reading commits, branches, and trees to stream complete Git bundle archives to disaster storage.
                  </p>
                </div>

                <div className="rounded-lg border border-hairline bg-canvas p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-ink">
                      Metadata: read
                    </span>
                    <Badge variant="pill" className="bg-success/15 text-success border-success/30 text-[11px]">
                      Read-only
                    </Badge>
                  </div>
                  <p className="font-sans text-[11px] text-muted">
                    Mandatory GitHub permission to inspect repository names, privacy badges, and default branch names.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-soft p-3">
                <p className="font-sans text-xs font-medium text-ink">
                  Subscribe to Webhook Events:
                </p>
                <p className="font-sans text-[11px] text-muted mt-0.5">
                  Check <span className="font-semibold text-ink">Installation target</span> and{" "}
                  <span className="font-semibold text-ink">Installation repositories</span> to receive real-time inventory updates whenever an administrator adds or removes repositories on GitHub.
                </p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary font-mono text-xs font-bold">
                4
              </span>
              <h3 className="font-serif text-lg font-medium text-ink">
                Generate Private Key &amp; Retrieve App ID
              </h3>
            </div>
            <p className="font-sans text-xs text-body pl-8">
              After creating the app, note the numeric <span className="font-semibold text-ink">App ID</span> at the top of the page. Scroll down to <span className="font-semibold text-ink">Private keys</span> and click <span className="font-semibold text-ink">Generate a private key</span>. Save the downloaded <code className="font-mono text-xs bg-surface-soft px-1 rounded">.pem</code> file securely.
            </p>
          </div>

          {/* Step 5 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary font-mono text-xs font-bold">
                5
              </span>
              <h3 className="font-serif text-lg font-medium text-ink">
                Set Environment Variables (.env)
              </h3>
            </div>
            <div className="pl-8 space-y-2">
              <div className="relative rounded-lg border border-hairline bg-surface-dark p-4 text-on-dark font-mono text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleCopy(envSnippet, "env")}
                  className="absolute top-3 right-3 text-xs text-on-dark-soft hover:text-on-primary bg-surface-dark-elevated px-2.5 py-1 rounded border border-hairline/20 cursor-pointer"
                >
                  {copiedKey === "env" ? "Copied!" : "Copy Snippet"}
                </button>
                <pre className="text-on-dark-soft whitespace-pre-wrap leading-relaxed pr-24">
                  {envSnippet}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
