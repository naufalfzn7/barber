import type { Metadata } from "next";
import { Suspense } from "react";
import XenditSuccessPage from "@/components/features/booking/XenditSuccessPage";

export const metadata: Metadata = {
  title: "Pembayaran Berhasil | Monarch Barber",
  description: "Halaman konfirmasi pembayaran Xendit untuk booking member.",
};

export default function PembayaranSuksesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] px-6 py-16 flex items-center justify-center">
          <p className="text-sm text-black/60">Memuat konfirmasi pembayaran...</p>
        </main>
      }
    >
      <XenditSuccessPage />
    </Suspense>
  );
}
