import Image from "next/image";
import { galleryImages } from "@/lib/data/galleryData";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gallery — Monarch Barber",
  description: "Koleksi hasil kerja terbaik dari barber kami di Surakarta dan Yogyakarta.",
};

export default function GalleryPage() {
  return (
    <main className="bg-[#EBEBEB] min-h-screen">
      {/* Hero */}
      <section className="relative w-full min-h-[400px] flex items-center justify-center">
        <Image
          src="/images/surakarta/hero-surakarta.jpg"
          alt="Gallery"
          fill
          className="object-cover brightness-50"
          priority
        />
        <h1 className="relative text-white text-5xl md:text-6xl tracking-[0.15em] font-normal uppercase">
          Gallery
        </h1>
      </section>

      {/* Gallery Grid */}
      <section className="py-20 md:py-24">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {galleryImages.map((item, i) => (
              <div key={i} className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={item.src}
                  alt={item.name}
                  fill
                  className="object-cover pointer-events-none select-none"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

                {/* Badge kiri bawah */}
                <div className="absolute bottom-3 left-3 flex flex-col items-start gap-0.5">
                  <span className="text-white text-sm font-semibold tracking-wide drop-shadow-md leading-tight">
                    {item.name}
                  </span>
                  <span className="text-white/70 text-[11px] tracking-wider uppercase drop-shadow-md">
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}