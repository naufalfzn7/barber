import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact | Monarch Barber",
  description: "Hubungi Monarch Barber untuk reservasi dan informasi cabang.",
};

export default function ContactPage() {
  return (
    <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] px-6 py-12 md:py-16">
      <section className="max-w-4xl mx-auto bg-white border border-black/10 p-8 md:p-10">
        <p className="text-xs tracking-[0.2em] uppercase text-black/50">
          Contact
        </p>
        <h1 className="mt-3 text-3xl md:text-4xl uppercase tracking-[0.08em] font-medium text-black">
          Get in Touch
        </h1>
        <p className="mt-4 text-sm md:text-base text-black/65 leading-relaxed max-w-2xl">
          Untuk reservasi, pertanyaan layanan, atau kebutuhan cabang, gunakan
          salah satu jalur di bawah ini. Booking member tetap terpusat di
          halaman reservasi.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 p-5">
            <p className="text-xs tracking-[0.16em] uppercase text-black/45">
              Reservasi
            </p>
            <p className="mt-2 text-sm text-black/70">
              Semua booking member dilakukan melalui halaman reservasi.
            </p>
            <Link
              href="/reservasi"
              className="inline-block mt-4 bg-black text-white px-5 py-2.5 text-xs tracking-[0.2em] uppercase font-semibold"
            >
              Buka Reservasi
            </Link>
          </div>

          <div className="rounded-2xl border border-black/10 p-5">
            <p className="text-xs tracking-[0.16em] uppercase text-black/45">
              Email
            </p>
            <p className="mt-2 text-sm text-black/70">
              hello@monarchbarber.com
            </p>
            <p className="mt-4 text-xs tracking-[0.16em] uppercase text-black/45">
              Phone
            </p>
            <p className="mt-2 text-sm text-black/70">+62 812-3456-7890</p>
          </div>
        </div>
      </section>
    </main>
  );
}
