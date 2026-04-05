import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { bookingRepository } from "@/server/repositories/bookingRepository";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { bookingId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const isDeposit = searchParams.get("isDeposit") === "true";

    // Get booking with payment
    const booking = await bookingRepository.findBookingById(bookingId);
    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 },
      );
    }

    // Verify member owns booking
    if (payload.role === "MEMBER" && booking.memberId !== payload.sub) {
      return NextResponse.json(
        { message: "Unauthorized - not your booking" },
        { status: 403 },
      );
    }

    if (!booking.payment) {
      return NextResponse.json(
        { message: "No payment for booking" },
        { status: 404 },
      );
    }

    // If checking for deposit, make sure payment is deposit payment
    if (isDeposit && !booking.payment.isDeposit) {
      return NextResponse.json(
        { message: "Payment is not a deposit payment" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        payment: {
          id: booking.payment.id,
          status: booking.payment.status,
          amount: booking.payment.amountDue,
          isDeposit: booking.payment.isDeposit,
          paidAt: booking.payment.paidAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get payment status";
    return NextResponse.json({ message }, { status: 400 });
  }
}
