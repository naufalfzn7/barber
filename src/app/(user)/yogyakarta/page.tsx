import LocationPage from "@/components/features/location/LocationPage";
import yogyakartaData from "@/lib/yogyakartaData";
import { buildBranchPageData } from "@/lib/branchPageData";
import {
  getBranchBarbermenImages,
  getBranchProducts,
  getBranchServices,
} from "@/server/services/publicMedia";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: yogyakartaData.metaTitle,
  description: yogyakartaData.metaDescription,
};

export default async function YogyakartaPage() {
  const [barbermen, services, products] = await Promise.all([
    getBranchBarbermenImages("JGJ"),
    getBranchServices("JGJ"),
    getBranchProducts("JGJ"),
  ]);

  const data = buildBranchPageData({
    fallback: yogyakartaData,
    barbermen,
    services,
    products,
  });

  return <LocationPage data={data} />;
}
