/**
 * Seed Cloudinary images for barbermen, services, and products (inventory items)
 * that don't have one yet. Downloads curated stock photos from Unsplash, uploads
 * them to Cloudinary using the same folder conventions as the admin UI, then
 * writes imageUrl + imagePublicId back to the DB.
 *
 * Usage:  node scripts/seed-catalog-images.mjs [--force]
 *   --force  also (re)upload records that already have an image.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// --- Load .env manually into a local map (project has no dotenv dependency) ---
const ENV = {};
{
  const envPath = new URL("../.env", import.meta.url);
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) ENV[m[1]] = m[2];
  }
}

const FORCE = process.argv.includes("--force");

const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
const pg = await import("pg");
const { v2: cloudinary } = await import("cloudinary");

if (!ENV.DATABASE_URL) throw new Error("Missing DATABASE_URL");
if (!ENV.CLOUDINARY_URL) throw new Error("Missing CLOUDINARY_URL");
// Parse cloudinary://<api_key>:<api_secret>@<cloud_name>
{
  const m = ENV.CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error("Invalid CLOUDINARY_URL format");
  cloudinary.config({
    api_key: m[1],
    api_secret: m[2],
    cloud_name: m[3],
    secure: true,
  });
}

const pool = new pg.Pool({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const U = (id) => `https://images.unsplash.com/${id}?w=1024&h=1024&fit=crop&q=80`;

// --- Barbermen: keyed by barberman code ---
const BARBER_IMAGES = {
  "BRB-ANDI": U("photo-1503951914875-452162b0f3f1"),
  "BBR-GGWOL3": U("photo-1500648767791-00dcc994a43e"), // nopal
  "BBR-7AVN2N": U("photo-1507003211169-0a1dd7228f2d"), // Edwing
  "BBR-3ZS9SP": U("photo-1599351431202-1e0f0137899a"), // Tama
};

// --- Services: keyed by service code (shared across branches) ---
const SERVICE_IMAGES = {
  "SRV-SIGNATURE-CUT": U("photo-1622286342621-4bd786c2447c"),
  "SRV-EXECUTIVE-CUT": U("photo-1605497788044-5a32c7078486"),
  "SRV-SKIN-FADE": U("photo-1593702275687-f8b402bf1fb5"),
  "SRV-KIDS-CUT": U("photo-1503454537195-1dcabb73ffb9"),
  "SRV-BEARD-TRIM": U("photo-1621607512214-68297480165e"),
  "SRV-HOT-TOWEL": U("photo-1521590832167-7bcbfaa6381f"),
  "SRV-COLOR-CAMO": U("photo-1622286342621-4bd786c2447c"),
  "SRV-SCALP-TREAT": U("photo-1633681926022-84c23e8cb2d6"),
  "SRV-CREAMBATH": U("photo-1560066984-138dadb4c035"),
  "SRV-GROOM-PACK": U("photo-1622288432450-277d0fef5ed6"),
  "SRV-HAIR-TATTOO": U("photo-1517832606299-7ae9b720a186"),
  "SRV-STYLING": U("photo-1503443207922-dff7d543fd0e"),
};

// --- Products: keyed by SKU base (without branch prefix) ---
const PRODUCT_IMAGES = {
  "PRD-MATTE-CLAY-80": U("photo-1621607512022-6aecc4fed814"),
  "PRD-STRONG-POMADE-100": U("photo-1589710751893-f9a6770ad71b"),
  "PRD-WATER-POMADE-100": U("photo-1599751449128-eb7249c3d6b1"),
  "PRD-SEA-SALT-SPRAY": U("photo-1571781926291-c477ebfd024b"),
  "PRD-HAIR-TONIC-120": U("photo-1608248543803-ba4f8c70ae0b"),
  "PRD-ANTI-DANDRUFF": U("photo-1585232004423-244e0e6904e3"),
  "PRD-DAILY-SHAMPOO": U("photo-1556228720-195a672e8a03"),
  "PRD-CONDITIONER": U("photo-1535585209827-a15fcdbc4c2d"),
  "PRD-BEARD-OIL": U("photo-1556228578-8c89e6adf883"),
  "PRD-BEARD-BALM": U("photo-1621607512022-6aecc4fed814"),
  "PRD-RAZOR-BLADE": U("photo-1621607512022-6aecc4fed814"),
  "PRD-HAIR-POWDER": U("photo-1598440947619-2c35fc9aa908"),
  "PRD-FACE-WASH": U("photo-1556228453-efd6c1ff04f6"),
  "PRD-AFTERSHAVE": U("photo-1608571423902-eed4a5ad8108"),
  "PRD-COMB-SET": U("photo-1559599101-f09722fb4948"),
  "PRD-TRAVEL-KIT": U("photo-1556909211-36987daf7b4d"),
};

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch ${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function uploadToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        overwrite: true,
        transformation: [
          { width: 1024, height: 1024, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (err, up) => (err || !up ? reject(err ?? new Error("upload failed")) : resolve(up)),
    );
    stream.end(buffer);
  });
}

async function seedImages(label, records, getUrl, folderFor) {
  let done = 0;
  let skipped = 0;
  for (const rec of records) {
    if (rec.imageUrl && !FORCE) {
      skipped++;
      continue;
    }
    const url = getUrl(rec);
    if (!url) {
      console.warn(`  ! no image mapped for ${label} ${rec.code ?? rec.sku} (${rec.name})`);
      continue;
    }
    try {
      const buf = await fetchBuffer(url);
      const up = await uploadToCloudinary(buf, folderFor(rec));
      await prisma[rec._model].update({
        where: { id: rec.id },
        data: { imageUrl: up.secure_url, imagePublicId: up.public_id },
      });
      done++;
      console.log(`  ✓ ${label}: ${rec.name}`);
    } catch (e) {
      console.error(`  ✗ ${label}: ${rec.name} -> ${e.message}`);
    }
  }
  console.log(`${label}: uploaded ${done}, skipped ${skipped} (already had image)`);
}

async function main() {
  // Barbermen
  const barbers = (await prisma.barberman.findMany()).map((b) => ({ ...b, _model: "barberman" }));
  await seedImages(
    "Barberman",
    barbers,
    (b) => BARBER_IMAGES[b.code],
    (b) => `monarch/barbermen/${b.branchId}`,
  );

  // Services
  const services = (await prisma.service.findMany()).map((s) => ({ ...s, _model: "service" }));
  await seedImages(
    "Service",
    services,
    (s) => SERVICE_IMAGES[s.code],
    (s) => `monarch/services/${s.branchId}`,
  );

  // Products (inventory items) — strip branch prefix from SKU to look up image
  const products = (await prisma.inventoryItem.findMany()).map((p) => ({ ...p, _model: "inventoryItem" }));
  await seedImages(
    "Product",
    products,
    (p) => PRODUCT_IMAGES[p.sku.replace(/^(SKA|JGJ)-/, "")],
    (p) => `monarch/products/${p.branchId}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    console.log("Done.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
