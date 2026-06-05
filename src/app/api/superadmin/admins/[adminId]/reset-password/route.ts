import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { superadminService } from "@/server/services/superadminService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ adminId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { adminId } = await context.params;
    const result = await superadminService.resetAdminPassword(
      adminId,
      auth.sub,
    );

    return NextResponse.json(
      {
        message: "Admin password reset",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ message }, { status: 400 });
  }
}
