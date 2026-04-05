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

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const scope = resolveBranchId(auth, searchParams.get("branchId"));
  if (scope.error) {
    return scope.error;
  }

  try {
    const items = await inventoryService.listItems(scope.branchId!, {
      userId: auth.sub,
      role: auth.role,
      branchId: auth.branchId,
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load inventory items";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      branchId?: string;
      sku?: string;
      name?: string;
      sellingPrice?: number;
      stockQty?: number;
      minStockQty?: number;
    };

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    const item = await inventoryService.createItem(
      {
        branchId: scope.branchId!,
        sku: body.sku ?? "",
        name: body.name ?? "",
        sellingPrice: body.sellingPrice,
        stockQty: body.stockQty,
        minStockQty: body.minStockQty,
      },
      {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    );

    return NextResponse.json(
      {
        message: "Inventory item created",
        item,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create inventory item";
    return NextResponse.json({ message }, { status: 400 });
  }
}
