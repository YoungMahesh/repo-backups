import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { GitHubAppSetupBanner } from "@/components/github/setup-banner";
import type { GitHubAppConfigStatus } from "@/lib/github/config";

describe("GitHubAppSetupBanner Component (Ticket 06)", () => {
  const unconfiguredStatus: GitHubAppConfigStatus = {
    isConfigured: false,
    missing: ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_WEBHOOK_SECRET"],
    appIdConfigured: false,
    privateKeyConfigured: false,
    webhookSecretConfigured: false,
    slug: null,
    callbackPath: "/api/github/callback",
    webhookPath: "/api/github/webhook",
    permissions: [
      {
        resource: "Contents",
        access: "read",
        description: "Read-only access to repository contents",
      },
      {
        resource: "Metadata",
        access: "read",
        description: "Read-only access to repository metadata",
      },
    ],
    events: [
      {
        name: "Installation target / repositories",
        description: "Receive real-time synchronization",
      },
    ],
  };

  const configuredStatus: GitHubAppConfigStatus = {
    ...unconfiguredStatus,
    isConfigured: true,
    missing: [],
    appIdConfigured: true,
    privateKeyConfigured: true,
    webhookSecretConfigured: true,
    slug: "my-test-app",
  };

  it("renders setup banner when GitHub App credentials are missing", () => {
    const html = renderToString(
      <GitHubAppSetupBanner status={unconfiguredStatus} />,
    );

    expect(html).toContain("data-testid=\"github-setup-banner\"");
    expect(html).toContain("Configure Your GitHub App");
    expect(html).toContain("Configuration Required");
    expect(html).toContain("GITHUB_APP_ID");
    expect(html).toContain("GITHUB_APP_PRIVATE_KEY");
    expect(html).toContain("GITHUB_APP_WEBHOOK_SECRET");
  });

  it("provides clear step-by-step instructions for creating the app", () => {
    const html = renderToString(
      <GitHubAppSetupBanner status={unconfiguredStatus} />,
    );

    expect(html).toContain("Create a New GitHub App");
    expect(html).toContain("Configure Callback &amp; Webhook URLs");
    expect(html).toContain("Configure Strict Read-Only Permissions");
    expect(html).toContain("Generate Private Key &amp; Retrieve App ID");
    expect(html).toContain("Set Environment Variables (.env)");
  });

  it("explicitly specifies read-only permissions: Contents: read and Metadata: read", () => {
    const html = renderToString(
      <GitHubAppSetupBanner status={unconfiguredStatus} />,
    );

    expect(html).toContain("Contents: read");
    expect(html).toContain("Metadata: read");
    expect(html).toContain("Read-only");
  });

  it("explicitly specifies callback URL and webhook URL", () => {
    const html = renderToString(
      <GitHubAppSetupBanner status={unconfiguredStatus} />,
    );

    expect(html).toContain("/api/github/callback");
    expect(html).toContain("/api/github/webhook");
  });

  it("displays missing status badges for unconfigured environment variables", () => {
    const html = renderToString(
      <GitHubAppSetupBanner status={unconfiguredStatus} />,
    );

    expect(html).toContain("Missing");
  });

  it("displays configured status badges for partially configured credentials", () => {
    const partialStatus: GitHubAppConfigStatus = {
      ...unconfiguredStatus,
      appIdConfigured: true,
      missing: ["GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_WEBHOOK_SECRET"],
    };

    const html = renderToString(
      <GitHubAppSetupBanner status={partialStatus} />,
    );

    expect(html).toContain("Configured");
    expect(html).toContain("Missing");
  });

  it("does not render when credentials are fully configured", () => {
    const html = renderToString(
      <GitHubAppSetupBanner status={configuredStatus} />,
    );

    expect(html).toBe("");
  });

  it("renders when fully configured if forceShow is enabled", () => {
    const html = renderToString(
      <GitHubAppSetupBanner status={configuredStatus} forceShow={true} />,
    );

    expect(html).toContain("data-testid=\"github-setup-banner\"");
    expect(html).toContain("Configure Your GitHub App");
  });

  it("adheres strictly to the warm-canvas design system tokens", () => {
    const html = renderToString(
      <GitHubAppSetupBanner status={unconfiguredStatus} />,
    );

    expect(html).toContain("bg-surface-card");
    expect(html).toContain("border-hairline");
    expect(html).toContain("font-serif");
    expect(html).toContain("text-ink");
  });
});
