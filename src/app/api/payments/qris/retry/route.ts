import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { paymentService } from "@/server/services/paymentService";
import { paymentRepository } from "@/server/repositories/paymentRepository";

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN", "MEMBER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      paymentId?: string;
    };

    if (!body.paymentId) {
      return NextResponse.json(
        { message: "paymentId is required" },
        { status: 400 },
      );
    }

    // If member, verify they own the booking
    if (auth.role === "MEMBER") {
      const payment = await paymentRepository.findPaymentWithBooking(
        body.paymentId,
      );
      if (!payment || payment.booking.memberId !== auth.sub) {
        return NextResponse.json(
          { message: "Unauthorized - not your payment" },
          { status: 403 },
        );
      }
    }

    const result = await paymentService.retryQris({
      paymentId: body.paymentId,
      actor: {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    });

    return NextResponse.json(
      {
        message: "QRIS payment retried",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retry QRIS payment";
    return NextResponse.json({ message }, { status: 400 });
  }
}
