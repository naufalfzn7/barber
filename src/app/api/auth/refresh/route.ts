import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  verifyRefreshToken,
} from "@/server/core/auth";
import { authService } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: "Missing refresh token" },
        { status: 401 },
      );
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json(
        { message: "Invalid refresh token" },
        { status: 401 },
      );
    }

    const result = await authService.refresh(payload);
    if (!result) {
      return NextResponse.json(
        { message: "Session not found" },
        { status: 401 },
      );
    }

    const response = NextResponse.json(
      { message: "Token refreshed" },
      { status: 200 },
    );
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return response;
  } catch {
    return NextResponse.json(
      { message: "Failed to refresh token" },
      { status: 500 },
    );
  }
}
