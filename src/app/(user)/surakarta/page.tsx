import LocationPage from "@/components/features/location/LocationPage";
import surakartaData from "@/lib/surakartaData";
import { getBranchBarbermenImages } from "@/server/services/publicMedia";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: surakartaData.metaTitle,
  description: surakartaData.metaDescription,
};

export default async function SurakartaPage() {
  const dbBarbers = await getBranchBarbermenImages("SKA");
  const data =
    dbBarbers.length > 0
      ? {
          ...surakartaData,
          barbers: dbBarbers.map((barber) => ({
            name: barber.name,
            image: barber.imageUrl,
            bookingUrl: "/reservasi",
          })),
        }
      : surakartaData;

  return <LocationPage data={data} />;
}
