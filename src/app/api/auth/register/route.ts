import { NextResponse } from "next/server";
import { authService } from "@/server/services/authService";
import { setAuthCookies } from "@/server/core/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      phoneNumber?: string;
    };

    if (
      !body.fullName ||
      !body.email ||
      !body.password ||
      !body.confirmPassword
    ) {
      return NextResponse.json(
        {
          message:
            "Nama lengkap, email, password, dan konfirmasi password harus diisi",
        },
        { status: 400 },
      );
    }

    if (body.password !== body.confirmPassword) {
      return NextResponse.json(
        { message: "Password dan konfirmasi password tidak sesuai" },
        { status: 400 },
      );
    }

    const result = await authService.registerMember({
      fullName: body.fullName,
      email: body.email,
      password: body.password,
      phoneNumber: body.phoneNumber,
    });

    // Auto-login after registration
    const loginResult = await authService.login(body.email, body.password);
    if (!loginResult) {
      return NextResponse.json(
        { message: "Registrasi berhasil, silakan login" },
        { status: 201 },
      );
    }

    const response = NextResponse.json(
      {
        message: "Registrasi berhasil",
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
        },
      },
      { status: 201 },
    );

    setAuthCookies(response, loginResult.accessToken, loginResult.refreshToken);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registrasi gagal";
    return NextResponse.json({ message }, { status: 500 });
  }
}
