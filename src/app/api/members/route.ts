import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { authService } from "@/server/services/authService";

function resolveBranchId(
  auth: { role: "MEMBER" | "ADMIN" | "SUPER_ADMIN"; branchId?: string | null },
  requestedBranchId?: string | null,
): { branchId?: string; error?: NextResponse } {
  if (auth.role === "ADMIN") {
    if (!auth.branchId) {
      return {
        error: NextResponse.json(
          { message: "Admin does not have branch assignment" },
          { status: 400 },
        ),
      };
    }

    if (requestedBranchId && requestedBranchId !== auth.branchId) {
      return {
        error: NextResponse.json(
          { message: "Forbidden for other branch" },
          { status: 403 },
        ),
      };
    }

    return { branchId: auth.branchId };
  }

  return { branchId: requestedBranchId ?? undefined };
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const requestedBranchId = searchParams.get("branchId");
  const scope = resolveBranchId(auth, requestedBranchId);
  if (scope.error) {
    return scope.error;
  }

  const members = await authService.listMembers(scope.branchId);

  return NextResponse.json(
    {
      members: members.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        branchId: member.branchId,
        mustChangePassword: member.mustChangePassword,
        isActive: member.isActive,
        memberProfile: member.memberProfile,
        createdAt: member.createdAt,
      })),
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      branchId?: string;
    };

    if (!body.fullName || !body.email) {
      return NextResponse.json(
        { message: "fullName and email are required" },
        { status: 400 },
      );
    }

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    const result = await authService.createMemberByAdmin({
      fullName: body.fullName,
      email: body.email,
      phoneNumber: body.phoneNumber,
      branchId: scope.branchId,
    });

    return NextResponse.json(
      {
        message: "Member created",
        member: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          branchId: result.user.branchId,
        },
        temporaryPassword: result.temporaryPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create member";
    return NextResponse.json({ message }, { status: 400 });
  }
}
