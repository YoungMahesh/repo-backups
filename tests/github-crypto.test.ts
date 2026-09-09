import { describe, it, expect, vi } from "vitest";
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
