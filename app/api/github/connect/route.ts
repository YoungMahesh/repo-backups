import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signState, getGitHubAppInstallationUrl } from "@/lib/github/crypto";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required to connect GitHub organization" },
      { status: 401 },
    );
  }

  const state = signState(session.user.id);
  const installUrl = getGitHubAppInstallationUrl(state);

  const acceptHeader = request.headers.get("accept") || "";
  const format = request.nextUrl.searchParams.get("format");

  if (format === "json" || acceptHeader.includes("application/json")) {
    return NextResponse.json({
      url: installUrl,
      state,
    });
  }

  return NextResponse.redirect(installUrl);
}
