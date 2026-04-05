import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { prisma } from "@/server/db/prisma";
import { bookingRepository } from "@/server/repositories/bookingRepository";

export async function POST(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Only MEMBER can confirm booking
  if (payload.role !== "MEMBER") {
    return NextResponse.json(
      { message: "Forbidden - only members" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { message: "bookingId is required" },
        { status: 400 },
      );
    }

    // Get booking
    const booking = await bookingRepository.findBookingById(bookingId);
    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 },
      );
    }

    // Verify member owns booking
    if (booking.memberId !== payload.sub) {
      return NextResponse.json(
        { message: "Unauthorized - not your booking" },
        { status: 403 },
      );
    }

    // Check if booking is in PAYMENT_PENDING status
    if (booking.status !== "PAYMENT_PENDING") {
      return NextResponse.json(
        { message: "Booking is not in payment pending status" },
        { status: 400 },
      );
    }

    // Check if deposit payment exists and is paid
    if (!booking.payment) {
      return NextResponse.json(
        { message: "Payment not found for booking" },
        { status: 400 },
      );
    }

    if (booking.payment.status !== "PAID") {
      return NextResponse.json(
        { message: "Deposit payment must be completed first" },
        { status: 400 },
      );
    }

    // Update booking status to UPCOMING
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "UPCOMING" },
      include: {
        service: { select: { name: true, price: true } },
        barberman: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });

    // Create status history record
    await prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        oldStatus: "PAYMENT_PENDING",
        newStatus: "UPCOMING",
        changedById: payload.sub,
        reason: "Deposit payment confirmed",
      },
    });

    return NextResponse.json(
      {
        message: "Booking confirmed",
        booking: updatedBooking,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm booking";
    return NextResponse.json({ message }, { status: 400 });
  }
}
