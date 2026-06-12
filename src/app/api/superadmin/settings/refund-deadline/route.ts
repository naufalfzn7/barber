import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import {
  revalidateBookingData,
  revalidateSuperadminData,
} from "@/server/core/revalidate";
import { prisma } from "@/server/db/prisma";
import {
  getRefundRequestDeadlineHours,
  MAX_REFUND_REQUEST_DEADLINE_HOURS,
  MIN_REFUND_REQUEST_DEADLINE_HOURS,
  parseRefundRequestDeadlineHours,
  REFUND_REQUEST_DEADLINE_SETTING_KEY,
} from "@/server/services/refundSettings";

export async function GET(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!["MEMBER", "ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const refundRequestDeadlineHours = await getRefundRequestDeadlineHours();
    return NextResponse.json({ refundRequestDeadlineHours }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get setting";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (payload.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { message: "Forbidden - only superadmin" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const refundRequestDeadlineHours = parseRefundRequestDeadlineHours(
      body.refundRequestDeadlineHours,
    );

    if (refundRequestDeadlineHours === null) {
      return NextResponse.json(
        {
          message: `Batas pengajuan pengembalian harus ${MIN_REFUND_REQUEST_DEADLINE_HOURS}-${MAX_REFUND_REQUEST_DEADLINE_HOURS} jam`,
        },
        { status: 400 },
      );
    }

    await prisma.systemSetting.upsert({
      where: { key: REFUND_REQUEST_DEADLINE_SETTING_KEY },
      update: { value: refundRequestDeadlineHours.toString() },
      create: {
        key: REFUND_REQUEST_DEADLINE_SETTING_KEY,
        value: refundRequestDeadlineHours.toString(),
        description: "Refund request deadline before reservation time, in hours",
      },
    });
    revalidateBookingData();
    revalidateSuperadminData();

    return NextResponse.json(
      { refundRequestDeadlineHours, message: "Setting updated" },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update setting";
    return NextResponse.json({ message }, { status: 400 });
  }
}
