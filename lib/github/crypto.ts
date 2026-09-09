import crypto from "node:crypto";

export interface StatePayload {
  userId: string;
  timestamp: number;
  nonce: string;
}

export interface VerifyStateResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

function getStateSecret(): string {
  return (
    process.env.GITHUB_APP_STATE_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    "repo-manage-github-app-fallback-secret-key-32chars"
  );
}

/**
 * Creates an HMAC-SHA256 signed state parameter to safely correlate GitHub App
 * installations back to the authenticated user and mitigate CSRF/account-takeover attacks.
 */
export function signState(userId: string): string {
  const payload: StatePayload = {
    userId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getStateSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");

  return `${payloadEncoded}.${signature}`;
}

/**
 * Validates the HMAC-SHA256 signature and freshness of a GitHub App installation state parameter.
 */
export function verifyState(stateToken?: string | null): VerifyStateResult {
  if (!stateToken || typeof stateToken !== "string") {
    return { valid: false, error: "Missing state parameter" };
  }

  const parts = stateToken.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed state parameter format" };
  }

  const [payloadEncoded, signature] = parts;
  const secret = getStateSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, error: "Invalid state signature" };
  }

  try {
    const payload: StatePayload = JSON.parse(
      Buffer.from(payloadEncoded, "base64url").toString("utf-8"),
    );

    if (!payload.userId || typeof payload.userId !== "string") {
      return { valid: false, error: "Invalid state payload: missing userId" };
    }

    const now = Date.now();
    if (now - payload.timestamp > STATE_MAX_AGE_MS) {
      return { valid: false, error: "State parameter expired" };
    }

    // Guard against future clock drift > 1 minute
    if (payload.timestamp > now + 60_000) {
      return { valid: false, error: "State timestamp is in the future" };
    }

    return { valid: true, userId: payload.userId };
  } catch {
    return { valid: false, error: "Failed to parse state payload JSON" };
  }
}

export function getGitHubAppSlug(): string {
  return process.env.GITHUB_APP_SLUG || "repo-manage-app";
}

export function getGitHubAppInstallationUrl(state: string): string {
  const slug = getGitHubAppSlug();
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
}
