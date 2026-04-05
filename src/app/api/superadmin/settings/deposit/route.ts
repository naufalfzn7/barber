import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { prisma } from "@/server/db/prisma";

export async function GET(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Only SUPER_ADMIN can access
  if (payload.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { message: "Forbidden - only superadmin" },
      { status: 403 },
    );
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "DEPOSIT_PERCENTAGE" },
    });

    const depositPercentage = setting ? parseInt(setting.value) : 25;

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
    const { depositPercentage } = body;

    if (
      !depositPercentage ||
      depositPercentage < 0 ||
      depositPercentage > 100
    ) {
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
