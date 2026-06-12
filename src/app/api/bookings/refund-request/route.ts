import { NextResponse, type NextRequest } from "next/server";
import { revalidateBookingData } from "@/server/core/revalidate";
import { requireRole } from "@/server/policies/requireRole";
import { refundService } from "@/server/services/refundService";

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["MEMBER"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      bookingId?: string;
      reason?: string;
      contactPhone?: string | null;
    };

    if (!body.bookingId || !body.reason) {
      return NextResponse.json(
        { message: "bookingId and reason are required" },
        { status: 400 },
      );
    }

    const result = await refundService.requestByMember({
      bookingId: body.bookingId,
      memberId: auth.sub,
      reason: body.reason,
      contactPhone: body.contactPhone,
    });

    revalidateBookingData();

    return NextResponse.json(
      {
        message: "Pengajuan pengembalian berhasil dikirim",
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to request booking refund";
    return NextResponse.json({ message }, { status: 400 });
  }
}
