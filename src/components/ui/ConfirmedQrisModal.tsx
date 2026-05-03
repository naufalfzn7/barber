"use client";

import { useEffect, useState } from "react";

type ConfirmedQrisModalProps = {
  isOpen: boolean;
  bookingCode?: string | null;
  onClose: () => void;
  autoCloseSeconds?: number;
};

export default function ConfirmedQrisModal({
  isOpen,
  bookingCode,
  onClose,
  autoCloseSeconds = 10,
}: ConfirmedQrisModalProps) {
  const [remaining, setRemaining] = useState(autoCloseSeconds);

  useEffect(() => {
    if (!isOpen) return;
    setRemaining(autoCloseSeconds);
    const tick = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(tick);
  }, [isOpen, autoCloseSeconds]);

  useEffect(() => {
    if (!isOpen) return;
    if (remaining <= 0) onClose();
  }, [remaining, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 bg-black/55 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-emerald-100 p-6 shadow-xl">
        <div className="relative flex items-center justify-center mb-4 h-20">
          <div className="relative z-10 w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center text-3xl font-bold">
            ✓
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-lg font-bold text-gray-900">
            Pembayaran berhasil!
          </p>
          <p className="text-sm text-gray-600">
            Terima kasih, pembayaran untuk booking {bookingCode ?? "-"} sudah
            kami terima. Booking kamu akan kami lanjutkan otomatis.
          </p>
          <p className="text-xs text-gray-500">
            Pop-up ini akan menutup otomatis dalam {remaining}s.
          </p>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
