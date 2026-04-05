import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us | Monarch Barber",
  description: "Tentang jaringan barbershop Monarch Barber.",
};

export default function AboutUsPage() {
  return (
    <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] px-6 py-12 md:py-16">
      <section className="max-w-4xl mx-auto bg-white border border-black/10 p-8 md:p-10">
        <p className="text-xs tracking-[0.2em] uppercase text-black/50">
          About Us
        </p>
        <h1 className="mt-3 text-3xl md:text-4xl uppercase tracking-[0.08em] font-medium text-black">
          Monarch Barber
        </h1>
        <p className="mt-4 text-sm md:text-base text-black/65 leading-relaxed max-w-2xl">
          Monarch Barber dibangun untuk pengalaman grooming premium yang
          konsisten lintas cabang, dengan booking terpusat, operasional cabang
          yang terkontrol, dan alur pembayaran yang rapi.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-black/10 p-5">
            <p className="text-xs tracking-[0.16em] uppercase text-black/45">
              Cabang
            </p>
            <p className="mt-2 text-sm text-black/70">
              Surakarta dan Yogyakarta
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 p-5">
            <p className="text-xs tracking-[0.16em] uppercase text-black/45">
              Fokus
            </p>
            <p className="mt-2 text-sm text-black/70">
              Premium grooming dan booking operasional
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 p-5">
            <p className="text-xs tracking-[0.16em] uppercase text-black/45">
              Booking
            </p>
            <p className="mt-2 text-sm text-black/70">
              Terkoneksi ke halaman reservasi terpusat
            </p>
          </div>
        </div>

        <div className="mt-8">
          <Link
            href="/reservasi"
            className="inline-block bg-black text-white px-5 py-2.5 text-xs tracking-[0.2em] uppercase font-semibold"
          >
            Book Now
          </Link>
        </div>
      </section>
    </main>
  );
}
