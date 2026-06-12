import { NextResponse, type NextRequest } from "next/server";
import {
  revalidateBookingData,
  revalidateInventoryData,
} from "@/server/core/revalidate";
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
      refundMethod?: "CASH" | "QRIS";
      adminNote?: string | null;
    };

    if (!body.refundMethod) {
      return NextResponse.json(
        { message: "refundMethod is required" },
        { status: 400 },
      );
    }

    const result = await refundService.approve({
      bookingId,
      refundMethod: body.refundMethod,
      adminNote: body.adminNote,
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
        message: "Pengembalian disetujui dan reservasi dibatalkan",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve refund";
    return NextResponse.json({ message }, { status: 400 });
  }
}
