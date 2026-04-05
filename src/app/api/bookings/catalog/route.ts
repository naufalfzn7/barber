import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { bookingService } from "@/server/services/bookingService";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["MEMBER", "ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("branchId") ?? undefined;

  if (auth.role === "ADMIN") {
    if (!auth.branchId) {
      return NextResponse.json(
        { message: "Admin does not have branch assignment" },
        { status: 400 },
      );
    }

    if (requestedBranchId && requestedBranchId !== auth.branchId) {
      return NextResponse.json(
        { message: "Forbidden for other branch" },
        { status: 403 },
      );
    }
  }

  const branchId =
    auth.role === "ADMIN" ? (auth.branchId ?? undefined) : requestedBranchId;

  const catalog = await bookingService.getBookingCatalog({ branchId });
  return NextResponse.json(catalog, { status: 200 });
}
