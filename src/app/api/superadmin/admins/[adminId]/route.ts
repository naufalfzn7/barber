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
    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      phoneNumber?: string | null;
      branchId?: string | null;
      isActive?: boolean;
      jobTitle?: string | null;
    };

    const result = await superadminService.updateAdmin({
      adminId,
      fullName: body.fullName,
      email: body.email,
      phoneNumber: body.phoneNumber,
      branchId: body.branchId,
      isActive: body.isActive,
      jobTitle: body.jobTitle,
    });

    return NextResponse.json(
      {
        message: "Admin updated",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update admin";
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
    await superadminService.deleteAdmin(adminId);

    return NextResponse.json(
      {
        message: "Admin deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete admin";
    return NextResponse.json({ message }, { status: 400 });
  }
}
