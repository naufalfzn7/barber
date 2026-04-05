"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import PaymentSuccessModal from "@/components/ui/PaymentSuccessModal";

const PAYMENT_PENDING_TIMEOUT_MINUTES = Number(
  process.env.NEXT_PUBLIC_PAYMENT_PENDING_TIMEOUT_MINUTES ?? 15,
);

function getFallbackExpiresAtIso() {
  return new Date(
    Date.now() + PAYMENT_PENDING_TIMEOUT_MINUTES * 60 * 1000,
  ).toISOString();
}

function formatCountdown(seconds: number) {
  const safe = Math.max(seconds, 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED";

interface DepositPaymentModalProps {
  isOpen: boolean;
  bookingId: string;
  bookingCode: string;
  depositAmount: number;
  remainingAmount: number;
  onClose: () => void;
  onSuccess: () => void;
  onRefresh?: () => void | Promise<void>;
}

export default function DepositPaymentModal({
  isOpen,
  bookingId,
  bookingCode,
  depositAmount,
  remainingAmount,
  onClose,
  onSuccess,
  onRefresh,
}: DepositPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "INIT">(
    "INIT",
  );
  const [invoiceId, setInvoiceId] = useState("");
  const [pollingPayment, setPollingPayment] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const createDepositPayment = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Gagal membuat pembayaran deposit");
        return;
      }

      setQrCode(data.qris?.qrString || "");
      setQrImageUrl(data.qris?.qrImageUrl || "");
      setInvoiceId(data.payment?.externalRef || "");
      setPaymentStatus((data.payment?.status as PaymentStatus) || "PENDING");
      setExpiresAt(data.qris?.expiresAt || getFallbackExpiresAtIso());
    } catch {
      toast.error("Gagal membuat pembayaran deposit");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  // Initialize payment on modal open
  useEffect(() => {
    if (isOpen && paymentStatus === "INIT") {
      void createDepositPayment();
    }
  }, [isOpen, paymentStatus, createDepositPayment]);

  useEffect(() => {
    if (!isOpen || paymentStatus !== "PENDING" || !expiresAt) {
      setRemainingSeconds(null);
      return;
    }

    const target = new Date(expiresAt).getTime();
    if (Number.isNaN(target)) {
      setRemainingSeconds(null);
      return;
    }

    const update = () => {
      const next = Math.floor((target - Date.now()) / 1000);
      setRemainingSeconds(next > 0 ? next : 0);
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [isOpen, paymentStatus, expiresAt]);

  // Polling untuk status payment saat menunggu pembayaran
  useEffect(() => {
    if (
      paymentStatus !== "PENDING" &&
      paymentStatus !== "EXPIRED" &&
      paymentStatus !== "FAILED"
    ) {
      return;
    }

    setPollingPayment(true);
    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await fetch(
          `/api/payments/status/${bookingId}?isDeposit=true`,
        );
        const statusData = await statusRes.json();
        const newStatus = statusData.payment?.status as PaymentStatus;

        if (newStatus === "PAID") {
          setPaymentStatus("PAID");
          toast.success("Deposit berhasil dibayar!");
          setShowSuccessModal(true);
        } else if (newStatus && newStatus !== paymentStatus) {
          setPaymentStatus(newStatus);
        }
      } catch {
        // Silent fail on polling
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      setPollingPayment(false);
    };
  }, [paymentStatus, bookingId, onClose, onSuccess]);

  function copyQrString() {
    if (!qrCode) {
      toast.error("QR string belum tersedia");
      return;
    }
    navigator.clipboard.writeText(qrCode);
    toast.success("QR string disalin");
  }

  function handleSuccessModalClose() {
    setShowSuccessModal(false);
    void onRefresh?.();
    onSuccess();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-md my-8">
        {/* Header */}
        <div className="border-b border-gray-200 p-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Pembayaran Deposit</h2>
            <p className="text-xs text-gray-500 mt-1">Booking: {bookingCode}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Amount Summary */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded text-sm space-y-2">
            <div className="flex justify-between text-black/70">
              <span>Harga Layanan:</span>
              <span className="font-semibold">
                Rp {(depositAmount + remainingAmount).toLocaleString("id-ID")}
              </span>
              <span>Rp {remainingAmount.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <p className="text-sm text-black/60">Membuat QRIS payment...</p>
            </div>
          )}

          {/* QR Payment Section */}
          {!loading && qrCode && paymentStatus !== "PAID" && (
            <div className="space-y-4">
              {/* Status Info */}
              <div className="grid grid-cols-1 gap-2 text-xs bg-gray-50 border border-gray-200 p-3 rounded">
                <p className="text-gray-600">
                  Status:{" "}
                  <span className="font-semibold text-gray-900">
                    {paymentStatus === "PENDING"
                      ? "Menunggu Pembayaran"
                      : paymentStatus === "EXPIRED"
                        ? "Kadaluarsa"
                        : paymentStatus === "FAILED"
                          ? "Gagal"
                          : paymentStatus}
                  </span>
                  {pollingPayment && (
                    <span className="ml-2 text-[11px] text-gray-500">
                      (mengecek...)
                    </span>
                  )}
                </p>
                {invoiceId && (
                  <p className="text-gray-600">
                    Ref:{" "}
                    <span className="font-mono text-gray-900">{invoiceId}</span>
                  </p>
                )}
                {paymentStatus === "PENDING" && remainingSeconds !== null && (
                  <p className="text-gray-600">
                    Batas bayar:{" "}
                    <span className="font-semibold text-red-600">
                      {formatCountdown(remainingSeconds)}
                    </span>
                  </p>
                )}
              </div>

              {/* QR Code Display */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center justify-center">
                <img
                  src={
                    qrImageUrl ||
                    `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`
                  }
                  alt="QRIS"
                  className="w-64 h-64"
                />
              </div>

              {/* Copy QR Button */}
              <button
                onClick={copyQrString}
                className="w-full border border-gray-300 rounded py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                Salin QR String
              </button>

              {/* Payment Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-xs text-black/70">
                <p className="font-semibold mb-2">Instruksi Pembayaran:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Buka aplikasi e-wallet Anda (GCash, Dana, OVO, dll)</li>
                  <li>Pilih menu Bayar dengan QRIS</li>
                  <li>Scan QR code di atas</li>
                  <li>
                    Konfirmasi pembayaran sebesar Rp{" "}
                    {depositAmount.toLocaleString("id-ID")}
                  </li>
                </ol>
              </div>

              <p className="text-xs text-black/60 text-center">
                Status akan otomatis diperbarui dalam beberapa detik setelah
                pembayaran dikonfirmasi.
              </p>
            </div>
          )}

          {/* Paid Success State */}
          {paymentStatus === "PAID" && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 p-6 rounded text-center">
                <p className="text-3xl mb-2">✓</p>
                <p className="font-semibold text-green-900">
                  Pembayaran Sukses!
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Deposit Anda telah terkonfirmasi
                </p>
              </div>
              <p className="text-sm text-gray-700 text-center">
                Silakan lanjutkan untuk mengkonfirmasi booking Anda.
              </p>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="border-t border-gray-200 p-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded py-2 text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            {paymentStatus === "PAID" ? "Selesai" : "Tutup"}
          </button>
          {paymentStatus === "PAID" && (
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="flex-1 bg-black text-white rounded py-2 text-xs font-semibold hover:bg-black/80 transition-colors"
            >
              Lanjutkan
            </button>
          )}
        </div>
      </div>

      <PaymentSuccessModal
        isOpen={showSuccessModal}
        title="Deposit Berhasil Dibayar"
        description={`Booking ${bookingCode} sudah aktif dan siap diproses.`}
        amountLabel={`Nominal: Rp ${depositAmount.toLocaleString("id-ID")}`}
        buttonLabel="Lanjutkan"
        onClose={handleSuccessModalClose}
      />
    </div>
  );
}
