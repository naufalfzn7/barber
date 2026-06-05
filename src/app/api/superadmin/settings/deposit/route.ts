import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { revalidateBookingData, revalidateSuperadminData } from "@/server/core/revalidate";
import { prisma } from "@/server/db/prisma";

const DEFAULT_DEPOSIT_PERCENTAGE = 25;

function parseDepositPercentage(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.trunc(parsed);
  if (normalized < 0 || normalized > 100) {
    return null;
  }

  return normalized;
}

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
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "DEPOSIT_PERCENTAGE" },
    });

    const depositPercentage =
      parseDepositPercentage(setting?.value) ?? DEFAULT_DEPOSIT_PERCENTAGE;

    return NextResponse.json({ depositPercentage }, { status: 200 });
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

  // Only SUPER_ADMIN can update
  if (payload.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { message: "Forbidden - only superadmin" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const depositPercentage = parseDepositPercentage(body.depositPercentage);

    if (depositPercentage === null) {
      return NextResponse.json(
        { message: "Invalid deposit percentage (must be 0-100)" },
        { status: 400 },
      );
    }

    await prisma.systemSetting.upsert({
      where: { key: "DEPOSIT_PERCENTAGE" },
      update: { value: depositPercentage.toString() },
      create: {
        key: "DEPOSIT_PERCENTAGE",
        value: depositPercentage.toString(),
        description: "Default deposit percentage for member bookings (0-100)",
      },
    });
    revalidateBookingData();
    revalidateSuperadminData();

    return NextResponse.json(
      { depositPercentage, message: "Setting updated" },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update setting";
    return NextResponse.json({ message }, { status: 400 });
  }
}
