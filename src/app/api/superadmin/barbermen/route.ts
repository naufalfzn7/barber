import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { revalidateSuperadminData } from "@/server/core/revalidate";
import { superadminService } from "@/server/services/superadminService";

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const branchId = request.nextUrl.searchParams.get("branchId") ?? undefined;
    const result = await superadminService.barbermen(branchId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load barbermen";
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
      phoneNumber?: string;
      defaultDuration?: number;
    };

    if (!body.branchId || !body.name) {
      return NextResponse.json(
        { message: "branchId and name are required" },
        { status: 400 },
      );
    }

    const result = await superadminService.createBarberman({
      branchId: body.branchId,
      name: body.name,
      phoneNumber: body.phoneNumber,
      defaultDuration: body.defaultDuration,
    });
    revalidateSuperadminData();

    return NextResponse.json(
      {
        message: "Barberman created",
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create barberman";
    return NextResponse.json({ message }, { status: 400 });
  }
}
