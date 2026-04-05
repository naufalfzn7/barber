import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { superadminService } from "@/server/services/superadminService";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { serviceId } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      price?: number;
      durationMinutes?: number;
      bufferMinutes?: number;
      isActive?: boolean;
    };

    const result = await superadminService.updateService({
      serviceId,
      name: body.name,
      price: body.price,
      durationMinutes: body.durationMinutes,
      bufferMinutes: body.bufferMinutes,
      isActive: body.isActive,
    });

    return NextResponse.json(
      {
        message: "Service updated",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update service";
    return NextResponse.json({ message }, { status: 400 });
  }
}
