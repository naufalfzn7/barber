import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { revalidateBookingData, revalidateSuperadminData } from "@/server/core/revalidate";
import { schedulingService } from "@/server/services/schedulingService";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json(
      { message: "branchId is required" },
      { status: 400 },
    );
  }

  try {
    const data = await schedulingService.getOperatingHours(branchId, {
      userId: auth.sub,
      role: auth.role,
      branchId: auth.branchId,
    });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch operating hours";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = await request.json();
    const branchId = String(body.branchId ?? "").trim();
    const hours = Array.isArray(body.hours) ? body.hours : [];

    if (!branchId) {
      return NextResponse.json(
        { message: "branchId is required" },
        { status: 400 },
      );
    }

    const data = await schedulingService.saveOperatingHours(branchId, hours, {
      userId: auth.sub,
      role: auth.role,
      branchId: auth.branchId,
    });
    revalidateBookingData();
    revalidateSuperadminData();

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save operating hours";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
