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
      bookingId?: string;
    };

    if (!body.bookingId) {
      return NextResponse.json(
        { message: "bookingId is required" },
        { status: 400 },
      );
    }

    const booking = await bookingService.cancelPendingBookingByMember({
      bookingId: body.bookingId,
      memberId: auth.sub,
    });

    return NextResponse.json(
      {
        message: "Booking berhasil dibatalkan",
        booking,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel booking";
    return NextResponse.json({ message }, { status: 400 });
  }
}
