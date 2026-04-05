"use client";

import Image from "next/image";
import Link from "next/link";
import BarberCard from "@/components/ui/BarberCard";
import PriceList from "@/components/ui/PriceList";
import { LocationPageData } from "@/types";

// ── SectionHeading ────────────────────────────────────────────────────────────
// Masih bisa dipisah ke components/sections/ jika nanti dipakai di halaman lain

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  center?: boolean;
}

function SectionHeading({
  title,
  subtitle,
  center = true,
}: SectionHeadingProps) {
  return (
    <div className={`mb-10 ${center ? "text-center" : ""}`}>
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-widest uppercase">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-sm text-gray-500 tracking-wide">{subtitle}</p>
      )}
    </div>
  );
}

// ── CancellationPolicy ────────────────────────────────────────────────────────

function CancellationPolicy({ image }: { image: string }) {
  return (
    <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden">
        <div className="relative h-100 md:h-125 m-4 md:m-8">
          <Image
            src={image}
            alt="Cancellation Policy"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        <div className="bg-[#EBEBEB] px-8 md:px-12 py-10 md:py-0 flex flex-col justify-center">
          <h2 className="text-2xl md:text-[28px] font-light tracking-widest uppercase mb-8 leading-snug text-black">
            PLEASE READ - 24 HOUR CANCELLATION POLICY.
          </h2>
          <div className="text-sm text-gray-800 leading-loose space-y-4 font-medium">
            <p>
              Kebijakan Pembatalan 24 Jam — Membatalkan janji dalam waktu kurang
              dari 24 jam sebanyak lebih dari dua kali akan mengharuskan
              pembayaran di muka sebelum membuat janji berikutnya.
            </p>
            <p>
              Jika saya tidak hadir (no-show) atau membatalkan dalam waktu
              kurang dari 12 jam sebelum jadwal, saya setuju untuk membayar 50%
              dari biaya layanan sebelum membuat janji berikutnya.
            </p>
            <p>
              Saya akan datang minimal 10 menit lebih awal dari jadwal, dan
              memahami bahwa jika saya terlambat lebih dari 10 menit, pihak
              MONARCH berhak membatalkan janji tersebut serta mengenakan biaya
              sebesar 50%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingCtaPanel() {
  return (
    <div className="max-w-3xl mx-auto bg-white border border-black/10 p-8 md:p-10 text-center">
      <p className="text-xs tracking-[0.2em] uppercase text-black/50">
        Booking Member
      </p>
      <h3 className="mt-3 text-2xl md:text-3xl uppercase tracking-[0.12em] font-medium text-black">
        Booking Dipusatkan di Halaman Reservasi
      </h3>
      <p className="mt-4 text-sm text-black/65 leading-relaxed">
        Untuk pengalaman yang konsisten, form booking dan riwayat booking kini
        tersedia penuh di halaman reservasi terpusat.
      </p>
      <Link
        href="/reservasi"
        className="inline-block mt-6 bg-black text-white px-8 py-3 text-xs tracking-[0.2em] uppercase font-semibold"
      >
        Buka Halaman Reservasi
      </Link>
    </div>
  );
}

// ── LocationPage (main export) ────────────────────────────────────────────────

interface LocationPageProps {
  data: LocationPageData;
}

export default function LocationPage({ data }: LocationPageProps) {
  return (
    <main className="bg-[#EBEBEB] min-h-screen">
      {/* Hero */}
      <section className="relative w-full min-h-100 flex items-center justify-center">
        <Image
          src={data.heroImage}
          alt={`${data.cityName} Barbershop`}
          fill
          className="object-cover brightness-50"
          priority
        />
        <h1 className="relative text-white text-5xl md:text-6xl tracking-[0.15em] font-normal uppercase">
          {data.cityName}
        </h1>
      </section>

      {/* About + Cancellation */}
      <section className="pt-10 md:pt-16 pb-16 md:pb-24">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8 text-center mb-16 md:mb-20">
          <SectionHeading title={data.aboutTitle} />
          <div className="space-y-6 text-sm md:text-base text-gray-800 leading-relaxed font-medium">
            {data.aboutParagraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
        <CancellationPolicy image={data.cancellationImage} />
      </section>

      {/* Team */}
      <section
        className="py-20 md:py-28"
        style={{ backgroundColor: data.teamBgColor }}
      >
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-widest uppercase text-black mb-4">
              OUR {data.cityName} TEAM
            </h2>
            <p className="text-sm text-black font-medium tracking-wide">
              Pilih barber secara langsung atau gunakan formulir booking di
              bawah ini.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {data.barbers.map((barber) => (
              <BarberCard key={barber.name} barber={barber} />
            ))}
          </div>
        </div>
      </section>

      {/* Price List */}
      <section className="py-20 md:py-24">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <SectionHeading
            title="CHECK OUT OUR PRICE LIST!"
            subtitle="All haircuts come with a free drink and hot towel neck shave."
          />
          <PriceList tabs={data.priceTabs} sideImage={data.priceImage} />
        </div>
      </section>

      {/* Booking */}
      <section id="book" className="py-20 md:py-24">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <SectionHeading title="BOOK YOUR SLOT" />
          <BookingCtaPanel />
        </div>
      </section>

      {/* Gallery */}
      <section className="py-20 md:py-24">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {data.galleryImages.map((src, i) => (
              <div key={i} className="relative aspect-4/5 overflow-hidden">
                <Image
                  src={src}
                  alt={`${data.cityName} gallery ${i + 1}`}
                  fill
                  className="object-cover pointer-events-none select-none"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
