import LocationPage from "@/components/features/location/LocationPage";
import yogyakartaData from "@/lib/yogyakartaData";
import { getBranchBarbermenImages } from "@/server/services/publicMedia";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: yogyakartaData.metaTitle,
  description: yogyakartaData.metaDescription,
};

export default async function YogyakartaPage() {
  const dbBarbers = await getBranchBarbermenImages("JGJ");
  const data =
    dbBarbers.length > 0
      ? {
          ...yogyakartaData,
          barbers: dbBarbers.map((barber) => ({
            name: barber.name,
            image: barber.imageUrl,
            bookingUrl: "/reservasi",
          })),
        }
      : yogyakartaData;

  return <LocationPage data={data} />;
}
