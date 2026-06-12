import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/server/db/prisma";

export type PublicBarberman = {
  id: string;
  name: string;
  imageUrl: string;
};

export type PublicProduct = {
  id: string;
  name: string;
  sellingPrice: number;
  imageUrl: string;
};

// Active barbermen (with an uploaded photo) for a given branch code, e.g. "SKA".
// Tagged "catalog" so revalidateSuperadminData() refreshes it after edits.
export async function getBranchBarbermenImages(
  branchCode: string,
): Promise<PublicBarberman[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const rows = await prisma.barberman.findMany({
    where: {
      isActive: true,
      imageUrl: { not: null },
      branch: { code: branchCode },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, imageUrl: true },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl as string,
  }));
}

// Active products (with an uploaded image) across all branches.
// Tagged "inventory" so revalidateInventoryData() refreshes it after edits.
export async function getProductImages(): Promise<PublicProduct[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("inventory");

  const rows = await prisma.inventoryItem.findMany({
    where: {
      isActive: true,
      imageUrl: { not: null },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sellingPrice: true, imageUrl: true },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sellingPrice: Number(row.sellingPrice),
    imageUrl: row.imageUrl as string,
  }));
}
