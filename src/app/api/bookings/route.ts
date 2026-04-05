import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { bookingService } from "@/server/services/bookingService";

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["MEMBER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      branchId?: string;
      serviceId?: string;
      scheduledStart?: string;
      barbermanId?: string;
      notes?: string;
    };

    if (!body.branchId || !body.serviceId || !body.scheduledStart) {
      return NextResponse.json(
        { message: "branchId, serviceId, and scheduledStart are required" },
        { status: 400 },
      );
    }

    const booking = await bookingService.createBooking({
      memberId: auth.sub,
      branchId: body.branchId,
      serviceId: body.serviceId,
      scheduledStart: body.scheduledStart,
      barbermanId: body.barbermanId,
      notes: body.notes,
    });

    return NextResponse.json(
      {
        message: "Booking confirmed",
        booking,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create booking";
    return NextResponse.json({ message }, { status: 400 });
  }
}
