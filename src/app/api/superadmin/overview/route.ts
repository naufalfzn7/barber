import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { superadminService } from "@/server/services/superadminService";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const date = request.nextUrl.searchParams.get("date") ?? undefined;
    const result = await superadminService.overview(date);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load overview";
    return NextResponse.json({ message }, { status: 400 });
  }
}
