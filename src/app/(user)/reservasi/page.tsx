import type { Metadata } from "next";
import MemberBookingPanel from "@/components/features/booking/MemberBookingPanel";
import MemberReservationDashboard from "@/components/features/booking/MemberReservationDashboard";

export const metadata: Metadata = {
  title: "Reservasi | Monarch Barber",
  description: "Booking member terpusat untuk seluruh cabang Monarch Barber.",
};

export default function ReservasiPage() {
  return (
    <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB]">
      {/* Booking Form Section */}
      <section className="px-6 py-12 md:py-16 border-b border-black/10">
        <div className="max-w-[79.2rem] mx-auto">
          <header className="mb-8 md:mb-10">
            <p className="text-xs tracking-[0.22em] uppercase text-black/50">
              Member Reservation Hub
            </p>
            <h1 className="mt-2 text-3xl md:text-4xl lg:text-5xl uppercase tracking-[0.08em] font-medium text-black">
              Book Your Slot
            </h1>
            <p className="mt-3 text-sm md:text-base text-black/65 max-w-2xl leading-relaxed">
              Form booking member sekarang terpusat di halaman ini. Pilih
              cabang, layanan, dan slot tanpa perlu berpindah ke halaman cabang.
            </p>
          </header>
          <MemberBookingPanel />
        </div>
      </section>

      {/* Reservation Dashboard Section */}
      <MemberReservationDashboard />
    </main>
  );
}
