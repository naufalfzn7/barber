import type { Metadata } from "next";
import { Suspense } from "react";
import MemberBookingPanel from "@/components/features/booking/MemberBookingPanel";
import MemberReservationDashboard from "@/components/features/booking/MemberReservationDashboard";

export const metadata: Metadata = {
  title: "Reservasi | Monarch Barber",
  description:
    "Pilih cabang, layanan, barberman, dan jadwal reservasi Monarch Barber. Amankan slot dengan deposit QRIS.",
};

export default function ReservasiPage() {
  return (
    <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB]">
      {/* Booking Form Section */}
      <section className="px-6 py-12 md:py-16 border-b border-black/10">
        <div className="max-w-[79.2rem] mx-auto">
          <header className="mb-8 md:mb-10">
            <p className="text-xs tracking-[0.22em] uppercase text-black/50">
              Reservasi Member
            </p>
            <h1 className="mt-2 text-3xl md:text-4xl lg:text-5xl uppercase tracking-[0.08em] font-medium text-black">
              Pilih Jadwal Barber Anda
            </h1>
            <p className="mt-3 text-sm md:text-base text-black/65 max-w-2xl leading-relaxed">
              Tentukan cabang, layanan, barberman pilihan, dan waktu kunjungan
              dalam satu alur reservasi. Slot akan ditahan sementara setelah
              Anda membuat booking dan dikonfirmasi setelah deposit QRIS
              berhasil dibayar.
            </p>
          </header>
          <Suspense
            fallback={
              <div className="bg-white border border-black/10 p-8 text-sm text-black/60">
                Memuat form reservasi...
              </div>
            }
          >
            <MemberBookingPanel />
          </Suspense>
        </div>
      </section>

      {/* Reservation Dashboard Section */}
      <MemberReservationDashboard />
    </main>
  );
}
