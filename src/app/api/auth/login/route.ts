import { NextResponse } from "next/server";
import { authService } from "@/server/services/authService";
import { setAuthCookies } from "@/server/core/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 },
      );
    }

    const result = await authService.login(body.email, body.password);
    if (!result) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
          branchId: result.user.branchId,
          mustChangePassword: result.user.mustChangePassword,
        },
      },
      { status: 200 },
    );

    setAuthCookies(response, result.accessToken, result.refreshToken);
    return response;
  } catch {
    return NextResponse.json(
      { message: "Failed to process login" },
      { status: 500 },
    );
  }
}
