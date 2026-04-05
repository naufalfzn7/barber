import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { authService } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      oldPassword?: string;
      newPassword?: string;
    };

    if (!body.oldPassword || !body.newPassword) {
      return NextResponse.json(
        { message: "oldPassword dan newPassword wajib diisi" },
        { status: 400 },
      );
    }

    const result = await authService.changePassword({
      userId: payload.sub,
      oldPassword: body.oldPassword,
      newPassword: body.newPassword,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengubah password";
    return NextResponse.json({ message }, { status: 400 });
  }
}
