import LocationPage from "@/components/features/location/LocationPage";
import yogyakartaData from "@/lib/yogyakartaData";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: yogyakartaData.metaTitle,
  description: yogyakartaData.metaDescription,
};

export default function YogyakartaPage() {
  return <LocationPage data={yogyakartaData} />;
}