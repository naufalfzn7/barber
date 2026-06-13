import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/server/db/prisma";

export type PublicBarberman = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type PublicProduct = {
  id: string;
  name: string;
  sellingPrice: number;
  imageUrl: string;
};

export type PublicBranchService = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
};

export type PublicBranchProduct = {
  id: string;
  name: string;
  sellingPrice: number;
  imageUrl: string | null;
};

// All active barbermen for a given branch code, e.g. "SKA".
// imageUrl may be null when the barberman has no uploaded photo yet — the UI
// renders an initial-based placeholder in that case.
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
      branch: { code: branchCode },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, imageUrl: true },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
  }));
}

// Active services for a given branch code, e.g. "SKA".
// Tagged "catalog" so revalidateSuperadminData() refreshes it after edits.
export async function getBranchServices(
  branchCode: string,
): Promise<PublicBranchService[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const rows = await prisma.service.findMany({
    where: {
      isActive: true,
      branch: { code: branchCode },
    },
    orderBy: { price: "asc" },
    select: { id: true, name: true, price: true, durationMinutes: true },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    durationMinutes: row.durationMinutes,
  }));
}

// Active products (inventory items) for a given branch code, e.g. "SKA".
// Tagged "inventory" so revalidateInventoryData() refreshes it after edits.
export async function getBranchProducts(
  branchCode: string,
): Promise<PublicBranchProduct[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("inventory");

  const rows = await prisma.inventoryItem.findMany({
    where: {
      isActive: true,
      branch: { code: branchCode },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sellingPrice: true, imageUrl: true },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sellingPrice: Number(row.sellingPrice),
    imageUrl: row.imageUrl,
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
