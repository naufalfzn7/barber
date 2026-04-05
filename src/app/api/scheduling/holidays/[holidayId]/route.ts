import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { schedulingService } from "@/server/services/schedulingService";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ holidayId: string }> },
) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { holidayId } = await params;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json({ message: "branchId is required" }, { status: 400 });
    }

    const data = await schedulingService.deleteHoliday(holidayId, branchId, {
      userId: auth.sub,
      role: auth.role,
      branchId: auth.branchId,
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete holiday";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
