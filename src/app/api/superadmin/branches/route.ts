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
    const date = request.nextUrl.searchParams.get("date") ?? undefined;
    const result = await superadminService.branches(date);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load branches";
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
      code?: string;
      name?: string;
      timezone?: string;
    };

    if (!body.code || !body.name) {
      return NextResponse.json(
        { message: "code and name are required" },
        { status: 400 },
      );
    }

    const result = await superadminService.createBranch({
      code: body.code,
      name: body.name,
      timezone: body.timezone,
    });
    revalidateSuperadminData();

    return NextResponse.json(
      {
        message: "Branch created successfully",
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create branch";
    return NextResponse.json({ message }, { status: 400 });
  }
}
