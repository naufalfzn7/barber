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
    const result = await superadminService.admins(branchId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load admins";
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
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      branchId?: string;
      jobTitle?: string;
    };

    if (!body.fullName || !body.email || !body.branchId) {
      return NextResponse.json(
        { message: "fullName, email, and branchId are required" },
        { status: 400 },
      );
    }

    const result = await superadminService.createAdmin({
      fullName: body.fullName,
      email: body.email,
      phoneNumber: body.phoneNumber,
      branchId: body.branchId,
      jobTitle: body.jobTitle,
      actorId: auth.sub,
    });
    revalidateSuperadminData();

    return NextResponse.json(
      {
        message: "Admin created",
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create admin";
    return NextResponse.json({ message }, { status: 400 });
  }
}
