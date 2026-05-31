import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { userRepository } from "@/server/repositories/userRepository";

export async function PATCH(request: NextRequest) {
  try {
    const token = getAccessTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      phoneNumber?: string | null;
    };

    // Validate inputs
    if (body.fullName !== undefined && !body.fullName.trim()) {
      return NextResponse.json(
        { message: "Nama lengkap tidak boleh kosong" },
        { status: 400 },
      );
    }

    // Check email uniqueness if being updated
    if (body.email !== undefined) {
      const existing = await userRepository.findByEmail(
        body.email.toLowerCase(),
      );
      if (existing && existing.id !== payload.sub) {
        return NextResponse.json(
          { message: "Email sudah digunakan" },
          { status: 400 },
        );
      }
    }

    const user = await userRepository.updateMember(payload.sub, body);

    return NextResponse.json(
      {
        message: "Profil berhasil diperbarui",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui profil";
    return NextResponse.json({ message }, { status: 500 });
  }
}
