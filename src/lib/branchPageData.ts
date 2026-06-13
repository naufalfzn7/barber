import type { LocationPageData, PriceTab } from "@/types";
import type {
  PublicBarberman,
  PublicBranchProduct,
  PublicBranchService,
} from "@/server/services/publicMedia";

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `Durasi ${minutes} menit`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `Durasi ${hours} jam`
    : `Durasi ${hours} jam ${rest} menit`;
}

/**
 * Merges live DB data (barbermen, services, products) into the static
 * LocationPageData template. Falls back to the static content per-section
 * when the database has no rows yet, so the page never renders empty.
 */
export function buildBranchPageData(input: {
  fallback: LocationPageData;
  barbermen: PublicBarberman[];
  services: PublicBranchService[];
  products: PublicBranchProduct[];
}): LocationPageData {
  const { fallback, barbermen, services, products } = input;

  const barbers =
    barbermen.length > 0
      ? barbermen.map((barber) => ({
          name: barber.name,
          image: barber.imageUrl,
          bookingUrl: "/reservasi",
        }))
      : fallback.barbers;

  const dynamicTabs: PriceTab[] = [];

  if (services.length > 0) {
    dynamicTabs.push({
      id: "services",
      label: "SERVICES",
      services: services.map((service) => ({
        name: service.name,
        description: formatDuration(service.durationMinutes),
        price: service.price,
        currency: "Rp",
      })),
    });
  }

  if (products.length > 0) {
    dynamicTabs.push({
      id: "products",
      label: "PRODUCTS",
      services: products.map((product) => ({
        name: product.name,
        description: "Tersedia di cabang ini.",
        price: product.sellingPrice,
        currency: "Rp",
      })),
    });
  }

  return {
    ...fallback,
    barbers,
    priceTabs: dynamicTabs.length > 0 ? dynamicTabs : fallback.priceTabs,
  };
}
