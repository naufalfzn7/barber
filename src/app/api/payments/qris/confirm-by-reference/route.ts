import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { paymentRepository } from "@/server/repositories/paymentRepository";
import { revalidateBookingData, revalidateInventoryData } from "@/server/core/revalidate";
import { paymentService } from "@/server/services/paymentService";

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN", "MEMBER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      externalRef?: string;
    };

    if (!body.externalRef?.trim()) {
      return NextResponse.json(
        { message: "externalRef is required" },
        { status: 400 },
      );
    }

    const payment = await paymentRepository.findPaymentByExternalRef(
      body.externalRef,
    );

    if (!payment) {
      return NextResponse.json(
        { message: "Payment reference not found" },
        { status: 404 },
      );
    }

    if (auth.role === "MEMBER") {
      const booking = await paymentRepository.findBookingForPayment(
        payment.bookingId,
      );

      if (!booking || booking.memberId !== auth.sub) {
        return NextResponse.json(
          { message: "Unauthorized - not your booking" },
          { status: 403 },
        );
      }
    }

    const result = await paymentService.confirmQrisByReference({
      externalRef: body.externalRef,
      actor: {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    });
    revalidateBookingData();
    revalidateInventoryData();

    return NextResponse.json(
      {
        message:
          "Pembayaran QRIS terkonfirmasi. Booking otomatis menjadi COMPLETED.",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to confirm QRIS payment by reference";
    return NextResponse.json({ message }, { status: 400 });
  }
}
