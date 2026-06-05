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
  const date = searchParams.get("date") ?? undefined;

  if (!branchId) {
    return NextResponse.json(
      { message: "branchId is required" },
      { status: 400 },
    );
  }

  try {
    const data = await schedulingService.getBarberSchedules(
      branchId,
      {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
      date,
    );
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch barber schedules";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = await request.json();
    const branchId = String(body.branchId ?? "").trim();
    const barbermanId = String(body.barbermanId ?? "").trim();
    const date = String(body.date ?? "").trim();

    if (!branchId || !barbermanId || !date) {
      return NextResponse.json(
        { message: "branchId, barbermanId, and date are required" },
        { status: 400 },
      );
    }

    const data = await schedulingService.saveBarberSchedule(
      {
        branchId,
        barbermanId,
        date,
        startTime: body.startTime ? String(body.startTime) : undefined,
        endTime: body.endTime ? String(body.endTime) : undefined,
        isDayOff: Boolean(body.isDayOff),
      },
      {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    );
    revalidateBookingData();
    revalidateSuperadminData();

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save barber schedule";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
