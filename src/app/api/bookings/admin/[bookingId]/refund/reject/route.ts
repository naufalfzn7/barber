import { NextResponse, type NextRequest } from "next/server";
import { revalidateBookingData } from "@/server/core/revalidate";
import { requireRole } from "@/server/policies/requireRole";
import { refundService } from "@/server/services/refundService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { bookingId } = await context.params;
    const body = (await request.json()) as {
      rejectionReason?: string;
    };

    if (!body.rejectionReason) {
      return NextResponse.json(
        { message: "rejectionReason is required" },
        { status: 400 },
      );
    }

    const result = await refundService.reject({
      bookingId,
      rejectionReason: body.rejectionReason,
      actor: {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    });

    revalidateBookingData();

    return NextResponse.json(
      {
        message: "Pengajuan pengembalian ditolak",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reject refund";
    return NextResponse.json({ message }, { status: 400 });
  }
}
