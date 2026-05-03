import type { Metadata } from "next";
import XenditSuccessPage from "@/components/features/booking/XenditSuccessPage";

export const metadata: Metadata = {
  title: "Pembayaran Berhasil | Monarch Barber",
  description: "Halaman konfirmasi pembayaran Xendit untuk booking member.",
};

export default function PembayaranSuksesPage() {
  return <XenditSuccessPage />;
}
