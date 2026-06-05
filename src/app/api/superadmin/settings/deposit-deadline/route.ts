import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { revalidateBookingData, revalidateSuperadminData } from "@/server/core/revalidate";
import { prisma } from "@/server/db/prisma";
import {
  DEPOSIT_PAYMENT_DEADLINE_SETTING_KEY,
  getDepositPaymentDeadlineHours,
  MAX_DEPOSIT_PAYMENT_DEADLINE_HOURS,
  MIN_DEPOSIT_PAYMENT_DEADLINE_HOURS,
  parseDepositPaymentDeadlineHours,
} from "@/server/services/depositSettings";

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
    const depositPaymentDeadlineHours = await getDepositPaymentDeadlineHours();
    return NextResponse.json({ depositPaymentDeadlineHours }, { status: 200 });
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
    const depositPaymentDeadlineHours = parseDepositPaymentDeadlineHours(
      body.depositPaymentDeadlineHours,
    );

    if (depositPaymentDeadlineHours === null) {
      return NextResponse.json(
        {
          message: `Batas waktu pembayaran harus ${MIN_DEPOSIT_PAYMENT_DEADLINE_HOURS}-${MAX_DEPOSIT_PAYMENT_DEADLINE_HOURS} jam`,
        },
        { status: 400 },
      );
    }

    await prisma.systemSetting.upsert({
      where: { key: DEPOSIT_PAYMENT_DEADLINE_SETTING_KEY },
      update: { value: depositPaymentDeadlineHours.toString() },
      create: {
        key: DEPOSIT_PAYMENT_DEADLINE_SETTING_KEY,
        value: depositPaymentDeadlineHours.toString(),
        description:
          "Deposit payment deadline before reservation time, in hours",
      },
    });
    revalidateBookingData();
    revalidateSuperadminData();

    return NextResponse.json(
      { depositPaymentDeadlineHours, message: "Setting updated" },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update setting";
    return NextResponse.json({ message }, { status: 400 });
  }
}
