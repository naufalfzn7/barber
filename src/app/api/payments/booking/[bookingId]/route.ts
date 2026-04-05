import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { paymentService } from "@/server/services/paymentService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { bookingId } = await context.params;

    const result = await paymentService.getByBookingId(bookingId, {
      userId: auth.sub,
      role: auth.role,
      branchId: auth.branchId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get payment";
    return NextResponse.json({ message }, { status: 400 });
  }
}
