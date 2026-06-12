"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatIndonesianDateTime,
  formatIndonesianDate,
} from "@/lib/dateFormat";
import DepositPaymentModal from "./DepositPaymentModal";
import { authFetch, notifyClientDataChanged } from "@/lib/authClient";
import {
  confirmAction,
  useToastFeedback,
} from "@/components/ui/useToastFeedback";

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
  queue?: {
    number: number;
    label: string | null;
    status: string | null;
    assignedAt: string | null;
    calledAt: string | null;
  } | null;
  payment?: { status: string; isDeposit: boolean } | null;
  refund?: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    amount: number;
    reason: string;
    contactPhone: string | null;
    refundMethod: "CASH" | "QRIS" | null;
    requestedAt: string;
    reviewedAt: string | null;
    adminNote: string | null;
    rejectionReason: string | null;
  } | null;
  refundEligibility?: {
    canRequest: boolean;
    deadlineHours: number;
    deadline: string;
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExpiryDateTime(isoString: string) {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date);
  } catch {
    return "";
  }
}

function getRemainingLabel(expiresAt?: string | null) {
  if (!expiresAt) {
    return null;
  }

  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "Kadaluarsa";
  }

  return `Bayar sebelum: ${formatExpiryDateTime(expiresAt)}`;
}

function getPaymentLabel(
  expiresAt?: string | null,
  paymentStatus?: string | null,
) {
  const normalizedStatus = paymentStatus?.toUpperCase() ?? "";

  if (normalizedStatus === "EXPIRED") {
    return "Kadaluarsa";
  }

  if (normalizedStatus === "FAILED") {
    return "Pembayaran gagal";
  }

  if (normalizedStatus === "PAID") {
    return "Lunas";
  }

  return getRemainingLabel(expiresAt);
}

function refundStatusLabel(status: Booking["refund"] extends infer Refund
  ? Refund extends { status: infer Status }
    ? Status
    : string
  : string) {
  const map: Record<string, string> = {
    PENDING: "Pengembalian diajukan",
    APPROVED: "Pengembalian disetujui",
    REJECTED: "Pengembalian ditolak",
  };

  return map[String(status)] ?? "Pengembalian";
}

function refundStatusTone(status: string) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return map[status] ?? "bg-gray-100 text-gray-700";
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
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  const [refundModalBooking, setRefundModalBooking] =
    useState<Booking | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundContactPhone, setRefundContactPhone] = useState("");
  const [submittingRefund, setSubmittingRefund] = useState(false);

  useToastFeedback({
    message,
    error: errorMessage,
    onMessageShown: () => setMessage(null),
    onErrorShown: () => setErrorMessage(null),
  });

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch("/api/bookings/my");
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch {
      setErrorMessage("Gagal memuat reservasi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    const handler = () => {
      void loadBookings();
    };

    window.addEventListener("bookings:changed", handler);
    return () => window.removeEventListener("bookings:changed", handler);
  }, [loadBookings]);

  async function openBookingDetail(booking: Booking) {
    setSelectedBooking(booking);
    setReceipt(null);
    setLoadingReceipt(false);
  }

  async function openPaymentModal(booking: Booking) {
    try {
      const response = await authFetch(
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
    const confirmed = await confirmAction({
      title: "Batalkan reservasi?",
      text: `Reservasi ${booking.code} akan dibatalkan dan slot dilepas untuk pelanggan lain.`,
      confirmButtonText: "Ya, batalkan",
      icon: "warning",
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      setCancelingBookingId(booking.id);
      const response = await authFetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "Gagal membatalkan booking");
      }

      setMessage("Reservasi berhasil dibatalkan");
      // Optimistically remove from local state so UI updates immediately
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      // Notify other components to refresh their data
      notifyClientDataChanged("bookings:changed");
      // Re-fetch canonical data from the server
      await loadBookings();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal membatalkan booking",
      );
    } finally {
      setCancelingBookingId(null);
    }
  }

  function openRefundModal(booking: Booking) {
    setRefundModalBooking(booking);
    setRefundReason("");
    setRefundContactPhone(booking.refund?.contactPhone ?? "");
  }

  async function submitRefundRequest() {
    if (!refundModalBooking) {
      return;
    }

    if (!refundReason.trim()) {
      setErrorMessage("Alasan pengembalian wajib diisi");
      return;
    }

    try {
      setSubmittingRefund(true);
      setErrorMessage(null);
      setMessage(null);

      const response = await authFetch("/api/bookings/refund-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: refundModalBooking.id,
          reason: refundReason,
          contactPhone: refundContactPhone || undefined,
        }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengajukan pengembalian");
      }

      setMessage(data.message ?? "Pengajuan pengembalian berhasil dikirim");
      setRefundModalBooking(null);
      notifyClientDataChanged("bookings:changed");
      await loadBookings();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal mengajukan pengembalian",
      );
    } finally {
      setSubmittingRefund(false);
    }
  }

  async function loadReceipt(bookingId: string) {
    try {
      setLoadingReceipt(true);
      const response = await authFetch(`/api/payments/receipt/${bookingId}`);
      const data = await response.json();
      if (response.ok) {
        setReceipt(data);
      } else {
        setErrorMessage(data.message || "Gagal memuat nota");
      }
    } catch {
      setErrorMessage("Gagal memuat nota");
    } finally {
      setLoadingReceipt(false);
    }
  }

  function printQueueTicket(booking: Booking) {
    if (!booking.queue?.label) {
      return;
    }

    const html = `
      <html>
        <head><title>Tiket Antrian ${escapeHtml(booking.queue.label)}</title></head>
        <body style="font-family:Arial, sans-serif; padding:24px; color:#111;">
          <div style="max-width:420px; margin:0 auto; border:2px solid #111; padding:24px; text-align:center;">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:3px; text-transform:uppercase;">Nomor Antrian</p>
            <h1 style="margin:0; font-size:72px; line-height:1;">${escapeHtml(booking.queue.label)}</h1>
            <p style="margin:16px 0 0; font-size:16px; font-weight:bold;">${escapeHtml(booking.branch.name)}</p>
            <p style="margin:8px 0; font-size:13px;">${formatIndonesianDateTime(booking.scheduledStart)}</p>
            <hr style="margin:18px 0;" />
            <p style="margin:4px 0; font-size:13px;"><strong>Booking:</strong> ${escapeHtml(booking.code)}</p>
            <p style="margin:4px 0; font-size:13px;"><strong>Layanan:</strong> ${escapeHtml(booking.service.name)}</p>
            <p style="margin:4px 0; font-size:13px;"><strong>Barber:</strong> ${escapeHtml(booking.barberman.name)}</p>
            <p style="margin:18px 0 0; font-size:12px; color:#555;">Tunjukkan tiket ini saat datang ke barber.</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=480,height=700");
    if (!printWindow) {
      setErrorMessage("Popup blocker aktif. Izinkan popup untuk cetak tiket.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
            Pantau status booking, lanjutkan pembayaran deposit, batalkan
            reservasi yang belum dibayar, dan unduh nota setelah transaksi
            selesai.
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
            Sedang Berjalan ({onProcessBookings.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-3 text-xs tracking-[0.2em] uppercase font-semibold border-b-2 ${
              activeTab === "history"
                ? "border-black text-black"
                : "border-transparent text-black/60 hover:text-black"
            }`}
          >
            Riwayat Reservasi ({historyBookings.length})
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
                  Belum ada reservasi aktif. Pilih jadwal di form reservasi
                  untuk mengamankan slot kunjungan Anda.
                </p>
              </div>
            ) : (
              onProcessBookings.map((booking) => {
                const paymentStatus = booking.payment?.status ?? booking.status;
                const paymentLabel = getPaymentLabel(
                  booking.pendingExpiresAt,
                  paymentStatus,
                );
                const isPaymentPending = paymentStatus === "PENDING";

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
                    {booking.refund && (
                      <div
                        className={`mb-4 inline-flex px-3 py-1 text-xs font-semibold uppercase tracking-widest ${refundStatusTone(
                          booking.refund.status,
                        )}`}
                      >
                        {refundStatusLabel(booking.refund.status)}
                      </div>
                    )}

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
                        {booking.queue?.label && (
                          <p className="text-xs text-blue-700 mt-1 font-bold">
                            Antrian {booking.queue.label}
                          </p>
                        )}
                        {(paymentStatus === "PENDING" ||
                          paymentStatus === "EXPIRED" ||
                          paymentStatus === "FAILED") &&
                          paymentLabel && (
                            <p className="text-xs text-red-600 mt-1 font-semibold">
                              {paymentLabel}
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          isPaymentPending
                            ? openPaymentModal(booking)
                            : openBookingDetail(booking)
                        }
                        className={`px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold text-white transition-colors ${
                          isPaymentPending
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-black hover:bg-black/80"
                        }`}
                      >
                        {isPaymentPending ? "Bayar" : "Lihat Detail"}
                      </button>

                      {isPaymentPending && (
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

                      {booking.refundEligibility?.canRequest && (
                        <button
                          onClick={() => openRefundModal(booking)}
                          className="px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors"
                        >
                          Ajukan Pengembalian
                        </button>
                      )}

                      {booking.queue?.label && (
                        <button
                          onClick={() => printQueueTicket(booking)}
                          className="px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                          Cetak Tiket
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
                        {booking.queue?.label && (
                          <p className="text-xs text-blue-700 mt-1 font-bold">
                            Antrian {booking.queue.label}
                          </p>
                        )}
                      </div>
                      {booking.refund && (
                        <div className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <p className="font-semibold">
                            {refundStatusLabel(booking.refund.status)} - Rp{" "}
                            {booking.refund.amount.toLocaleString("id-ID")}
                          </p>
                          {booking.refund.status === "REJECTED" &&
                            booking.refund.rejectionReason && (
                              <p className="mt-1">
                                Alasan: {booking.refund.rejectionReason}
                              </p>
                            )}
                          {booking.refund.status === "APPROVED" &&
                            booking.refund.refundMethod && (
                              <p className="mt-1">
                                Metode: {booking.refund.refundMethod}
                              </p>
                            )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openBookingDetail(booking)}
                        className="px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold text-white bg-black hover:bg-black/80 transition-colors"
                      >
                        Lihat Detail & Nota
                      </button>
                      {booking.queue?.label && (
                        <button
                          onClick={() => printQueueTicket(booking)}
                          className="px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                          Cetak Tiket
                        </button>
                      )}
                    </div>
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
                  {selectedBooking.status === "COMPLETED" ? (
                    <button
                      onClick={() => loadReceipt(selectedBooking.id)}
                      disabled={loadingReceipt}
                      className="flex-1 bg-black text-white py-2 text-xs tracking-[0.2em] uppercase font-bold hover:bg-black/80 disabled:opacity-50"
                    >
                      {loadingReceipt ? "Memuat..." : "Lihat Nota Digital"}
                    </button>
                  ) : (
                    <div className="flex-1 border border-black/10 bg-black/5 px-4 py-2 text-center text-xs tracking-[0.16em] uppercase font-semibold text-black/60">
                      Nota tersedia setelah reservasi selesai
                    </div>
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
            notifyClientDataChanged("bookings:changed");
            void loadBookings();
          }}
          onRefresh={() => {
            void loadBookings();
          }}
        />
      )}

      {refundModalBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4">
            <div>
              <h2 className="text-xl font-bold text-black">
                Ajukan Pengembalian
              </h2>
              <p className="mt-1 text-xs text-black/60">
                Booking {refundModalBooking.code}. Batas pengajuan{" "}
                {refundModalBooking.refundEligibility?.deadline
                  ? formatIndonesianDateTime(
                      refundModalBooking.refundEligibility.deadline,
                    )
                  : "-"}
                .
              </p>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-black/70">
                Alasan
              </span>
              <textarea
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                rows={4}
                className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
                placeholder="Jelaskan alasan pengajuan pengembalian"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-black/70">
                Kontak
              </span>
              <input
                type="tel"
                value={refundContactPhone}
                onChange={(event) => setRefundContactPhone(event.target.value)}
                className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
                placeholder="Nomor WhatsApp/telepon untuk konfirmasi"
              />
            </label>

            <div className="rounded bg-black/5 px-3 py-2 text-xs text-black/70">
              Nominal pengembalian mengikuti pembayaran yang sudah tercatat.
              Admin akan mencatat pembayaran refund secara manual.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundModalBooking(null)}
                className="flex-1 border border-black/20 bg-white py-2 text-xs tracking-[0.2em] uppercase font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitRefundRequest}
                disabled={submittingRefund}
                className="flex-1 bg-black text-white py-2 text-xs tracking-[0.2em] uppercase font-bold disabled:opacity-50"
              >
                {submittingRefund ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
