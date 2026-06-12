import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL in environment.");
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const services = [
  {
    code: "SRV-SIGNATURE-CUT",
    name: "Signature Cut",
    price: 65000,
    durationMinutes: 45,
    bufferMinutes: 10,
  },
  {
    code: "SRV-EXECUTIVE-CUT",
    name: "Executive Cut & Wash",
    price: 85000,
    durationMinutes: 60,
    bufferMinutes: 10,
  },
  {
    code: "SRV-SKIN-FADE",
    name: "Skin Fade Detail",
    price: 90000,
    durationMinutes: 60,
    bufferMinutes: 15,
  },
  {
    code: "SRV-KIDS-CUT",
    name: "Kids Cut",
    price: 50000,
    durationMinutes: 40,
    bufferMinutes: 10,
  },
  {
    code: "SRV-BEARD-TRIM",
    name: "Beard Trim & Shape",
    price: 45000,
    durationMinutes: 30,
    bufferMinutes: 10,
  },
  {
    code: "SRV-HOT-TOWEL",
    name: "Hot Towel Shave",
    price: 55000,
    durationMinutes: 35,
    bufferMinutes: 10,
  },
  {
    code: "SRV-COLOR-CAMO",
    name: "Color Camo",
    price: 150000,
    durationMinutes: 90,
    bufferMinutes: 15,
  },
  {
    code: "SRV-SCALP-TREAT",
    name: "Scalp Refresh Treatment",
    price: 120000,
    durationMinutes: 60,
    bufferMinutes: 15,
  },
  {
    code: "SRV-CREAMBATH",
    name: "Premium Creambath",
    price: 95000,
    durationMinutes: 60,
    bufferMinutes: 10,
  },
  {
    code: "SRV-GROOM-PACK",
    name: "Complete Grooming Package",
    price: 180000,
    durationMinutes: 100,
    bufferMinutes: 20,
  },
  {
    code: "SRV-HAIR-TATTOO",
    name: "Hair Tattoo Line Art",
    price: 75000,
    durationMinutes: 50,
    bufferMinutes: 15,
  },
  {
    code: "SRV-STYLING",
    name: "Wash & Event Styling",
    price: 70000,
    durationMinutes: 45,
    bufferMinutes: 10,
  },
];

const products = [
  ["PRD-MATTE-CLAY-80", "Monarch Matte Clay 80gr", 85000, 34, 8],
  ["PRD-STRONG-POMADE-100", "Monarch Strong Pomade 100gr", 95000, 28, 8],
  ["PRD-WATER-POMADE-100", "Water Based Pomade 100gr", 88000, 31, 8],
  ["PRD-SEA-SALT-SPRAY", "Sea Salt Styling Spray", 78000, 24, 6],
  ["PRD-HAIR-TONIC-120", "Cooling Hair Tonic 120ml", 65000, 36, 10],
  ["PRD-ANTI-DANDRUFF", "Anti Dandruff Shampoo", 72000, 22, 6],
  ["PRD-DAILY-SHAMPOO", "Daily Clean Shampoo", 68000, 30, 8],
  ["PRD-CONDITIONER", "Soft Finish Conditioner", 70000, 26, 6],
  ["PRD-BEARD-OIL", "Cedar Beard Oil", 90000, 20, 5],
  ["PRD-BEARD-BALM", "Beard Balm Hold", 87000, 18, 5],
  ["PRD-RAZOR-BLADE", "Premium Razor Blade Pack", 45000, 40, 10],
  ["PRD-HAIR-POWDER", "Volume Hair Powder", 76000, 27, 6],
  ["PRD-FACE-WASH", "Men Face Wash", 62000, 25, 6],
  ["PRD-AFTERSHAVE", "Aftershave Cooling Splash", 82000, 21, 5],
  ["PRD-COMB-SET", "Carbon Comb Set", 55000, 33, 8],
  ["PRD-TRAVEL-KIT", "Monarch Travel Grooming Kit", 135000, 15, 4],
];

function priceForBranch(basePrice, branchCode) {
  return branchCode === "JGJ" ? Math.max(basePrice - 5000, 30000) : basePrice;
}

function stockForBranch(baseStock, branchCode) {
  return branchCode === "JGJ" ? baseStock + 5 : baseStock;
}

async function main() {
  const branches = await prisma.branch.findMany({
    where: { code: { in: ["SKA", "JGJ"] } },
    orderBy: { code: "asc" },
  });

  if (branches.length < 2) {
    throw new Error("Expected both SKA and JGJ branches to exist.");
  }

  await prisma.$transaction(async (tx) => {
    for (const branch of branches) {
      const replacementService = await tx.service.upsert({
        where: {
          branchId_code: {
            branchId: branch.id,
            code: "SRV-SIGNATURE-CUT",
          },
        },
        update: {
          name: "Signature Cut",
          price: priceForBranch(65000, branch.code),
          durationMinutes: 45,
          bufferMinutes: 10,
          isActive: true,
        },
        create: {
          branchId: branch.id,
          code: "SRV-SIGNATURE-CUT",
          name: "Signature Cut",
          price: priceForBranch(65000, branch.code),
          durationMinutes: 45,
          bufferMinutes: 10,
          isActive: true,
        },
      });

      await tx.booking.updateMany({
        where: {
          branchId: branch.id,
          service: {
            code: { notIn: services.map((service) => service.code) },
          },
        },
        data: { serviceId: replacementService.id },
      });

      const oldItems = await tx.inventoryItem.findMany({
        where: {
          branchId: branch.id,
          sku: { notIn: products.map(([sku]) => `${branch.code}-${sku}`) },
        },
        select: { id: true },
      });
      const oldItemIds = oldItems.map((item) => item.id);

      if (oldItemIds.length > 0) {
        await tx.bookingProduct.deleteMany({
          where: { inventoryItemId: { in: oldItemIds } },
        });
        await tx.inventoryMovement.deleteMany({
          where: { inventoryItemId: { in: oldItemIds } },
        });
        await tx.inventoryItem.deleteMany({
          where: { id: { in: oldItemIds } },
        });
      }

      await tx.service.deleteMany({
        where: {
          branchId: branch.id,
          code: { notIn: services.map((service) => service.code) },
          bookings: { none: {} },
        },
      });

      for (const service of services) {
        await tx.service.upsert({
          where: {
            branchId_code: {
              branchId: branch.id,
              code: service.code,
            },
          },
          update: {
            name: service.name,
            price: priceForBranch(service.price, branch.code),
            durationMinutes: service.durationMinutes,
            bufferMinutes: service.bufferMinutes,
            isActive: true,
          },
          create: {
            branchId: branch.id,
            code: service.code,
            name: service.name,
            price: priceForBranch(service.price, branch.code),
            durationMinutes: service.durationMinutes,
            bufferMinutes: service.bufferMinutes,
            isActive: true,
          },
        });
      }

      for (const [sku, name, price, stockQty, minStockQty] of products) {
        await tx.inventoryItem.upsert({
          where: {
            branchId_sku: {
              branchId: branch.id,
              sku: `${branch.code}-${sku}`,
            },
          },
          update: {
            name,
            sellingPrice: priceForBranch(price, branch.code),
            stockQty: stockForBranch(stockQty, branch.code),
            minStockQty,
            isActive: true,
          },
          create: {
            branchId: branch.id,
            sku: `${branch.code}-${sku}`,
            name,
            sellingPrice: priceForBranch(price, branch.code),
            stockQty: stockForBranch(stockQty, branch.code),
            minStockQty,
            isActive: true,
          },
        });
      }
    }
  });

  const result = await prisma.branch.findMany({
    where: { code: { in: ["SKA", "JGJ"] } },
    select: {
      code: true,
      name: true,
      _count: { select: { services: true, inventoryItems: true } },
    },
    orderBy: { code: "asc" },
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
