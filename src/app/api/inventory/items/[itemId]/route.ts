import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { inventoryService } from "@/server/services/inventoryService";

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { itemId } = await context.params;
    const body = (await request.json()) as {
      branchId?: string;
      sku?: string;
      name?: string;
      sellingPrice?: number;
      minStockQty?: number;
      isActive?: boolean;
    };

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    const item = await inventoryService.updateItem(
      {
        branchId: scope.branchId!,
        itemId,
        sku: body.sku,
        name: body.name,
        sellingPrice: body.sellingPrice,
        minStockQty: body.minStockQty,
        isActive: body.isActive,
      },
      {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    );

    return NextResponse.json(
      {
        message: "Inventory item updated",
        item,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update inventory item";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { itemId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      branchId?: string;
    };

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    const result = await inventoryService.deleteItem(
      {
        branchId: scope.branchId!,
        itemId,
      },
      {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    );

    return NextResponse.json(
      {
        message: "Inventory item deleted",
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete inventory item";
    return NextResponse.json({ message }, { status: 400 });
  }
}
