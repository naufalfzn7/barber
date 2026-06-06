import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { bookingService } from "@/server/services/bookingService";
import { revalidateBookingData } from "@/server/core/revalidate";
import {
  getPendingBookingHoldExpiresAt,
  PENDING_BOOKING_HOLD_MINUTES,
} from "@/server/services/bookingHold";

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
    revalidateBookingData();

    return NextResponse.json(
      {
        message: `Booking held for ${PENDING_BOOKING_HOLD_MINUTES} minutes`,
        booking: {
          ...booking,
          holdExpiresAt: getPendingBookingHoldExpiresAt(
            booking.createdAt,
          ).toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create booking";
    return NextResponse.json({ message }, { status: 400 });
  }
}
