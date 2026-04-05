import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { bookingService } from "@/server/services/bookingService";

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

  if (!requestedBranchId) {
    return {
      error: NextResponse.json(
        { message: "branchId is required for super admin" },
        { status: 400 },
      ),
    };
  }

  return { branchId: requestedBranchId };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { bookingId } = await context.params;
    const body = (await request.json()) as {
      branchId?: string;
      inventoryItemId?: string;
      quantity?: number;
    };

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    const result = await bookingService.addBookingProduct({
      bookingId,
      branchId: scope.branchId!,
      inventoryItemId: body.inventoryItemId ?? "",
      quantity: body.quantity ?? 0,
      changedById: auth.sub,
    });

    return NextResponse.json(
      {
        message: "Product added to booking",
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add booking product";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { bookingId } = await context.params;
    const body = (await request.json()) as {
      branchId?: string;
      bookingProductId?: string;
    };

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    const result = await bookingService.removeBookingProduct({
      bookingId,
      branchId: scope.branchId!,
      bookingProductId: body.bookingProductId ?? "",
      changedById: auth.sub,
    });

    return NextResponse.json(
      {
        message: "Product removed from booking",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to remove booking product";
    return NextResponse.json({ message }, { status: 400 });
  }
}
