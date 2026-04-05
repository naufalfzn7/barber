import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { bookingService } from "@/server/services/bookingService";

function resolveBranchId(
  auth: { role: "MEMBER" | "ADMIN" | "SUPER_ADMIN"; branchId?: string | null },
  requestedBranchId?: string | null,
): { branchId?: string; error?: NextResponse } {
  if (auth.role === "ADMIN") {
    if (!auth.branchId) {
      return {
        error: NextResponse.json(
          { message: "Admin does not have branch assignment" },
          { status: 400 },
        ),
      };
    }

    if (requestedBranchId && requestedBranchId !== auth.branchId) {
      return {
        error: NextResponse.json(
          { message: "Forbidden for other branch" },
          { status: 403 },
        ),
      };
    }

    return { branchId: auth.branchId };
  }

  if (!requestedBranchId) {
    return {
      error: NextResponse.json(
        { message: "branchId is required for super admin" },
        { status: 400 },
      ),
    };
  }

  return { branchId: requestedBranchId };
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("branchId");
  const date = searchParams.get("date") ?? undefined;

  const scope = resolveBranchId(auth, requestedBranchId);
  if (scope.error) {
    return scope.error;
  }

  try {
    const data = await bookingService.adminDailyDashboard({
      branchId: scope.branchId!,
      date,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load daily dashboard";
    return NextResponse.json({ message }, { status: 400 });
  }
}
