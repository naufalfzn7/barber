import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { paymentService } from "@/server/services/paymentService";

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      bookingId?: string;
      method?: "QRIS" | "CASH";
      amountPaid?: number;
    };

    if (!body.bookingId || !body.method) {
      return NextResponse.json(
        { message: "bookingId and method are required" },
        { status: 400 },
      );
    }

    const result = await paymentService.complete({
      bookingId: body.bookingId,
      method: body.method,
      amountPaid: body.amountPaid,
      actor: {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    });

    return NextResponse.json(
      {
        message:
          body.method === "QRIS"
            ? "QRIS payment initialized"
            : "Cash payment completed",
        result,
      },
      { status: body.method === "QRIS" ? 202 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process payment";
    return NextResponse.json({ message }, { status: 400 });
  }
}
