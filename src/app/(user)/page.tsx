import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import GlobeWrapper from "@/components/features/globe/Globe";
import { barbershopLocations, globeMarkers } from "@/lib/data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Monarch Barber | Premium Barbershop Surakarta & Yogyakarta",
  description:
    "Reservasi layanan grooming premium di cabang Monarch Barber Surakarta dan Yogyakarta. Pilih jadwal, barberman, dan layanan favorit Anda.",
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("mb_access_token");

  return (
    <main className="bg-[#EBEBEB]">
      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-[#FFFFFF] min-h-[calc(100vh-88px)] flex flex-col justify-center">
        <div className="relative z-10 max-w-[93.5rem] mx-auto px-6 md:px-16 lg:px-24 xl:px-32 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 w-full items-center gap-12 lg:gap-20">
            {/* Teks Kiri */}
            <div className="max-w-xl pr-4 lg:pr-12">
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-[64px] leading-[1.1] font-medium tracking-wide uppercase text-black">
                RESERVASI
                <br />
                GROOMING
                <br />
                PREMIUM
              </h1>
            </div>

            {/* Gambar Kanan */}
            <div className="relative w-full aspect-[4/3] lg:aspect-[5/4] mt-8 lg:mt-0 shadow-sm">
              <Image
                src="/images/home/hero-banner.jpg"
                alt="Monarch Barber Interior"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* BARBERSHOPS SECTION */}
      <section className="py-16 md:py-32 relative">
        <div className="max-w-[93.5rem] mx-auto px-6 md:px-16 lg:px-24 xl:px-32">
          <div className="mb-10 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-widest uppercase">
              BARBERSHOPS
            </h2>
            <p className="mt-3 text-sm text-gray-500 tracking-wide">
              Pilih cabang Monarch terdekat dan amankan jadwal kunjungan Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mt-16 md:mt-24">
            {/* Globe 3D — ✅ now driven by globeMarkers data */}
            <div className="relative w-full aspect-square flex items-center justify-center">
              <div className="absolute inset-0 overflow-hidden bg-transparent">
                <GlobeWrapper locations={globeMarkers} />
              </div>
            </div>

            {/* Locations list dengan Timeline Vertikal */}
            <div className="relative border-l-[3px] border-black pl-8 md:pl-12 space-y-24 pt-0 pb-4 ml-4 lg:ml-0">
              {barbershopLocations.map((loc) => (
                <div key={loc.city} className="relative flex flex-col gap-4">
                  <div className="absolute -left-[42px] md:-left-[58px] top-0 w-5 h-5 bg-black rounded-full border-4 border-[#EBEBEB]" />
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-5">
                    {loc.order}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-light tracking-[0.1em] uppercase text-black leading-none">
                    {loc.city}
                  </h2>
                  <p className="text-sm text-gray-700 leading-relaxed max-w-md font-light mt-2">
                    {loc.description}
                  </p>
                  <div className="mt-4">
                    <Link
                      href={
                        isAuthenticated
                          ? loc.bookingUrl
                          : `/login?next=${encodeURIComponent(loc.bookingUrl)}`
                      }
                      className="inline-block bg-black text-white px-10 py-4 text-[10px] tracking-[0.25em] font-bold uppercase hover:bg-[#333] transition-all"
                    >
                      {isAuthenticated
                        ? "BUAT RESERVASI"
                        : "LOGIN UNTUK RESERVASI"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
