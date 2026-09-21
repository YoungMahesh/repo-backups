import crypto from "node:crypto";

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: "Organization" | "User" | string;
    avatar_url?: string;
  };
  target_type: "selected" | "all" | string;
  repository_selection?: "selected" | "all" | string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: {
    login: string;
    avatar_url?: string;
    type: string;
  };
}

export interface MockGitHubData {
  installation?: GitHubInstallation;
  repositories?: GitHubRepository[];
  installationToken?: string | null;
  deleteInstallation?: (installationId: number) => Promise<boolean | void> | boolean | void;
  deleteInstallationError?: Error;
}

let mockClientData: MockGitHubData | null = null;

export function setMockGitHubClient(data: MockGitHubData | null) {
  mockClientData = data;
}

export function getMockGitHubClient(): MockGitHubData | null {
  return mockClientData;
}

/**
 * Generates a signed RS256 JWT for GitHub App authentication.
 */
export function generateGitHubAppJwt(): string | null {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    return null;
  }

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // 1 minute in the past for clock drift
    exp: now + 10 * 60, // 10 minutes maximum
    iss: appId,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const message = `${encodedHeader}.${encodedPayload}`;

  try {
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(message);
    sign.end();
    // Normalize PEM key if newline escapes were provided
    const formattedKey = privateKey.replace(/\\n/g, "\n");
    const signature = sign.sign(formattedKey, "base64url");
    return `${message}.${signature}`;
  } catch (error) {
    console.error("Error signing GitHub App JWT:", error);
    return null;
  }
}

/**
 * Fetches installation details from GitHub API (or mock data if configured/unconfigured).
 */
export async function fetchInstallationDetails(
  installationId: number,
): Promise<GitHubInstallation> {
  if (mockClientData?.installation) {
    return mockClientData.installation;
  }

  const jwt = generateGitHubAppJwt();
  if (!jwt) {
    // Fallback development mock if no credentials configured
    return {
      id: installationId,
      account: {
        login: "acme-corp",
        type: "Organization",
        avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4",
      },
      target_type: "selected",
      repository_selection: "selected",
    };
  }

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "repo-manage-backup-app",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch installation from GitHub: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Exchanges the App JWT for a short-lived Installation Access Token.
 */
export async function fetchInstallationToken(
  installationId: number,
): Promise<string | null> {
  if (mockClientData?.installationToken !== undefined) {
    return mockClientData.installationToken;
  }
  if (mockClientData) {
    return "mock-ghs-installation-token-12345";
  }

  const jwt = generateGitHubAppJwt();
  if (!jwt) {
    return null;
  }

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "repo-manage-backup-app",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to obtain installation token: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

/**
 * Fetches the list of authorized repositories under a GitHub App Installation.
 */
export async function fetchInstallationRepositories(
  installationId: number,
): Promise<GitHubRepository[]> {
  if (mockClientData?.repositories) {
    return mockClientData.repositories;
  }

  const token = await fetchInstallationToken(installationId);
  if (!token) {
    // Return realistic fallback repositories for development demo
    return [
      {
        id: 101001,
        name: "infrastructure-core",
        full_name: "acme-corp/infrastructure-core",
        private: true,
        default_branch: "main",
        owner: {
          login: "acme-corp",
          avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4",
          type: "Organization",
        },
      },
      {
        id: 101002,
        name: "customer-portal",
        full_name: "acme-corp/customer-portal",
        private: false,
        default_branch: "main",
        owner: {
          login: "acme-corp",
          avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4",
          type: "Organization",
        },
      },
      {
        id: 101003,
        name: "api-gateway",
        full_name: "acme-corp/api-gateway",
        private: true,
        default_branch: "production",
        owner: {
          login: "acme-corp",
          avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4",
          type: "Organization",
        },
      },
      {
        id: 101004,
        name: "docs-public",
        full_name: "acme-corp/docs-public",
        private: false,
        default_branch: "master",
        owner: {
          login: "acme-corp",
          avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4",
          type: "Organization",
        },
      },
    ];
  }

  const response = await fetch(
    "https://api.github.com/installation/repositories?per_page=100",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "repo-manage-backup-app",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to list installation repositories: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { repositories: GitHubRepository[] };
  return data.repositories || [];
}

export interface DeleteInstallationResult {
  success: boolean;
  alreadyDeleted?: boolean;
}

/**
 * Deletes a GitHub App Installation via GitHub REST API (DELETE /app/installations/{installation_id}).
 * Uses an RS256 JWT for app-level authentication.
 * Treats 204 No Content as success, and 404 Not Found as remote success (already deleted on GitHub).
 */
export async function deleteInstallation(
  installationId: number,
): Promise<DeleteInstallationResult> {
  if (mockClientData?.deleteInstallationError) {
    throw mockClientData.deleteInstallationError;
  }
  if (mockClientData?.deleteInstallation) {
    await mockClientData.deleteInstallation(installationId);
    return { success: true };
  }
  if (mockClientData) {
    return { success: true };
  }

  const jwt = generateGitHubAppJwt();
  if (!jwt) {
    // Fallback development mock if no credentials configured
    return { success: true };
  }

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "repo-manage-backup-app",
      },
    },
  );

  if (response.status === 204) {
    return { success: true };
  }

  if (response.status === 404) {
    return { success: true, alreadyDeleted: true };
  }

  if (!response.ok) {
    throw new Error(
      `Failed to delete installation from GitHub: ${response.status} ${response.statusText}`,
    );
  }

  return { success: true };
}

