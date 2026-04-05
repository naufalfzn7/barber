import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { superadminService } from "@/server/services/superadminService";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const branchId = request.nextUrl.searchParams.get("branchId") ?? undefined;
    const range = request.nextUrl.searchParams.get("range") ?? undefined;
    const result = await superadminService.reports(branchId, range);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load reports";
    return NextResponse.json({ message }, { status: 400 });
  }
}
