import { NextRequest, NextResponse } from "next/server";
import { verifyState } from "@/lib/github/crypto";
import {
  fetchInstallationDetails,
  fetchInstallationRepositories,
} from "@/lib/github/client";
import { reconcileInstallation } from "@/lib/github/reconciliation";

function getRedirectBaseUrl(request: NextRequest): URL {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host");

  const proto =
    request.headers.get("x-forwarded-proto") ||
    (request.url.startsWith("https") ? "https" : "http");

  if (host && !host.startsWith("0.0.0.0")) {
    return new URL("/", `${proto}://${host}`);
  }

  if (process.env.BETTER_AUTH_URL) {
    return new URL("/", process.env.BETTER_AUTH_URL);
  }

  try {
    const parsed = new URL(request.url);
    if (parsed.hostname !== "0.0.0.0") {
      return new URL("/", parsed.origin);
    }
  } catch {
    // Ignore URL parse errors and fall through
  }

  return new URL("/", "http://localhost:3000");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationIdParam = searchParams.get("installation_id");
  const stateParam = searchParams.get("state");
  const format = searchParams.get("format");
  const accept = request.headers.get("accept") || "";
  const wantsJson = format === "json" || accept.includes("application/json");

  // 1. Verify signed state parameter
  const verification = verifyState(stateParam);
  if (!verification.valid || !verification.userId) {
    const error = verification.error || "Cryptographic state verification failed";
    if (wantsJson) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const redirectUrl = getRedirectBaseUrl(request);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!installationIdParam) {
    const error = "Missing installation_id parameter";
    if (wantsJson) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const redirectUrl = getRedirectBaseUrl(request);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  const installationId = parseInt(installationIdParam, 10);
  if (isNaN(installationId)) {
    const error = "Invalid installation_id parameter";
    if (wantsJson) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const redirectUrl = getRedirectBaseUrl(request);
    redirectUrl.searchParams.set("error", error);
    return NextResponse.redirect(redirectUrl);
  }

  const userId = verification.userId;

  try {
    // 2. Fetch installation metadata and authorized repository inventory
    const details = await fetchInstallationDetails(installationId);
    const repositories = await fetchInstallationRepositories(installationId);

    // 3. Reconcile installation record and sync authorized repositories
    const { installation: savedInstallation, repositoriesCount, isReconnected } =
      await reconcileInstallation({
        userId,
        installationId,
        details,
        repositories,
      });

    if (wantsJson) {
      return NextResponse.json({
        success: true,
        installation: savedInstallation,
        repositoriesCount,
        reconnected: isReconnected,
      });
    }

    const redirectUrl = getRedirectBaseUrl(request);
    redirectUrl.searchParams.set("connected", "success");
    redirectUrl.searchParams.set("org", details.account.login);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Failed to link GitHub installation";
    if (wantsJson) {
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    const redirectUrl = getRedirectBaseUrl(request);
    redirectUrl.searchParams.set("error", errorMsg);
    return NextResponse.redirect(redirectUrl);
  }
}
