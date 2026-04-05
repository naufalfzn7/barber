"use client";

import { useEffect, useState } from "react";
import {
  formatIndonesianDateTime,
  formatIndonesianDate,
} from "@/lib/dateFormat";
import { toast } from "sonner";
import DepositPaymentModal from "./DepositPaymentModal";

interface Booking {
  id: string;
  code: string;
  phase: "Upcoming" | "Berlangsung" | "Selesai";
  status: string;
  createdAt: string;
  pendingExpiresAt?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  service: { name: string };
  barberman: { name: string };
  branch: { name: string };
}

function getRemainingLabel(expiresAt?: string | null) {
  if (!expiresAt) {
    return null;
  }

  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "Kadaluarsa";
  }

  const minutes = Math.ceil(remainingMs / (60 * 1000));
  return `${minutes} menit lagi`;
}

interface ReceiptData {
  receipt: {
    booking: {
      id: string;
      code: string;
      status: string;
      scheduledStart: string;
      completedAt: string | null;
      isWalkIn: boolean;
      walkInName: string | null;
      walkInPhone: string | null;
    };
    branch: { id: string; code: string; name: string; timezone: string };
    customer: {
      fullName: string;
      email: string | null;
      phoneNumber: string | null;
    };
    barberman: { id: string; code: string; name: string };
    service: {
      id: string;
      name: string;
      price: number;
    };
    products: Array<{
      id: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    totals: {
      service: number;
      products: number;
      amountDue: number;
    };
    payment: {
      id: string;
      method: string;
      status: string;
      amountDue: number;
      amountPaid: number | null;
      changeAmount: number | null;
      paidAt: string | null;
      externalRef: string | null;
    } | null;
  };
}

type Tab = "onProcess" | "history";

export default function MemberReservationDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("onProcess");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [cancelingBookingId, setCancelingBookingId] = useState<string | null>(
    null,
  );
  const [paymentModalBooking, setPaymentModalBooking] =
    useState<Booking | null>(null);
  const [paymentModalDepositAmount, setPaymentModalDepositAmount] = useState(0);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    try {
      setLoading(true);
      const response = await fetch("/api/bookings/my");
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch {
      toast.error("Gagal memuat reservasi");
    } finally {
      setLoading(false);
    }
  }

  async function openBookingDetail(booking: Booking) {
    setSelectedBooking(booking);
    setReceipt(null);
    setLoadingReceipt(false);
  }

  async function openPaymentModal(booking: Booking) {
    try {
      const response = await fetch(
        `/api/payments/status/${booking.id}?isDeposit=true`,
      );
      const data = (await response.json()) as {
        payment?: { amount?: number | string };
      };

      if (response.ok && data.payment?.amount !== undefined) {
        setPaymentModalDepositAmount(Number(data.payment.amount) || 0);
      } else {
        setPaymentModalDepositAmount(0);
      }
    } catch {
      setPaymentModalDepositAmount(0);
    }

    setPaymentModalBooking(booking);
  }

  async function cancelPendingBooking(booking: Booking) {
    const confirmed = window.confirm(
      `Batalkan reservasi ${booking.code}? Slot akan dilepas untuk pelanggan lain.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setCancelingBookingId(booking.id);
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "Gagal membatalkan booking");
      }

      toast.success("Reservasi berhasil dibatalkan");
      await loadBookings();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membatalkan booking",
      );
    } finally {
      setCancelingBookingId(null);
    }
  }

  async function loadReceipt(bookingId: string) {
    try {
      setLoadingReceipt(true);
      const response = await fetch(`/api/payments/receipt/${bookingId}`);
      const data = await response.json();
      if (response.ok) {
        setReceipt(data);
      } else {
        toast.error(data.message || "Gagal memuat nota");
      }
    } catch {
      toast.error("Gagal memuat nota");
    } finally {
      setLoadingReceipt(false);
    }
  }

  // Get booking data for display
  const onProcessBookings = bookings.filter(
    (b) => b.phase === "Upcoming" || b.phase === "Berlangsung",
  );

  const historyBookings = bookings.filter((b) => b.phase === "Selesai");

  // Apply filters to history
  const filteredHistoryBookings = historyBookings.filter((booking) => {
    if (filterStatus !== "all" && booking.status !== filterStatus) {
      return false;
    }

    if (filterDateFrom) {
      const bookingDate = new Date(booking.scheduledStart);
      const fromDate = new Date(filterDateFrom);
      if (bookingDate < fromDate) return false;
    }

    if (filterDateTo) {
      const bookingDate = new Date(booking.scheduledStart);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (bookingDate > toDate) return false;
    }

    return true;
  });

  const statuses = [...new Set(historyBookings.map((b) => b.status))];

  return (
    <div className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] px-6 py-8 md:py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl tracking-widest uppercase font-semibold text-black">
            Reservasi Saya
          </h1>
          <p className="text-sm text-black/60 mt-2">
            Kelola dan lihat detail reservasi Anda, serta unduh nota digital
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-black/10">
          <button
            onClick={() => setActiveTab("onProcess")}
            className={`px-4 py-3 text-xs tracking-[0.2em] uppercase font-semibold border-b-2 ${
              activeTab === "onProcess"
                ? "border-black text-black"
                : "border-transparent text-black/60 hover:text-black"
            }`}
          >
            On Process ({onProcessBookings.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-3 text-xs tracking-[0.2em] uppercase font-semibold border-b-2 ${
              activeTab === "history"
                ? "border-black text-black"
                : "border-transparent text-black/60 hover:text-black"
            }`}
          >
            History All Time ({historyBookings.length})
          </button>
        </div>

        {loading ? (
          <div className="bg-white border border-black/10 p-12 text-center">
            <p className="text-black/60">Memuat reservasi...</p>
          </div>
        ) : activeTab === "onProcess" ? (
          // On Process Section
          <div className="space-y-4">
            {onProcessBookings.length === 0 ? (
              <div className="bg-white border border-black/10 p-12 text-center">
                <p className="text-black/60">
                  Tidak ada reservasi yang sedang berjalan
                </p>
              </div>
            ) : (
              onProcessBookings.map((booking) => {
                const remainingLabel = getRemainingLabel(
                  booking.pendingExpiresAt,
                );

                return (
                  <div
                    key={booking.id}
                    className="bg-white border border-black/10 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs tracking-[0.2em] uppercase text-black/50 font-semibold">
                          {booking.code}
                        </p>
                        <h3 className="text-lg font-semibold text-black mt-1">
                          {booking.service.name}
                        </h3>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
                          booking.phase === "Berlangsung"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {booking.phase}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-black/60 text-xs">Tanggal & Jam</p>
                        <p className="font-semibold text-black mt-1">
                          {formatIndonesianDateTime(booking.scheduledStart)}
                        </p>
                      </div>
                      <div>
                        <p className="text-black/60 text-xs">Barber</p>
                        <p className="font-semibold text-black mt-1">
                          {booking.barberman.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-black/60 text-xs">Cabang</p>
                        <p className="font-semibold text-black mt-1">
                          {booking.branch.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-black/60 text-xs">Status</p>
                        <p className="font-semibold text-black mt-1">
                          {booking.status}
                        </p>
                        {booking.status === "PAYMENT_PENDING" &&
                          remainingLabel && (
                            <p className="text-xs text-red-600 mt-1 font-semibold">
                              Batas bayar: {remainingLabel}
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          booking.status === "PAYMENT_PENDING"
                            ? openPaymentModal(booking)
                            : openBookingDetail(booking)
                        }
                        className={`px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold text-white transition-colors ${
                          booking.status === "PAYMENT_PENDING"
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-black hover:bg-black/80"
                        }`}
                      >
                        {booking.status === "PAYMENT_PENDING"
                          ? "Bayar"
                          : "Lihat Detail"}
                      </button>

                      {booking.status === "PAYMENT_PENDING" && (
                        <button
                          onClick={() => void cancelPendingBooking(booking)}
                          disabled={cancelingBookingId === booking.id}
                          className="px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-60 transition-colors"
                        >
                          {cancelingBookingId === booking.id
                            ? "Membatalkan..."
                            : "Batalkan"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // History Section with Filters
          <div>
            {/* Filters */}
            <div className="bg-white border border-black/10 p-6 mb-6">
              <p className="text-xs tracking-[0.2em] uppercase text-black/50 font-semibold mb-4">
                Filter Riwayat
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-black/70">
                    Status
                  </span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="mt-1 w-full border border-black/20 px-3 py-2 text-sm bg-white"
                  >
                    <option value="all">Semua Status</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-black/70">
                    Dari Tanggal
                  </span>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-black/70">
                    Sampai Tanggal
                  </span>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {(filterStatus !== "all" || filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => {
                    setFilterStatus("all");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                  }}
                  className="mt-4 px-4 py-2 text-xs tracking-[0.2em] uppercase font-semibold text-black/70 hover:text-black"
                >
                  Reset Filter
                </button>
              )}
            </div>

            {/* History List */}
            <div className="space-y-4">
              {filteredHistoryBookings.length === 0 ? (
                <div className="bg-white border border-black/10 p-12 text-center">
                  <p className="text-black/60">Tidak ada riwayat transaksi</p>
                </div>
              ) : (
                filteredHistoryBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white border border-black/10 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs tracking-[0.2em] uppercase text-black/50 font-semibold">
                          {booking.code}
                        </p>
                        <h3 className="text-lg font-semibold text-black mt-1">
                          {booking.service.name}
                        </h3>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
                          booking.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : booking.status === "CANCELED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-black/60 text-xs">Tanggal & Jam</p>
                        <p className="font-semibold text-black mt-1">
                          {formatIndonesianDateTime(booking.scheduledStart)}
                        </p>
                      </div>
                      <div>
                        <p className="text-black/60 text-xs">Barber</p>
                        <p className="font-semibold text-black mt-1">
                          {booking.barberman.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-black/60 text-xs">Cabang</p>
                        <p className="font-semibold text-black mt-1">
                          {booking.branch.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-black/60 text-xs">Status</p>
                        <p className="font-semibold text-black mt-1">
                          {booking.status}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => openBookingDetail(booking)}
                      className="px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold text-white bg-black hover:bg-black/80 transition-colors"
                    >
                      Lihat Detail & Nota
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {receipt ? (
              // Receipt View
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-black">
                  Nota Reservasi
                </h2>

                <div className="border-b pb-4">
                  <p className="text-xs text-black/60 uppercase tracking-widest font-semibold">
                    {receipt.receipt.booking.code}
                  </p>
                  <p className="text-sm text-black/70 mt-2">
                    Tanggal:{" "}
                    {formatIndonesianDate(
                      receipt.receipt.booking.scheduledStart,
                    )}
                  </p>
                </div>

                {/* Customer Info */}
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70 mb-3">
                    Informasi Pelanggan
                  </h3>
                  <div className="text-sm space-y-1">
                    <p className="text-black">
                      {receipt.receipt.customer.fullName}
                    </p>
                    {receipt.receipt.customer.email && (
                      <p className="text-black/60">
                        {receipt.receipt.customer.email}
                      </p>
                    )}
                    {receipt.receipt.customer.phoneNumber && (
                      <p className="text-black/60">
                        {receipt.receipt.customer.phoneNumber}
                      </p>
                    )}
                  </div>
                </div>

                {/* Service & Barberman */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70 mb-2">
                      Layanan
                    </h3>
                    <p className="text-sm font-semibold text-black">
                      {receipt.receipt.service.name}
                    </p>
                    <p className="text-sm text-black/60 mt-1">
                      Rp {receipt.receipt.service.price.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70 mb-2">
                      Barber
                    </h3>
                    <p className="text-sm font-semibold text-black">
                      {receipt.receipt.barberman.name}
                    </p>
                  </div>
                </div>

                {/* Products */}
                {receipt.receipt.products.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70 mb-3">
                      Produk
                    </h3>
                    <div className="space-y-2">
                      {receipt.receipt.products.map((product) => (
                        <div
                          key={product.id}
                          className="flex justify-between text-sm border-b pb-2"
                        >
                          <div>
                            <p className="text-black">{product.itemName}</p>
                            <p className="text-black/60 text-xs">
                              {product.quantity}x @ Rp{" "}
                              {product.unitPrice.toLocaleString("id-ID")}
                            </p>
                          </div>
                          <p className="text-black font-semibold">
                            Rp {product.subtotal.toLocaleString("id-ID")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <p className="text-black/70">Layanan:</p>
                    <p className="text-black font-semibold">
                      Rp{" "}
                      {receipt.receipt.totals.service.toLocaleString("id-ID")}
                    </p>
                  </div>
                  {receipt.receipt.totals.products > 0 && (
                    <div className="flex justify-between text-sm">
                      <p className="text-black/70">Produk:</p>
                      <p className="text-black font-semibold">
                        Rp{" "}
                        {receipt.receipt.totals.products.toLocaleString(
                          "id-ID",
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <p className="text-black">Total:</p>
                    <p className="text-black">
                      Rp{" "}
                      {receipt.receipt.totals.amountDue.toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>

                {/* Payment Info */}
                {receipt.receipt.payment && (
                  <div className="bg-black/5 p-4 rounded">
                    <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70 mb-2">
                      Informasi Pembayaran
                    </h3>
                    <div className="text-sm space-y-1">
                      <p className="text-black">
                        Metode: {receipt.receipt.payment.method}
                      </p>
                      <p className="text-black">
                        Status: {receipt.receipt.payment.status}
                      </p>
                      {receipt.receipt.payment.paidAt && (
                        <p className="text-black/60 text-xs">
                          Dibayar:{" "}
                          {formatIndonesianDateTime(
                            receipt.receipt.payment.paidAt,
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="flex-1 bg-black text-white py-2 text-xs tracking-[0.2em] uppercase font-bold hover:bg-black/80"
                  >
                    Cetak Nota
                  </button>
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="flex-1 border border-black/20 bg-white text-black py-2 text-xs tracking-[0.2em] uppercase font-bold hover:bg-black/5"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              // Detail View with Load Receipt Button
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-black">
                  Detail Reservasi
                </h2>

                <div className="border-b pb-4">
                  <p className="text-xs text-black/60 uppercase tracking-widest font-semibold">
                    {selectedBooking.code}
                  </p>
                  <h3 className="text-xl font-semibold text-black mt-2">
                    {selectedBooking.service.name}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70">
                      Tanggal & Jam
                    </p>
                    <p className="text-sm font-semibold text-black mt-2">
                      {formatIndonesianDateTime(selectedBooking.scheduledStart)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70">
                      Status
                    </p>
                    <p className="text-sm font-semibold text-black mt-2">
                      {selectedBooking.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70">
                      Barber
                    </p>
                    <p className="text-sm font-semibold text-black mt-2">
                      {selectedBooking.barberman.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] font-semibold text-black/70">
                      Cabang
                    </p>
                    <p className="text-sm font-semibold text-black mt-2">
                      {selectedBooking.branch.name}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  {selectedBooking.status === "PAYMENT_PENDING" ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedBooking(null);
                          void openPaymentModal(selectedBooking);
                        }}
                        className="flex-1 bg-red-600 text-white py-2 text-xs tracking-[0.2em] uppercase font-bold hover:bg-red-700"
                      >
                        Bayar
                      </button>
                      <button
                        onClick={() =>
                          void cancelPendingBooking(selectedBooking)
                        }
                        disabled={cancelingBookingId === selectedBooking.id}
                        className="flex-1 border border-red-300 bg-white text-red-700 py-2 text-xs tracking-[0.2em] uppercase font-bold hover:bg-red-50 disabled:opacity-60"
                      >
                        {cancelingBookingId === selectedBooking.id
                          ? "Membatalkan..."
                          : "Batalkan"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => loadReceipt(selectedBooking.id)}
                      disabled={loadingReceipt}
                      className="flex-1 bg-black text-white py-2 text-xs tracking-[0.2em] uppercase font-bold hover:bg-black/80 disabled:opacity-50"
                    >
                      {loadingReceipt ? "Memuat..." : "Lihat Nota Digital"}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="flex-1 border border-black/20 bg-white text-black py-2 text-xs tracking-[0.2em] uppercase font-bold hover:bg-black/5"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {paymentModalBooking && (
        <DepositPaymentModal
          isOpen={Boolean(paymentModalBooking)}
          bookingId={paymentModalBooking.id}
          bookingCode={paymentModalBooking.code}
          depositAmount={paymentModalDepositAmount}
          remainingAmount={0}
          onClose={() => setPaymentModalBooking(null)}
          onSuccess={() => {
            setPaymentModalBooking(null);
            void loadBookings();
          }}
          onRefresh={() => {
            void loadBookings();
          }}
        />
      )}
    </div>
  );
}
