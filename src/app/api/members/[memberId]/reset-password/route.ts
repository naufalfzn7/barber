import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { revalidateSuperadminData } from "@/server/core/revalidate";
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { memberId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      branchId?: string;
    };

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    const result = await authService.resetPasswordByAdmin(
      memberId,
      scope.branchId,
      auth.sub,
    );
    revalidateSuperadminData();

    return NextResponse.json(
      {
        message: "Password reset successful",
        temporaryPassword: result.temporaryPassword,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ message }, { status: 400 });
  }
}
