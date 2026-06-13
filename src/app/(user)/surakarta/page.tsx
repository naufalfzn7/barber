import LocationPage from "@/components/features/location/LocationPage";
import surakartaData from "@/lib/surakartaData";
import { buildBranchPageData } from "@/lib/branchPageData";
import {
  getBranchBarbermenImages,
  getBranchProducts,
  getBranchServices,
} from "@/server/services/publicMedia";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: surakartaData.metaTitle,
  description: surakartaData.metaDescription,
};

export default async function SurakartaPage() {
  const [barbermen, services, products] = await Promise.all([
    getBranchBarbermenImages("SKA"),
    getBranchServices("SKA"),
    getBranchProducts("SKA"),
  ]);

  const data = buildBranchPageData({
    fallback: surakartaData,
    barbermen,
    services,
    products,
  });

  return <LocationPage data={data} />;
}
