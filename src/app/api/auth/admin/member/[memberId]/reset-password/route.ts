import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { authService } from "@/server/services/authService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { memberId } = await context.params;
    const result = await authService.resetPasswordByAdmin(
      memberId,
      auth.role === "ADMIN" ? (auth.branchId ?? undefined) : undefined,
    );

    return NextResponse.json(
      {
        message: "Password reset successful",
        temporaryPassword: result.temporaryPassword,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ message }, { status: 400 });
  }
}
