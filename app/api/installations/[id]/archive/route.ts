import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { purgeInstallationArchive } from "@/lib/archive/purge";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const result = await purgeInstallationArchive({
    installationIdOrDbId: id,
    userId: session.user.id,
  });

  return NextResponse.json(result.data, { status: result.status });
}
