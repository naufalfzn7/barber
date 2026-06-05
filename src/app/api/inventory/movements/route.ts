import { InventoryMovementType } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/policies/requireRole";
import { revalidateInventoryData } from "@/server/core/revalidate";
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

function parseMovementType(value?: string): InventoryMovementType | null {
  if (!value) {
    return null;
  }

  if (value === "IN" || value === "OUT" || value === "ADJUSTMENT") {
    return value;
  }

  return null;
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
    const movements = await inventoryService.listMovements(
      {
        branchId: scope.branchId!,
        itemId: searchParams.get("itemId") ?? undefined,
        limit: searchParams.get("limit")
          ? Number(searchParams.get("limit"))
          : undefined,
      },
      {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    );

    return NextResponse.json({ movements }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load inventory movements";
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
      itemId?: string;
      type?: string;
      quantity?: number;
      note?: string;
      referenceId?: string;
    };

    const scope = resolveBranchId(auth, body.branchId ?? null);
    if (scope.error) {
      return scope.error;
    }

    if (!body.itemId) {
      return NextResponse.json(
        { message: "itemId is required" },
        { status: 400 },
      );
    }

    const type = parseMovementType(body.type);
    if (!type) {
      return NextResponse.json(
        { message: "type must be IN, OUT, or ADJUSTMENT" },
        { status: 400 },
      );
    }

    const result = await inventoryService.recordMovement(
      {
        branchId: scope.branchId!,
        itemId: body.itemId,
        type,
        quantity: body.quantity ?? 0,
        note: body.note,
        referenceId: body.referenceId,
      },
      {
        userId: auth.sub,
        role: auth.role,
        branchId: auth.branchId,
      },
    );
    revalidateInventoryData();

    return NextResponse.json(
      {
        message: "Inventory movement recorded",
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to record inventory movement";
    return NextResponse.json({ message }, { status: 400 });
  }
}
