import { InventoryMovementType, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export const inventoryRepository = {
  listItems(branchId: string) {
    return prisma.inventoryItem.findMany({
      where: {
        branchId,
        isActive: true,
      },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
    });
  },

  findItemById(itemId: string, branchId: string) {
    return prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        branchId,
      },
    });
  },

  createItem(input: {
    branchId: string;
    sku: string;
    name: string;
    sellingPrice: Prisma.Decimal;
    stockQty: number;
    minStockQty: number;
  }) {
    return prisma.inventoryItem.create({
      data: {
        branchId: input.branchId,
        sku: input.sku,
        name: input.name,
        sellingPrice: input.sellingPrice,
        stockQty: input.stockQty,
        minStockQty: input.minStockQty,
        isActive: true,
      },
    });
  },

  updateItem(input: {
    itemId: string;
    branchId: string;
    sku?: string;
    name?: string;
    sellingPrice?: Prisma.Decimal;
    minStockQty?: number;
    isActive?: boolean;
  }) {
    return prisma.inventoryItem.updateMany({
      where: {
        id: input.itemId,
        branchId: input.branchId,
      },
      data: {
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sellingPrice !== undefined
          ? { sellingPrice: input.sellingPrice }
          : {}),
        ...(input.minStockQty !== undefined
          ? { minStockQty: input.minStockQty }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  },

  softDeleteItem(itemId: string, branchId: string) {
    return prisma.inventoryItem.updateMany({
      where: { id: itemId, branchId },
      data: { isActive: false },
    });
  },

  updateImage(input: {
    itemId: string;
    branchId: string;
    imageUrl: string | null;
    imagePublicId: string | null;
  }) {
    return prisma.inventoryItem.updateMany({
      where: { id: input.itemId, branchId: input.branchId },
      data: {
        imageUrl: input.imageUrl,
        imagePublicId: input.imagePublicId,
      },
    });
  },

  applyMovement(input: {
    branchId: string;
    itemId: string;
    type: InventoryMovementType;
    quantity: number;
    actedById: string;
    note?: string;
    referenceId?: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const item = await tx.inventoryItem.findFirst({
          where: {
            id: input.itemId,
            branchId: input.branchId,
            isActive: true,
          },
        });

        if (!item) {
          throw new Error("Inventory item not found");
        }

        const beforeQty = item.stockQty;
        let afterQty = beforeQty;

        if (input.type === "IN") {
          afterQty = beforeQty + input.quantity;
        }

        if (input.type === "OUT") {
          if (beforeQty < input.quantity) {
            throw new Error("Insufficient stock for movement");
          }
          afterQty = beforeQty - input.quantity;
        }

        if (input.type === "ADJUSTMENT") {
          afterQty = input.quantity;
        }

        const updatedItem = await tx.inventoryItem.update({
          where: { id: item.id },
          data: { stockQty: afterQty },
        });

        const movementQty =
          input.type === "ADJUSTMENT"
            ? Math.abs(afterQty - beforeQty)
            : input.quantity;

        const movement = await tx.inventoryMovement.create({
          data: {
            branchId: input.branchId,
            inventoryItemId: item.id,
            type: input.type,
            quantity: movementQty,
            beforeQty,
            afterQty,
            note: input.note,
            referenceId: input.referenceId,
            actedById: input.actedById,
          },
        });

        let notification = null;
        if (afterQty <= updatedItem.minStockQty) {
          notification = await tx.notification.create({
            data: {
              branchId: input.branchId,
              userId: null,
              type: "LOW_STOCK",
              title: "Low stock alert",
              message: `${updatedItem.name} tersisa ${afterQty}. Batas minimum ${updatedItem.minStockQty}.`,
              metadata: {
                inventoryItemId: updatedItem.id,
                sku: updatedItem.sku,
                stockQty: afterQty,
                minStockQty: updatedItem.minStockQty,
              } as Prisma.InputJsonValue,
              isRead: false,
            },
          });
        }

        return { updatedItem, movement, notification };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  listMovements(input: { branchId: string; itemId?: string; limit?: number }) {
    return prisma.inventoryMovement.findMany({
      where: {
        branchId: input.branchId,
        ...(input.itemId ? { inventoryItemId: input.itemId } : {}),
      },
      include: {
        inventoryItem: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
        actedBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 100,
    });
  },

  listLowStockItems(branchId: string) {
    return prisma.inventoryItem.findMany({
      where: {
        branchId,
        isActive: true,
      },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
    });
  },
};
