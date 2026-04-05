import { InventoryMovementType, Prisma, UserRole } from "@prisma/client";
import { inventoryRepository } from "@/server/repositories/inventoryRepository";

type Actor = {
  userId: string;
  role: UserRole;
  branchId?: string | null;
};

function assertBranchScope(actor: Actor, branchId: string) {
  if (actor.role === "ADMIN" && actor.branchId !== branchId) {
    throw new Error("Forbidden for other branch");
  }
}

function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

export const inventoryService = {
  async listItems(branchId: string, actor: Actor) {
    assertBranchScope(actor, branchId);
    return inventoryRepository.listItems(branchId);
  },

  async createItem(
    input: {
      branchId: string;
      sku: string;
      name: string;
      sellingPrice?: number;
      stockQty?: number;
      minStockQty?: number;
    },
    actor: Actor,
  ) {
    assertBranchScope(actor, input.branchId);

    if (!input.sku || !input.name) {
      throw new Error("sku and name are required");
    }

    const stockQty = Math.max(0, Math.trunc(input.stockQty ?? 0));
    const minStockQty = Math.max(0, Math.trunc(input.minStockQty ?? 0));
    const sellingPrice = Number(input.sellingPrice ?? 0);

    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      throw new Error("sellingPrice must be a valid number >= 0");
    }

    return inventoryRepository.createItem({
      branchId: input.branchId,
      sku: normalizeSku(input.sku),
      name: input.name.trim(),
      sellingPrice: new Prisma.Decimal(sellingPrice.toFixed(2)),
      stockQty,
      minStockQty,
    });
  },

  async updateItem(
    input: {
      branchId: string;
      itemId: string;
      sku?: string;
      name?: string;
      sellingPrice?: number;
      minStockQty?: number;
      isActive?: boolean;
    },
    actor: Actor,
  ) {
    assertBranchScope(actor, input.branchId);

    if (
      input.sellingPrice !== undefined &&
      (!Number.isFinite(input.sellingPrice) || input.sellingPrice < 0)
    ) {
      throw new Error("sellingPrice must be a valid number >= 0");
    }

    const result = await inventoryRepository.updateItem({
      itemId: input.itemId,
      branchId: input.branchId,
      sku: input.sku !== undefined ? normalizeSku(input.sku) : undefined,
      name: input.name !== undefined ? input.name.trim() : undefined,
      sellingPrice:
        input.sellingPrice !== undefined
          ? new Prisma.Decimal(input.sellingPrice.toFixed(2))
          : undefined,
      minStockQty:
        input.minStockQty !== undefined
          ? Math.max(0, Math.trunc(input.minStockQty))
          : undefined,
      isActive: input.isActive,
    });

    if (result.count === 0) {
      throw new Error("Inventory item not found");
    }

    return inventoryRepository.findItemById(input.itemId, input.branchId);
  },

  async deleteItem(input: { branchId: string; itemId: string }, actor: Actor) {
    assertBranchScope(actor, input.branchId);

    const result = await inventoryRepository.softDeleteItem(
      input.itemId,
      input.branchId,
    );

    if (result.count === 0) {
      throw new Error("Inventory item not found");
    }

    return { deleted: true };
  },

  async recordMovement(
    input: {
      branchId: string;
      itemId: string;
      type: InventoryMovementType;
      quantity: number;
      note?: string;
      referenceId?: string;
    },
    actor: Actor,
  ) {
    assertBranchScope(actor, input.branchId);

    const quantity = Math.max(0, Math.trunc(input.quantity));
    if (quantity <= 0) {
      throw new Error("quantity must be greater than 0");
    }

    return inventoryRepository.applyMovement({
      branchId: input.branchId,
      itemId: input.itemId,
      type: input.type,
      quantity,
      note: input.note?.trim(),
      referenceId: input.referenceId?.trim(),
      actedById: actor.userId,
    });
  },

  async listMovements(
    input: { branchId: string; itemId?: string; limit?: number },
    actor: Actor,
  ) {
    assertBranchScope(actor, input.branchId);
    return inventoryRepository.listMovements(input);
  },

  async listLowStockAlerts(branchId: string, actor: Actor) {
    assertBranchScope(actor, branchId);

    const items = (
      await inventoryRepository.listLowStockItems(branchId)
    ).filter((item) => item.stockQty <= item.minStockQty);
    return items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      stockQty: item.stockQty,
      minStockQty: item.minStockQty,
      status: item.stockQty === 0 ? "habis" : "menipis",
    }));
  },
};
