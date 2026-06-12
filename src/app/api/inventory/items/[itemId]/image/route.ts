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

// Product (inventory) images may be managed by ADMIN (own branch) and SUPER_ADMIN.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const auth = requireRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { itemId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const branchIdField = formData.get("branchId");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "file is required" },
        { status: 400 },
      );
    }

    const scope = resolveBranchId(
      auth,
      typeof branchIdField === "string" ? branchIdField : null,
    );
    if (scope.error) {
      return scope.error;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const item = await inventoryService.setItemImage(
      {
        branchId: scope.branchId!,
        itemId,
        file: { buffer, type: file.type, size: file.size },
      },
      { userId: auth.sub, role: auth.role, branchId: auth.branchId },
    );
    revalidateInventoryData();

    return NextResponse.json(
      { message: "Gambar produk diperbarui", item },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload product image";
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

    const result = await inventoryService.removeItemImage(
      { branchId: scope.branchId!, itemId },
      { userId: auth.sub, role: auth.role, branchId: auth.branchId },
    );
    revalidateInventoryData();

    return NextResponse.json(
      { message: "Gambar produk dihapus", result },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove product image";
    return NextResponse.json({ message }, { status: 400 });
  }
}
