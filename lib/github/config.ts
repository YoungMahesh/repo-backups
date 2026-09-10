export interface GitHubAppConfigStatus {
  isConfigured: boolean;
  missing: string[];
  appIdConfigured: boolean;
  privateKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  slug: string | null;
  callbackPath: string;
  webhookPath: string;
  permissions: {
    resource: string;
    access: "read" | "write" | "admin";
    description: string;
  }[];
  events: {
    name: string;
    description: string;
  }[];
}

/**
 * Checks whether the necessary GitHub App environment variables are configured.
 * Does not expose raw secret values.
 */
export function getGitHubAppConfigStatus(): GitHubAppConfigStatus {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  const slug = process.env.GITHUB_APP_SLUG || null;

  const missing: string[] = [];
  if (!appId || appId.trim() === "") {
    missing.push("GITHUB_APP_ID");
  }
  if (!privateKey || privateKey.trim() === "") {
    missing.push("GITHUB_APP_PRIVATE_KEY");
  }
  if (!webhookSecret || webhookSecret.trim() === "") {
    missing.push("GITHUB_APP_WEBHOOK_SECRET");
  }

  const isConfigured = missing.length === 0;

  return {
    isConfigured,
    missing,
    appIdConfigured: Boolean(appId && appId.trim() !== ""),
    privateKeyConfigured: Boolean(privateKey && privateKey.trim() !== ""),
    webhookSecretConfigured: Boolean(webhookSecret && webhookSecret.trim() !== ""),
    slug,
    callbackPath: "/api/github/callback",
    webhookPath: "/api/github/webhook",
    permissions: [
      {
        resource: "Contents",
        access: "read",
        description: "Read-only access to repository contents, commits, and refs to generate Git bundles",
      },
      {
        resource: "Metadata",
        access: "read",
        description: "Read-only access to repository metadata and branch configuration (mandatory)",
      },
    ],
    events: [
      {
        name: "Installation target / repositories",
        description: "Receive real-time synchronization when repositories are added or removed",
      },
    ],
  };
}
