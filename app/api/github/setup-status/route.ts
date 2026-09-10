import { NextResponse } from "next/server";
import { getGitHubAppConfigStatus } from "@/lib/github/config";

export async function GET() {
  const status = getGitHubAppConfigStatus();
  return NextResponse.json(status);
}
