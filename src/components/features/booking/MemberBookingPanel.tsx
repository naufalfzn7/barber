"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  formatIndonesianDateTime,
  formatIndonesianTime,
} from "@/lib/dateFormat";
import { authFetch, notifyClientDataChanged } from "@/lib/authClient";
import DepositPaymentModal from "./DepositPaymentModal";
import {
  confirmAction,
  useToastFeedback,
} from "@/components/ui/useToastFeedback";

type CatalogBranch = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  services: Array<{
    id: string;
    code: string;
    name: string;
    durationMinutes: number;
    bufferMinutes: number;
    price: number;
  }>;
  barbermen: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

type MemberHistoryItem = {
  id: string;
  code: string;
  phase: "Upcoming" | "Berlangsung" | "Selesai";
  status: string;
  createdAt: string;
  pendingExpiresAt?: string | null;
  scheduledStart: string;
  service: { name: string; price: number };
  barberman: { name: string };
  branch: { name: string };
  queue?: {
    number: number;
    label: string | null;
    status: string | null;
    assignedAt: string | null;
    calledAt: string | null;
  } | null;
  payment?: {
    id: string;
    status: string;
    amountDue: number;
    amountPaid?: number | null;
    isDeposit: boolean;
    depositAmount: number | null;
    externalRef: string | null;
    qrisString: string | null;
    qrisImageUrl: string | null;
    qrisExpiresAt: string | null;
  } | null;
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
};

type BookingSlot = {
  start: string;
  end: string;
  isAvailable?: boolean;
  availableBarberIds?: string[];
  unavailableReason?: string;
};

function getUnavailableSlotLabel(reason: string | undefined) {
  if (!reason) {
    return "Sudah dipesan";
  }

  const normalizedReason = reason.toLowerCase();
  if (normalizedReason.includes("sudah dipesan")) {
    return "Sudah dipesan";
  }

  if (normalizedReason.includes("tanggal")) {
    return "Tanggal lewat";
  }

  if (
    normalizedReason.includes("deposit") ||
    normalizedReason.includes("dp") ||
    normalizedReason.includes("batas pembayaran")
  ) {
    return "Lewat batas DP";
  }

  if (normalizedReason.includes("libur")) {
    return "Hari libur";
  }

  if (normalizedReason.includes("jam kerja")) {
    return "Di luar jam kerja";
  }

  return "Tidak tersedia";
}

type ReceiptDetail = {
  booking: {
    id: string;
    code: string;
    status: string;
    scheduledStart: string;
    completedAt: string | null;
    isWalkIn: boolean;
    walkInName?: string | null;
    walkInPhone?: string | null;
  };
  branch: {
    id: string;
    code: string;
    name: string;
  };
  customer: {
    fullName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
  };
  barberman: {
    id: string;
    name: string;
  } | null;
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
    method: "QRIS" | "CASH";
    status: string;
    amountDue: number;
    amountPaid: number | null;
    changeAmount: number | null;
    paidAt: string | null;
    externalRef: string | null;
  } | null;
};

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

function refundStatusLabel(status: MemberHistoryItem["refund"] extends infer Refund
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
    PENDING: "border-amber-200 bg-amber-50 text-amber-800",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    REJECTED: "border-red-200 bg-red-50 text-red-800",
  };

  return map[status] ?? "border-gray-200 bg-gray-50 text-gray-700";
}

export default function MemberBookingPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"MEMBER" | "ADMIN" | "SUPER_ADMIN" | null>(
    null,
  );
  const [branches, setBranches] = useState<CatalogBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [barbermanId, setBarbermanId] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedStart, setSelectedStart] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancelingBookingId, setCancelingBookingId] = useState<string | null>(
    null,
  );
  const [history, setHistory] = useState<MemberHistoryItem[]>([]);
  const [refundModalBooking, setRefundModalBooking] =
    useState<MemberHistoryItem | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundContactPhone, setRefundContactPhone] = useState("");
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Deposit payment states
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<{
    id: string;
    code: string;
    depositPercentage: number;
    depositAmount: number;
    totalAmount: number;
    initialPayment?: MemberHistoryItem["payment"];
    requireCreateConfirmation?: boolean;
  } | null>(null);
  const [depositPercentage, setDepositPercentage] = useState(25);

  // Receipt/Nota states
  const [receiptModal, setReceiptModal] = useState<ReceiptDetail | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useToastFeedback({
    message,
    error,
    onMessageShown: () => setMessage(null),
    onErrorShown: () => setError(null),
  });

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId) ?? null,
    [branches, branchId],
  );

  const selectedService = useMemo(
    () => selectedBranch?.services.find((s) => s.id === serviceId) ?? null,
    [selectedBranch, serviceId],
  );

  const depositAmount = useMemo(() => {
    if (!selectedService) return 0;
    return Math.round((selectedService.price * depositPercentage) / 100);
  }, [selectedService, depositPercentage]);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    const xenditRef = searchParams.get("xendit_ref");
    const xenditStatus = searchParams.get("xendit_status");

    if (xenditRef && xenditStatus === "paid") {
      router.replace(`/reservasi/pembayaran-sukses?${searchParams.toString()}`);
    }
  }, [router, searchParams]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const meRes = await authFetch("/api/auth/me");
        if (!meRes.ok) {
          setRole(null);
          return;
        }

        const meJson = (await meRes.json()) as {
          user?: { role?: "MEMBER" | "ADMIN" | "SUPER_ADMIN" };
        };

        setRole(meJson.user?.role ?? null);

        if (meJson.user?.role !== "MEMBER") {
          return;
        }

        // Get deposit percentage
        const depositRes = await authFetch(
          "/api/superadmin/settings/deposit",
        ).catch(() => null);
        if (depositRes?.ok) {
          const depositData = (await depositRes.json()) as {
            depositPercentage?: number;
          };
          if (depositData.depositPercentage) {
            setDepositPercentage(depositData.depositPercentage);
          }
        }

        const catalogRes = await authFetch("/api/bookings/catalog");
        const catalogJson = (await catalogRes.json()) as {
          branches?: CatalogBranch[];
          message?: string;
        };

        if (!catalogRes.ok) {
          setError(catalogJson.message ?? "Gagal memuat katalog booking");
          return;
        }

        const catalogBranches = catalogJson.branches ?? [];
        setBranches(catalogBranches);

        const firstBranch = catalogBranches[0] ?? null;
        if (!firstBranch) {
          return;
        }

        setBranchId(firstBranch.id);
        setServiceId(firstBranch.services[0]?.id ?? "");
        await loadHistory();
      } catch {
        setError("Tidak bisa memuat data booking saat ini");
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedBranch) {
      setServiceId("");
      setBarbermanId("");
      return;
    }

    if (!selectedBranch.services.some((service) => service.id === serviceId)) {
      setServiceId(selectedBranch.services[0]?.id ?? "");
    }

    if (!selectedBranch.barbermen.some((barber) => barber.id === barbermanId)) {
      setBarbermanId("");
    }
  }, [selectedBranch, serviceId, barbermanId]);

  async function loadSlots() {
    if (!branchId || !serviceId || !date) {
      setError("Pilih cabang, layanan, dan tanggal terlebih dahulu");
      setSlotNotice(null);
      return;
    }

    setLoadingSlots(true);
    setError(null);
    setMessage(null);
    setSlotNotice(null);
    setSelectedStart("");

    try {
      const query = new URLSearchParams({
        branchId,
        serviceId,
        date,
      });

      if (barbermanId) {
        query.set("barbermanId", barbermanId);
      }

      const response = await authFetch(`/api/bookings/slots?${query.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        slots?: BookingSlot[];
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Gagal memuat slot");
        setSlotNotice(null);
        setSlots([]);
        return;
      }

      setSlots(data.slots ?? []);
      if ((data.slots ?? []).length === 0) {
        setSlotNotice(
          data.message ?? "Tidak ada slot tersedia untuk pilihan ini",
        );
      }
    } catch {
      setError("Tidak bisa memuat slot saat ini");
      setSlotNotice(null);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submitBooking() {
    if (!branchId || !serviceId || !selectedStart) {
      setError("Pilih slot terlebih dahulu");
      return;
    }

    const confirmed = await confirmAction({
      title: "Buat reservasi?",
      text: "Reservasi baru akan dibuat untuk slot yang dipilih.",
      confirmButtonText: "Ya, buat",
    });

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    setSlotNotice(null);

    try {
      const response = await authFetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          serviceId,
          scheduledStart: selectedStart,
          barbermanId: barbermanId || undefined,
          notes: notes || undefined,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        booking?: { id: string; code: string };
      };

      if (!response.ok) {
        setError(data.message ?? "Gagal membuat booking");
        return;
      }

      if (data.booking) {
        setPendingBooking({
          id: data.booking.id,
          code: data.booking.code,
          depositPercentage,
          depositAmount,
          totalAmount: selectedService?.price || 0,
          requireCreateConfirmation: true,
        });
        setShowDepositModal(true);
      }

      setNotes("");
      notifyClientDataChanged("bookings:changed");
      await loadSlots();
      await loadHistory();
    } catch {
      setError("Tidak bisa membuat booking saat ini");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);

    try {
      const response = await authFetch("/api/bookings/my");
      const data = (await response.json()) as {
        bookings?: MemberHistoryItem[];
      };

      if (response.ok) {
        setHistory(data.bookings ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }
  useEffect(() => {
    const handler = () => {
      void loadHistory();
    };

    window.addEventListener("bookings:changed", handler);
    return () => window.removeEventListener("bookings:changed", handler);
  }, []);

  async function openReceipt(bookingId: string) {
    try {
      setLoadingReceipt(true);
      setError(null);
      setSlotNotice(null);

      const response = await authFetch(`/api/payments/receipt/${bookingId}`);
      const json = (await response.json()) as {
        message?: string;
        receipt?: ReceiptDetail;
      };

      if (!response.ok || !json.receipt) {
        throw new Error(json.message ?? "Gagal memuat nota pembayaran");
      }

      setReceiptModal(json.receipt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat nota pembayaran",
      );
    } finally {
      setLoadingReceipt(false);
    }
  }

  async function cancelPendingBooking(bookingId: string, bookingCode: string) {
    const confirmed = await confirmAction({
      title: "Batalkan reservasi?",
      text: `Reservasi ${bookingCode} akan dibatalkan dan slot dilepas untuk pelanggan lain.`,
      confirmButtonText: "Ya, batalkan",
      icon: "warning",
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      setCancelingBookingId(bookingId);
      setError(null);

      const response = await authFetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal membatalkan booking");
      }

      setMessage("Reservasi berhasil dibatalkan");
      // Update local history immediately and notify other components
      setHistory((prev) => prev.filter((h) => h.id !== bookingId));
      notifyClientDataChanged("bookings:changed");
      await loadHistory();
      await loadSlots();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membatalkan booking",
      );
    } finally {
      setCancelingBookingId(null);
    }
  }

  function openRefundModal(booking: MemberHistoryItem) {
    setRefundModalBooking(booking);
    setRefundReason("");
    setRefundContactPhone(booking.refund?.contactPhone ?? "");
  }

  async function submitRefundRequest() {
    if (!refundModalBooking) {
      return;
    }

    if (!refundReason.trim()) {
      setError("Alasan pengembalian wajib diisi");
      return;
    }

    try {
      setSubmittingRefund(true);
      setError(null);
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

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal mengajukan pengembalian");
      }

      setMessage(json.message ?? "Pengajuan pengembalian berhasil dikirim");
      setRefundModalBooking(null);
      notifyClientDataChanged("bookings:changed");
      await loadHistory();
      await loadSlots();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengajukan pengembalian",
      );
    } finally {
      setSubmittingRefund(false);
    }
  }

  function printReceipt() {
    if (!receiptModal) {
      return;
    }

    const customerName = receiptModal.customer?.fullName ?? "Walk-in";
    const paidAtLabel = receiptModal.payment?.paidAt
      ? formatIndonesianDateTime(receiptModal.payment.paidAt)
      : "-";

    const productRows = (receiptModal.products ?? [])
      .map(
        (item) => `
          <tr>
            <td style="padding:4px 0; border-bottom:1px dashed #ddd;">${escapeHtml(item.itemName)}</td>
            <td style="padding:4px 0; border-bottom:1px dashed #ddd; text-align:center;">${item.quantity}</td>
            <td style="padding:4px 0; border-bottom:1px dashed #ddd; text-align:right;">Rp ${item.subtotal.toLocaleString("id-ID")}</td>
          </tr>
        `,
      )
      .join("");

    const html = `
      <html>
        <head><title>Nota ${escapeHtml(receiptModal.booking.code)}</title></head>
        <body style="font-family:Arial, sans-serif; padding:20px; color:#111;">
          <h2 style="margin:0;">${escapeHtml(receiptModal.branch.name)}</h2>
          <p style="margin:4px 0 16px; font-size:12px; color:#555;">Cabang ${escapeHtml(receiptModal.branch.code)}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>No Booking:</strong> ${escapeHtml(receiptModal.booking.code)}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Pelanggan:</strong> ${escapeHtml(customerName)}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Barber:</strong> ${escapeHtml(receiptModal.barberman?.name ?? "-")}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Jadwal:</strong> ${formatIndonesianDateTime(receiptModal.booking.scheduledStart)}</p>
          <hr style="margin:16px 0;" />
          <table style="width:100%; font-size:13px; border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;">${escapeHtml(receiptModal.service.name)}</td>
              <td style="text-align:center;">1</td>
              <td style="text-align:right;">Rp ${receiptModal.service.price.toLocaleString("id-ID")}</td>
            </tr>
            ${productRows}
          </table>
          <hr style="margin:16px 0;" />
          <p style="margin:2px 0; font-size:13px;"><strong>Total:</strong> Rp ${receiptModal.totals?.amountDue?.toLocaleString("id-ID") ?? "-"}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Metode:</strong> ${escapeHtml(receiptModal.payment?.method ?? "-")}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Bayar:</strong> ${receiptModal.payment?.amountPaid ? `Rp ${receiptModal.payment.amountPaid.toLocaleString("id-ID")}` : "-"}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Kembalian:</strong> ${receiptModal.payment?.changeAmount ? `Rp ${receiptModal.payment.changeAmount.toLocaleString("id-ID")}` : "-"}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Waktu Bayar:</strong> ${paidAtLabel}</p>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=480,height=700");
    if (!printWindow) {
      setError("Popup blocker aktif. Izinkan popup untuk cetak nota.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function printQueueTicket(booking: MemberHistoryItem) {
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
      setError("Popup blocker aktif. Izinkan popup untuk cetak tiket.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  if (role !== "MEMBER") {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-black/10 p-8 text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-black/50">
          Reservasi Member
        </p>
        <p className="mt-3 text-sm text-black/70">
          Masuk dengan akun member untuk memilih cabang, melihat slot real-time,
          dan melanjutkan pembayaran deposit QRIS.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent("/reservasi")}`}
          className="inline-block mt-6 bg-black text-white px-6 py-3 text-xs tracking-[0.2em] uppercase font-semibold"
        >
          Login Member
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white border border-black/10 p-6 md:p-8">
        <p className="text-xs tracking-[0.2em] uppercase text-black/50">
          Detail Reservasi
        </p>

        {/* Deposit Info Alert */}
        {selectedService && (
          <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded">
            <p className="text-xs text-black/70 mb-2">
              <span className="font-semibold">Pembayaran deposit:</span> Anda
              perlu membayar{" "}
              <span className="font-bold text-blue-600">
                {depositPercentage}%
              </span>{" "}
              dari harga layanan (Rp {depositAmount.toLocaleString("id-ID")})
              melalui QRIS untuk mengonfirmasi reservasi.
            </p>
            <p className="text-xs text-black/60">
              Sisa pembayaran Rp{" "}
              {(selectedService.price - depositAmount).toLocaleString("id-ID")}{" "}
              dapat dibayar di kasir setelah layanan selesai. Slot hanya
              ditahan sementara sampai deposit berhasil dibayar.
            </p>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-black/70">
              Cabang
            </span>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="mt-1 w-full border border-black/20 px-3 py-2 text-sm bg-white"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-black/70">
              Layanan
            </span>
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="mt-1 w-full border border-black/20 px-3 py-2 text-sm bg-white"
            >
              {(selectedBranch?.services ?? []).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} - Rp {service.price.toLocaleString("id-ID")}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-black/70">
              Barberman (opsional)
            </span>
            <select
              value={barbermanId}
              onChange={(event) => setBarbermanId(event.target.value)}
              className="mt-1 w-full border border-black/20 px-3 py-2 text-sm bg-white"
            >
              <option value="">Siapa saja</option>
              {(selectedBranch?.barbermen ?? []).map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-black/70">
              Tanggal
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-black/70">
              Catatan
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 w-full border border-black/20 px-3 py-2 text-sm min-h-20"
              placeholder="Tulis preferensi model rambut, kebutuhan khusus, atau catatan untuk barberman."
            />
          </label>

          <button
            type="button"
            onClick={loadSlots}
            disabled={loadingSlots}
            className="w-full bg-black text-white py-2.5 text-xs tracking-[0.18em] uppercase font-semibold disabled:opacity-60"
          >
            {loadingSlots ? "Memeriksa Slot..." : "Cek Slot Tersedia"}
          </button>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {slotNotice ? (
            <p className="text-sm text-amber-700">{slotNotice}</p>
          ) : null}
          {message ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : null}
        </div>

        {slots.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.16em] text-black/70">
              Pilih Jam Kunjungan
            </p>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
              {slots.map((slot) => {
                const label = formatIndonesianTime(slot.start);
                const isAvailable = slot.isAvailable ?? true;
                const unavailableReason =
                  slot.unavailableReason ?? "Sudah dipesan";
                const unavailableLabel = getUnavailableSlotLabel(
                  slot.unavailableReason,
                );

                return (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => isAvailable && setSelectedStart(slot.start)}
                    disabled={!isAvailable}
                    className={`border px-3 py-2 text-xs font-semibold relative group transition-all ${
                      !isAvailable
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : selectedStart === slot.start
                          ? "bg-black text-white border-black"
                          : "bg-white text-black border-black/20 hover:border-black/40"
                    }`}
                    title={!isAvailable ? unavailableReason : ""}
                  >
                    <span>{label}</span>
                    {!isAvailable && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-50 rounded">
                        {unavailableLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={submitBooking}
              disabled={!selectedStart || submitting}
              className="w-full mt-4 bg-[#1f7d53] text-white py-2.5 text-xs tracking-[0.18em] uppercase font-semibold disabled:opacity-50"
            >
              {submitting ? "Menahan Slot..." : "Buat Reservasi"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-black/10 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-[0.2em] uppercase text-black/50">
            Riwayat Booking
          </p>
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading}
            className="text-xs tracking-[0.16em] uppercase font-semibold text-black/70"
          >
            {historyLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {history.length === 0 && (
            <p className="text-sm text-black/60">
              Belum ada riwayat. Klik refresh untuk memuat data booking kamu.
            </p>
          )}

          {history.map((item) => {
            const paymentStatus = item.payment?.status ?? item.status;
            const isPending =
              item.status === "PAYMENT_PENDING" || paymentStatus === "PENDING";
            const paymentLabel = getPaymentLabel(
              item.pendingExpiresAt,
              paymentStatus,
            );
            const isCompleted = item.status === "COMPLETED";

            return (
              <div key={item.id} className="border border-black/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.14em] text-black/50">
                      {item.code}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {item.service.name}
                    </p>
                    <p className="text-xs text-black/60 mt-1">
                      {formatIndonesianDateTime(item.scheduledStart)} -{" "}
                      {item.barberman.name}
                    </p>
                    <p className="text-xs text-black/70 mt-2">
                      {item.branch.name} - {item.phase}
                    </p>
                    {item.queue?.label && (
                      <div className="mt-3 inline-flex items-center gap-2 border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                        <span>Nomor antrian</span>
                        <span className="text-lg font-black">
                          {item.queue.label}
                        </span>
                      </div>
                    )}
                    {(paymentStatus === "PENDING" ||
                      paymentStatus === "EXPIRED" ||
                      paymentStatus === "FAILED") &&
                      paymentLabel && (
                        <p className="text-xs text-red-600 mt-1 font-semibold">
                          {paymentLabel}
                        </p>
                      )}
                    {item.refund && (
                      <div
                        className={`mt-3 border px-3 py-2 text-xs font-semibold ${refundStatusTone(
                          item.refund.status,
                        )}`}
                      >
                        <p>
                          {refundStatusLabel(item.refund.status)} - Rp{" "}
                          {item.refund.amount.toLocaleString("id-ID")}
                        </p>
                        {item.refund.status === "APPROVED" &&
                          item.refund.refundMethod && (
                            <p className="mt-1 font-normal">
                              Metode: {item.refund.refundMethod}
                            </p>
                          )}
                        {item.refund.status === "REJECTED" &&
                          item.refund.rejectionReason && (
                            <p className="mt-1 font-normal">
                              Alasan: {item.refund.rejectionReason}
                            </p>
                          )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingBooking({
                              id: item.id,
                              code: item.code,
                              depositPercentage,
                              depositAmount:
                                item.payment?.depositAmount ??
                                Math.round(
                                  (item.service.price * depositPercentage) /
                                    100,
                                ),
                              totalAmount: item.service.price,
                              initialPayment: item.payment ?? null,
                              requireCreateConfirmation: false,
                            });
                            setShowDepositModal(true);
                          }}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs tracking-widest uppercase font-semibold hover:bg-red-700 transition-colors whitespace-nowrap"
                        >
                          💳 Bayar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void cancelPendingBooking(item.id, item.code)
                          }
                          disabled={cancelingBookingId === item.id}
                          className="px-3 py-1.5 border border-red-300 text-red-700 bg-white text-xs tracking-widest uppercase font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors whitespace-nowrap"
                        >
                          {cancelingBookingId === item.id
                            ? "Membatalkan..."
                            : "Batalkan"}
                        </button>
                      </div>
                    )}

                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => openReceipt(item.id)}
                        disabled={loadingReceipt}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs tracking-widest uppercase font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        {loadingReceipt ? "Loading..." : "🧾 Lihat Nota"}
                      </button>
                    )}

                    {item.refundEligibility?.canRequest && (
                      <button
                        type="button"
                        onClick={() => openRefundModal(item)}
                        className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 text-xs tracking-widest uppercase font-semibold hover:bg-amber-100 transition-colors whitespace-nowrap"
                      >
                        Ajukan Pengembalian
                      </button>
                    )}

                    {item.queue?.label && (
                      <button
                        type="button"
                        onClick={() => printQueueTicket(item)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs tracking-widest uppercase font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        Cetak Tiket
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pendingBooking && (
        <DepositPaymentModal
          isOpen={showDepositModal}
          bookingId={pendingBooking.id}
          bookingCode={pendingBooking.code}
          depositAmount={pendingBooking.depositAmount}
          remainingAmount={
            pendingBooking.totalAmount - pendingBooking.depositAmount
          }
          initialPayment={pendingBooking.initialPayment}
          requireCreateConfirmation={pendingBooking.requireCreateConfirmation}
          onClose={async () => {
            setShowDepositModal(false);
            setPendingBooking(null);
            // Reload history to reflect any payment status changes
            notifyClientDataChanged("bookings:changed");
            await loadHistory();
          }}
          onSuccess={async () => {
            setShowDepositModal(false);
            setPendingBooking(null);
            notifyClientDataChanged("bookings:changed");
            await loadHistory();
          }}
          onRefresh={loadHistory}
        />
      )}

      {refundModalBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-black">
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

            <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Nominal pengembalian mengikuti pembayaran yang sudah tercatat.
              Setelah admin menyetujui, reservasi akan dibatalkan dan slot
              dilepas.
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

      {/* Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl my-8">
            {/* Header */}
            <div className="border-b border-gray-200 p-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Nota Pembayaran</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Booking {receiptModal.booking.code}
                </p>
              </div>
              <button
                onClick={() => setReceiptModal(null)}
                className="text-gray-500 hover:text-gray-700 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                  <p>
                    <span className="text-gray-500">Cabang:</span>{" "}
                    {receiptModal.branch.name}
                  </p>
                  <p>
                    <span className="text-gray-500">Pelanggan:</span>{" "}
                    {receiptModal.customer?.fullName ?? "Walk-in"}
                  </p>
                  <p>
                    <span className="text-gray-500">Barber:</span>{" "}
                    {receiptModal.barberman?.name ?? "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Jadwal:</span>{" "}
                    {formatIndonesianDateTime(
                      receiptModal.booking.scheduledStart,
                    )}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                  <p>
                    <span className="text-gray-500">Metode:</span>{" "}
                    {receiptModal.payment?.method ?? "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Bayar:</span>{" "}
                    {receiptModal.payment?.amountPaid
                      ? `Rp ${receiptModal.payment.amountPaid.toLocaleString("id-ID")}`
                      : "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Kembalian:</span>{" "}
                    {receiptModal.payment?.changeAmount
                      ? `Rp ${receiptModal.payment.changeAmount.toLocaleString("id-ID")}`
                      : "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Waktu Bayar:</span>{" "}
                    {receiptModal.payment?.paidAt
                      ? formatIndonesianDateTime(receiptModal.payment.paidAt)
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-lg border border-gray-200 p-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2 w-12">Qty</th>
                      <th className="text-right py-2 w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2">{receiptModal.service.name}</td>
                      <td className="text-center py-2">1</td>
                      <td className="text-right py-2">
                        Rp {receiptModal.service.price.toLocaleString("id-ID")}
                      </td>
                    </tr>
                    {receiptModal.products.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2">{item.itemName}</td>
                        <td className="text-center py-2">{item.quantity}</td>
                        <td className="text-right py-2">
                          Rp {item.subtotal.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-3 pt-3 border-t border-gray-200 font-semibold">
                  <div className="flex justify-between">
                    <span>TOTAL:</span>
                    <span>
                      Rp{" "}
                      {receiptModal.totals?.amountDue?.toLocaleString(
                        "id-ID",
                      ) ?? "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-5 flex gap-2">
              <button
                onClick={() => setReceiptModal(null)}
                className="flex-1 border border-gray-300 rounded py-2 text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={printReceipt}
                className="flex-1 bg-black text-white rounded py-2 text-xs font-semibold hover:bg-black/80 transition-colors"
              >
                🖨️ Print Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
