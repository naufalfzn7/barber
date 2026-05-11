import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { superadminService } from "@/server/services/superadminService";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ barbermanId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { barbermanId } = await context.params;
    const body = (await request.json()) as {
      branchId?: string;
      name?: string;
      phoneNumber?: string | null;
      defaultDuration?: number;
      isActive?: boolean;
    };

    const result = await superadminService.updateBarberman({
      barbermanId,
      branchId: body.branchId,
      name: body.name,
      phoneNumber: body.phoneNumber,
      defaultDuration: body.defaultDuration,
      isActive: body.isActive,
    });

    return NextResponse.json(
      {
        message: "Barberman updated",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update barberman";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ barbermanId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { barbermanId } = await context.params;
    await superadminService.deleteBarberman(barbermanId);

    return NextResponse.json(
      {
        message: "Barberman deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete barberman";
    return NextResponse.json({ message }, { status: 400 });
  }
}
