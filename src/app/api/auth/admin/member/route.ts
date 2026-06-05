import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { revalidateSuperadminData } from "@/server/core/revalidate";
import { authService } from "@/server/services/authService";

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      branchId?: string;
    };

    if (!body.fullName || !body.email) {
      return NextResponse.json(
        { message: "fullName and email are required" },
        { status: 400 },
      );
    }

    if (
      auth.role === "ADMIN" &&
      auth.branchId &&
      body.branchId &&
      body.branchId !== auth.branchId
    ) {
      return NextResponse.json(
        { message: "Forbidden for other branch" },
        { status: 403 },
      );
    }

    const result = await authService.createMemberByAdmin({
      fullName: body.fullName,
      email: body.email,
      phoneNumber: body.phoneNumber,
      branchId: body.branchId ?? auth.branchId ?? undefined,
    });
    revalidateSuperadminData();

    return NextResponse.json(
      {
        message: "Member created",
        member: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
        },
        temporaryPassword: result.temporaryPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create member";
    return NextResponse.json({ message }, { status: 400 });
  }
}
