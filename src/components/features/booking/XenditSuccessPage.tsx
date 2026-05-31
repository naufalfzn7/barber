"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, notifyClientDataChanged } from "@/lib/authClient";

type ConfirmState = "loading" | "success" | "error";

type MeResponse = {
  user?: {
    role?: "MEMBER" | "ADMIN" | "SUPER_ADMIN" | null;
  };
};

export default function XenditSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didConfirmRef = useRef(false);
  const [state, setState] = useState<ConfirmState>("loading");
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [message, setMessage] = useState("Memverifikasi pembayaran...");
  const [remainingSeconds, setRemainingSeconds] = useState(2);
  const [redirectTarget, setRedirectTarget] = useState("/reservasi");

  const xenditRef = searchParams.get("xendit_ref");
  const xenditStatus = searchParams.get("xendit_status");

  useEffect(() => {
    let isActive = true;

    async function loadRedirectTarget() {
      try {
        const response = await authFetch("/api/auth/me");

        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as MeResponse;
        const role = json.user?.role;

        if (!isActive) {
          return;
        }

        if (role === "ADMIN" || role === "SUPER_ADMIN") {
          setRedirectTarget("/admin/reservasi");
        } else {
          setRedirectTarget("/reservasi");
        }
      } catch {
        if (!isActive) {
          return;
        }

        setRedirectTarget("/reservasi");
      }
    }

    void loadRedirectTarget();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (didConfirmRef.current) {
      return;
    }

    didConfirmRef.current = true;

    if (!xenditRef || xenditStatus !== "paid") {
      setState("error");
      setMessage("Tautan pembayaran tidak valid atau belum dibayar.");
      return;
    }

    let isActive = true;

    async function confirmPayment() {
      try {
        const response = await authFetch(
          "/api/payments/qris/confirm-by-reference",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ externalRef: xenditRef }),
          },
        );

        const json = (await response.json()) as {
          message?: string;
          result?: { booking?: { code?: string | null } };
        };

        if (!response.ok) {
          throw new Error(json.message ?? "Gagal mengonfirmasi pembayaran");
        }

        if (!isActive) {
          return;
        }

        const code = json.result?.booking?.code ?? null;
        notifyClientDataChanged("bookings:changed");
        setBookingCode(code);
        setState("success");
        setMessage(
          `Terima kasih, pembayaran untuk booking ${code ?? "-"} sudah kami terima. Booking kamu akan kami lanjutkan otomatis.`,
        );
        setRemainingSeconds(2);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Gagal mengonfirmasi pembayaran",
        );
      }
    }

    void confirmPayment();

    return () => {
      isActive = false;
    };
  }, [xenditRef, xenditStatus]);

  useEffect(() => {
    if (state !== "success") {
      return;
    }

    if (remainingSeconds <= 0) {
      router.replace(redirectTarget);
      return;
    }

    const timer = window.setTimeout(() => {
      setRemainingSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [remainingSeconds, redirectTarget, router, state]);

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_top,#f7f7f2_0%,#ece7dc_40%,#e1d8c8_100%)] px-6 py-16 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-4xl border border-black/10 bg-white/90 shadow-[0_24px_90px_rgba(0,0,0,0.12)] backdrop-blur-sm p-8 md:p-10 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-600 shadow-inner shadow-emerald-200/60">
          ✓
        </div>

        <p className="text-xs uppercase tracking-[0.28em] text-black/45">
          Xendit Payment
        </p>
        <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-[0.02em] text-black">
          Pembayaran berhasil!
        </h1>

        <p className="mt-4 text-base md:text-lg leading-relaxed text-black/70">
          {message}
        </p>

        {bookingCode && state === "success" && (
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Booking {bookingCode} sudah masuk ke proses berikutnya.
          </div>
        )}

        {state === "success" ? (
          <p className="mt-5 text-sm text-black/55">
            Pop-up ini akan menutup otomatis dalam {remainingSeconds}s.
          </p>
        ) : (
          <p className="mt-5 text-sm text-black/55">
            Jika halaman tidak berpindah otomatis, gunakan tombol di bawah.
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => router.replace(redirectTarget)}
            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black/85"
          >
            Kembali ke Reservasi
          </button>
          {state === "success" && (
            <button
              type="button"
              onClick={() => router.replace(redirectTarget)}
              className="rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-black/5"
            >
              Lanjutkan sekarang
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
