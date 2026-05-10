import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { superadminService } from "@/server/services/superadminService";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ branchId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { branchId } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      timezone?: string;
      isActive?: boolean;
    };

    const result = await superadminService.updateBranch({
      branchId,
      name: body.name,
      timezone: body.timezone,
      isActive: body.isActive,
    });

    return NextResponse.json(
      {
        message: "Branch updated successfully",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update branch";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ branchId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { branchId } = await context.params;

    await superadminService.deleteBranch(branchId);

    return NextResponse.json(
      {
        message: "Branch deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete branch";
    return NextResponse.json({ message }, { status: 400 });
  }
}
