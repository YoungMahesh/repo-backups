import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  signState,
  verifyState,
  getGitHubAppInstallationUrl,
  getGitHubAppSlug,
} from "@/lib/github/crypto";

describe("GitHub Cryptographic State Signing & Verification", () => {
  it("generates a valid signed state token containing user ID", () => {
    const userId = "user-test-123";
    const token = signState(userId);

    expect(token).toBeDefined();
    expect(token).toContain(".");

    const result = verifyState(token);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe(userId);
    expect(result.error).toBeUndefined();
  });

  it("rejects tokens with tampered signatures", () => {
    const token = signState("user-456");
    const [payload, sig] = token.split(".");
    const tamperedToken = `${payload}.${sig.slice(0, -4)}abcd`;

    const result = verifyState(tamperedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid state signature");
  });

  it("rejects tokens with tampered payload content", () => {
    const token = signState("user-789");
    const [, sig] = token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({
        userId: "hacker-user",
        timestamp: Date.now(),
        nonce: "fake-nonce",
      }),
    ).toString("base64url");
    const tamperedToken = `${fakePayload}.${sig}`;

    const result = verifyState(tamperedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid state signature");
  });

  it("rejects expired tokens older than 15 minutes", () => {
    const userId = "user-expired";
    const oldTimestamp = Date.now() - 16 * 60 * 1000; // 16 minutes ago

    // Mock Date.now temporarily to generate an older token
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(oldTimestamp);
    const token = signState(userId);
    dateSpy.mockRestore();

    const result = verifyState(token);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("State parameter expired");
  });

  it("rejects tokens with future timestamps beyond acceptable clock drift", () => {
    const userId = "user-future";
    const futureTimestamp = Date.now() + 5 * 60 * 1000; // 5 minutes in future

    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(futureTimestamp);
    const token = signState(userId);
    dateSpy.mockRestore();

    const result = verifyState(token);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("State timestamp is in the future");
  });

  it("rejects missing, null, or malformed state inputs", () => {
    expect(verifyState(null).valid).toBe(false);
    expect(verifyState("").valid).toBe(false);
    expect(verifyState("no-dot-token").valid).toBe(false);
    expect(verifyState("too.many.dots.here").valid).toBe(false);
  });

  it("builds correct GitHub App installation redirect URL", () => {
    const state = "test-signed-state";
    const url = getGitHubAppInstallationUrl(state);
    const slug = getGitHubAppSlug();

    expect(url).toBe(
      `https://github.com/apps/${slug}/installations/new?state=test-signed-state`,
    );
  });
});

describe("GitHub Webhook HMAC-SHA256 Signature Verification", () => {
  const secret = "test-webhook-secret-key-12345";
  const payload = JSON.stringify({ action: "added", installation: { id: 999 } });

  it("successfully validates correct HMAC-SHA256 signature", async () => {
    const { signWebhookPayload, verifyWebhookSignature } = await import(
      "@/lib/github/crypto"
    );
    const signatureHeader = signWebhookPayload(payload, secret);
    expect(signatureHeader.startsWith("sha256=")).toBe(true);

    const result = verifyWebhookSignature(payload, signatureHeader, secret);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects tampered webhook payload", async () => {
    const { signWebhookPayload, verifyWebhookSignature } = await import(
      "@/lib/github/crypto"
    );
    const signatureHeader = signWebhookPayload(payload, secret);

    const tamperedPayload = JSON.stringify({ action: "added", installation: { id: 888 } });
    const result = verifyWebhookSignature(tamperedPayload, signatureHeader, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid payload signature");
  });

  it("rejects invalid or malformed signature header", async () => {
    const { verifyWebhookSignature } = await import("@/lib/github/crypto");

    expect(verifyWebhookSignature(payload, null, secret).valid).toBe(false);
    expect(verifyWebhookSignature(payload, "", secret).valid).toBe(false);
    expect(verifyWebhookSignature(payload, "malformed-signature", secret).valid).toBe(false);
    expect(verifyWebhookSignature(payload, "sha1=12345", secret).valid).toBe(false);
  });

  it("returns error when webhook secret is missing", async () => {
    const { verifyWebhookSignature } = await import("@/lib/github/crypto");
    const result = verifyWebhookSignature(payload, "sha256=12345", "");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Webhook secret is not configured");
  });
});

describe("GitHub App Config Status Check", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("reports missing variables when credentials are not configured", async () => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;

    const { getGitHubAppConfigStatus } = await import("@/lib/github/config");
    const status = getGitHubAppConfigStatus();

    expect(status.isConfigured).toBe(false);
    expect(status.missing).toContain("GITHUB_APP_ID");
    expect(status.missing).toContain("GITHUB_APP_PRIVATE_KEY");
    expect(status.missing).toContain("GITHUB_APP_WEBHOOK_SECRET");
    expect(status.appIdConfigured).toBe(false);
    expect(status.privateKeyConfigured).toBe(false);
  });

  it("reports configured when all credentials are set", async () => {
    process.env.GITHUB_APP_ID = "123456";
    process.env.GITHUB_APP_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----...";
    process.env.GITHUB_APP_WEBHOOK_SECRET = "secret";

    const { getGitHubAppConfigStatus } = await import("@/lib/github/config");
    const status = getGitHubAppConfigStatus();

    expect(status.isConfigured).toBe(true);
    expect(status.missing.length).toBe(0);
    expect(status.appIdConfigured).toBe(true);
    expect(status.privateKeyConfigured).toBe(true);
    expect(status.webhookSecretConfigured).toBe(true);
  });
});

