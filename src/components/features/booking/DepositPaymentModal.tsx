"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import PaymentSuccessModal from "@/components/ui/PaymentSuccessModal";
import { authFetch, notifyClientDataChanged } from "@/lib/authClient";
import { confirmAction } from "@/components/ui/useToastFeedback";

function formatCountdown(seconds: number) {
  const safe = Math.max(seconds, 0);
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (days > 0) {
    return `${days} hari ${hours} jam`;
  }
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED";

const initializingDepositBookings = new Set<string>();

type InitialDepositPayment = {
  id?: string | null;
  status?: string | null;
  amountDue?: number | null;
  depositAmount?: number | null;
  externalRef?: string | null;
  qrisString?: string | null;
  qrisImageUrl?: string | null;
  qrisExpiresAt?: string | null;
};

interface DepositPaymentModalProps {
  isOpen: boolean;
  bookingId: string;
  bookingCode: string;
  depositAmount: number;
  remainingAmount: number;
  initialPayment?: InitialDepositPayment | null;
  requireCreateConfirmation?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onRefresh?: () => void | Promise<void>;
}

function normalizeInitialPaymentStatus(
  initialPayment?: InitialDepositPayment | null,
): PaymentStatus | "INIT" {
  const status = initialPayment?.status;
  if (
    status === "PENDING" ||
    status === "PAID" ||
    status === "EXPIRED" ||
    status === "FAILED"
  ) {
    return status;
  }

  return "INIT";
}

export default function DepositPaymentModal({
  isOpen,
  bookingId,
  bookingCode,
  depositAmount,
  remainingAmount,
  initialPayment = null,
  requireCreateConfirmation = true,
  onClose,
  onSuccess,
  onRefresh,
}: DepositPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState(initialPayment?.qrisString ?? "");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "INIT">(
    normalizeInitialPaymentStatus(initialPayment),
  );
  const [invoiceId, setInvoiceId] = useState(initialPayment?.externalRef ?? "");
  const [paymentId, setPaymentId] = useState(initialPayment?.id ?? "");
  const [pollingPayment, setPollingPayment] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(
    initialPayment?.qrisExpiresAt ?? null,
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState(
    initialPayment?.qrisImageUrl ?? "",
  );
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [displayDepositAmount, setDisplayDepositAmount] =
    useState(depositAmount);
  const [displayRemainingAmount, setDisplayRemainingAmount] =
    useState(remainingAmount);
  const [bookingCanceled, setBookingCanceled] = useState(false);
  const paymentUrl = qrImageUrl || qrCode;
  const deadlinePassed = expiresAt
    ? new Date(expiresAt).getTime() <= Date.now()
    : false;
  const canRetryPayment =
    (paymentStatus === "EXPIRED" || paymentStatus === "FAILED") &&
    !deadlinePassed &&
    !bookingCanceled;
  const onRefreshRef = useRef(onRefresh);
  const initializedBookingRef = useRef<string | null>(null);

  useEffect(() => {
    setDisplayDepositAmount(depositAmount);
    setDisplayRemainingAmount(remainingAmount);
  }, [depositAmount, remainingAmount]);

  useEffect(() => {
    if (!isOpen) {
      initializedBookingRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    initializedBookingRef.current = null;
    setQrCode(initialPayment?.qrisString ?? "");
    setQrImageUrl(initialPayment?.qrisImageUrl ?? "");
    setInvoiceId(initialPayment?.externalRef ?? "");
    setPaymentId(initialPayment?.id ?? "");
    setExpiresAt(initialPayment?.qrisExpiresAt ?? null);
    setRemainingSeconds(null);
    setBookingCanceled(false);
    setPaymentStatus(normalizeInitialPaymentStatus(initialPayment));
  }, [bookingId, initialPayment]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const createDepositPayment = useCallback(async () => {
    const confirmed = requireCreateConfirmation
      ? await confirmAction({
          title: "Buat pembayaran deposit?",
          text: `QRIS deposit untuk booking ${bookingCode} akan dibuat.`,
          confirmButtonText: "Ya, buat QRIS",
        })
      : true;

    if (!confirmed) {
      initializingDepositBookings.delete(bookingId);
      onClose();
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      const data = await response.json();

      if (!response.ok) {
        void Swal.fire({
          title: data.message || "Gagal membuat pembayaran deposit",
          text: "Mohon coba lagi. Jika masalah berlanjut, hubungi admin.",
          icon: "error",
          confirmButtonColor: "#111827",
        });
        return;
      }

      setQrCode(data.qris?.qrString || "");
      setQrImageUrl(data.qris?.qrImageUrl || "");
      setInvoiceId(data.payment?.externalRef || "");
      setPaymentStatus((data.payment?.status as PaymentStatus) || "PENDING");
      setPaymentId(data.payment?.id || "");
      const actualAmountValue =
        typeof data.depositAmount === "number"
          ? data.depositAmount
          : Number(data.payment?.amountDue);
      if (Number.isFinite(actualAmountValue)) {
        const actualDepositAmount = Math.round(actualAmountValue);
        setDisplayDepositAmount(actualDepositAmount);
        setDisplayRemainingAmount(
          Math.max(depositAmount + remainingAmount - actualDepositAmount, 0),
        );
      }
      setExpiresAt(data.qris?.expiresAt || data.payment?.qrisExpiresAt || null);
    } catch {
      void Swal.fire({
        title: "Gagal membuat pembayaran deposit",
        text: "Mohon coba lagi. Jika masalah berlanjut, hubungi admin.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
    } finally {
      initializingDepositBookings.delete(bookingId);
      setLoading(false);
    }
  }, [
    bookingCode,
    bookingId,
    depositAmount,
    onClose,
    remainingAmount,
    requireCreateConfirmation,
  ]);

  // Initialize payment on modal open.
  const retryDeposit = useCallback(async () => {
    if (bookingCanceled || deadlinePassed) {
      void Swal.fire({
        title: "Batas pembayaran sudah lewat",
        text: "Reservasi otomatis dibatalkan dan slot sudah dilepas.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
      return;
    }

    if (!paymentId) {
      void Swal.fire({
        title: "Payment ID tidak ditemukan",
        text: "Inisialisasi pembayaran ulang dari booking.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
      return;
    }

    const confirmed = await confirmAction({
      title: "Buat ulang QRIS deposit?",
      text: `QRIS deposit booking ${bookingCode} akan dibuat ulang.`,
      confirmButtonText: "Ya, buat ulang",
      icon: "warning",
    });

    if (!confirmed) {
      return;
    }

    setRetrying(true);
    try {
      const response = await authFetch("/api/payments/qris/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        void Swal.fire({
          title: data.message || "Gagal retry pembayaran",
          text: "Mohon coba lagi. Jika masalah berlanjut, hubungi admin.",
          icon: "error",
          confirmButtonColor: "#111827",
        });
        return;
      }
      setQrCode(data.result?.qris?.qrString || "");
      setQrImageUrl(data.result?.qris?.qrImageUrl || "");
      setInvoiceId(data.result?.payment?.externalRef || "");
      setPaymentStatus(
        (data.result?.payment?.status as PaymentStatus) || "PENDING",
      );
      setExpiresAt(
        data.result?.qris?.expiresAt ||
          data.result?.payment?.qrisExpiresAt ||
          null,
      );
      void Swal.fire({
        title: "QRIS pembayaran baru siap dibayar",
        text: "Gunakan link pembayaran terbaru sebelum kedaluwarsa.",
        icon: "success",
        confirmButtonColor: "#111827",
      });
      notifyClientDataChanged("bookings:changed");
      void onRefreshRef.current?.();
    } catch {
      void Swal.fire({
        title: "Gagal retry pembayaran",
        text: "Mohon coba lagi. Jika masalah berlanjut, hubungi admin.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
    } finally {
      setRetrying(false);
    }
  }, [bookingCanceled, bookingCode, deadlinePassed, paymentId]);

  useEffect(() => {
    if (
      isOpen &&
      paymentStatus === "INIT" &&
      initializedBookingRef.current !== bookingId &&
      !initializingDepositBookings.has(bookingId)
    ) {
      initializedBookingRef.current = bookingId;
      initializingDepositBookings.add(bookingId);
      void createDepositPayment();
    }
  }, [bookingId, isOpen, paymentStatus, createDepositPayment]);

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
      if (next <= 0) {
        setPaymentStatus("EXPIRED");
        setBookingCanceled(true);
        void onRefreshRef.current?.();
      }
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
        const statusRes = await authFetch(
          `/api/payments/status/${bookingId}?isDeposit=true`,
        );
        const statusData = await statusRes.json();
        const newStatus = statusData.payment?.status as PaymentStatus;

        if (newStatus === "PAID") {
          setPaymentStatus("PAID");
          notifyClientDataChanged("bookings:changed");
          void onRefreshRef.current?.();
          void Swal.fire({
            title: "Deposit berhasil dibayar!",
            text: "Reservasi Anda sudah masuk antrean pembayaran deposit.",
            icon: "success",
            confirmButtonColor: "#111827",
          });
          setShowSuccessModal(true);
        } else if (newStatus && newStatus !== paymentStatus) {
          setPaymentStatus(newStatus);
          void onRefreshRef.current?.();
        }

        if (statusData.booking?.status === "CANCELED") {
          setBookingCanceled(true);
          setPaymentStatus("EXPIRED");
          void onRefreshRef.current?.();
        }

        if (statusData.payment?.expiresAt) {
          setExpiresAt(statusData.payment.expiresAt);
        }
      } catch {
        // Silent fail on polling
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      setPollingPayment(false);
    };
  }, [paymentStatus, bookingId]);

  function copyQrString() {
    if (!paymentUrl) {
      void Swal.fire({
        title: "Link pembayaran belum tersedia",
        text: "Tunggu QRIS selesai dibuat atau buat ulang pembayaran.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
      return;
    }
    void navigator.clipboard.writeText(paymentUrl);
    void Swal.fire({
      title: "Link pembayaran disalin",
      text: "Link siap ditempel ke browser atau aplikasi pembayaran.",
      icon: "success",
      confirmButtonColor: "#111827",
    });
  }

  function handleSuccessModalClose() {
    setShowSuccessModal(false);
    void onRefreshRef.current?.();
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
                Rp{" "}
                {(displayDepositAmount + displayRemainingAmount).toLocaleString(
                  "id-ID",
                )}
              </span>
            </div>
            <div className="flex justify-between text-black/70">
              <span>Deposit:</span>
              <span className="font-semibold">
                Rp {displayDepositAmount.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex justify-between text-black/70">
              <span>Sisa pembayaran:</span>
              <span>Rp {displayRemainingAmount.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <p className="text-sm text-black/60">Membuat QRIS payment...</p>
            </div>
          )}

          {/* QR Payment Section */}
          {!loading && paymentUrl && paymentStatus !== "PAID" && (
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
                {paymentStatus === "PENDING" && expiresAt && (
                  <div className="space-y-1">
                    <p className="text-gray-600">
                      Bayar sebelum:{" "}
                      <span className="font-semibold text-gray-900">
                        {formatExpiryDateTime(expiresAt)}
                      </span>
                    </p>
                    {remainingSeconds !== null && (
                      <p className="text-gray-600 text-xs">
                        Sisa waktu:{" "}
                        <span className="font-semibold text-red-600">
                          {formatCountdown(remainingSeconds)}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Link Display */}
              <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 flex flex-col items-center justify-center space-y-4">
                {paymentStatus === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!paymentUrl) {
                          void Swal.fire({
                            title: "Link pembayaran belum tersedia",
                            text: "Tunggu QRIS selesai dibuat atau buat ulang pembayaran.",
                            icon: "error",
                            confirmButtonColor: "#111827",
                          });
                          return;
                        }

                        window.location.replace(paymentUrl);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow w-full text-center transition-colors"
                    >
                      Bayar Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={copyQrString}
                      className="border border-gray-300 bg-white text-gray-800 font-semibold py-2.5 px-4 rounded-lg w-full text-center transition-colors hover:bg-gray-100"
                    >
                      Salin Link Pembayaran
                    </button>
                  </>
                )}

                {canRetryPayment && (
                  <button
                    onClick={() => void retryDeposit()}
                    disabled={retrying}
                    className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold py-3 px-6 rounded-lg shadow w-full transition-colors"
                  >
                    {retrying ? "Memproses Retry..." : "🔄 Retry Pembayaran"}
                  </button>
                )}
              </div>

              {/* Payment Instructions */}
              {paymentStatus === "PENDING" && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-xs text-black/70">
                  <p className="font-semibold mb-2">Instruksi Pembayaran:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Klik tombol &quot;Bayar Sekarang&quot; di atas</li>
                    <li>Anda akan diarahkan ke halaman pembayaran Xendit</li>
                    <li>
                      Pilih metode pembayaran yang Anda inginkan (E-Wallet, VA,
                      QRIS, dsb)
                    </li>
                    <li>
                      Selesaikan pembayaran sebesar Rp{" "}
                      {displayDepositAmount.toLocaleString("id-ID")}
                    </li>
                  </ol>
                </div>
              )}

              {(paymentStatus === "EXPIRED" || paymentStatus === "FAILED") && (
                <div className="bg-red-50 border border-red-200 p-4 rounded text-xs text-red-700">
                  <p className="font-semibold mb-2">
                    {paymentStatus === "EXPIRED" || bookingCanceled
                      ? "Waktu pembayaran telah habis"
                      : "Pembayaran gagal"}
                  </p>
                  <p>
                    {paymentStatus === "EXPIRED" || bookingCanceled
                      ? "Reservasi otomatis dibatalkan dan slot sudah dilepas karena deposit tidak dibayar paling lambat 1 jam sebelum jadwal reservasi."
                      : "Pembayaran tidak dapat diproses. Silakan coba lagi dengan mengklik tombol Retry di bawah."}
                  </p>
                </div>
              )}

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
        amountLabel={`Nominal: Rp ${displayDepositAmount.toLocaleString("id-ID")}`}
        buttonLabel="Lanjutkan"
        onClose={handleSuccessModalClose}
      />
    </div>
  );
}
