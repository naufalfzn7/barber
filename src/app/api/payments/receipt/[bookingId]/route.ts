import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { paymentService } from "@/server/services/paymentService";
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

    // If member, verify they own the booking
    if (payload.role === "MEMBER") {
      const booking = await bookingRepository.findBookingById(bookingId);
      if (!booking || booking.memberId !== payload.sub) {
        return NextResponse.json(
          { message: "Unauthorized - not your booking" },
          { status: 403 },
        );
      }
    }

    const result = await paymentService.getReceiptByBookingId(bookingId, {
      userId: payload.sub,
      role: payload.role,
      branchId: payload.branchId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get receipt detail";
    return NextResponse.json({ message }, { status: 400 });
  }
}
