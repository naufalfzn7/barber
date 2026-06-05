import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { superadminService } from "@/server/services/superadminService";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ adminId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { adminId } = await context.params;
    const body = (await request.json()) as { password?: string };

    if (!body.password) {
      return NextResponse.json(
        { message: "password is required" },
        { status: 400 },
      );
    }

    const result = await superadminService.updateAdminGeneratedPassword({
      adminId,
      password: body.password,
      actorId: auth.sub,
    });

    return NextResponse.json(
      {
        message: "Password updated",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update password";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ adminId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { adminId } = await context.params;
    const result = await superadminService.deleteAdminGeneratedPassword(adminId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete password";
    return NextResponse.json({ message }, { status: 400 });
  }
}
