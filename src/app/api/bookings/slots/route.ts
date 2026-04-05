import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { bookingService } from "@/server/services/bookingService";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["MEMBER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");
  const barbermanId = searchParams.get("barbermanId") ?? undefined;

  if (!branchId || !serviceId || !date) {
    return NextResponse.json(
      { message: "branchId, serviceId, and date are required" },
      { status: 400 },
    );
  }

  try {
    const result = await bookingService.getAvailableSlots({
      branchId,
      serviceId,
      date,
      barbermanId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch slots";
    return NextResponse.json({ message }, { status: 400 });
  }
}
