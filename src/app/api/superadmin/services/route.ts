import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { superadminService } from "@/server/services/superadminService";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const branchId = request.nextUrl.searchParams.get("branchId") ?? undefined;
    const result = await superadminService.services(branchId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load services";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      branchId?: string;
      name?: string;
      price?: number;
      durationMinutes?: number;
      bufferMinutes?: number;
    };

    if (
      !body.branchId ||
      !body.name ||
      body.price === undefined ||
      body.durationMinutes === undefined
    ) {
      return NextResponse.json(
        { message: "branchId, name, price, and durationMinutes are required" },
        { status: 400 },
      );
    }

    const result = await superadminService.createService({
      branchId: body.branchId,
      name: body.name,
      price: body.price,
      durationMinutes: body.durationMinutes,
      bufferMinutes: body.bufferMinutes,
    });

    return NextResponse.json(
      {
        message: "Service created",
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create service";
    return NextResponse.json({ message }, { status: 400 });
  }
}
