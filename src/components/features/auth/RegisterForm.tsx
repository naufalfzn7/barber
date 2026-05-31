"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { notifyClientDataChanged } from "@/lib/authClient";
import {
  confirmAction,
  useToastFeedback,
} from "@/components/ui/useToastFeedback";

export default function RegisterForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useToastFeedback({ message, error });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const confirmed = await confirmAction({
      title: "Daftar member baru?",
      text: `Akun member untuk ${fullName} akan dibuat.`,
      confirmButtonText: "Ya, daftar",
    });

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phoneNumber: phoneNumber || undefined,
          password,
          confirmPassword,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        user?: { role?: "MEMBER" | "ADMIN" | "SUPER_ADMIN" };
      };

      if (!response.ok) {
        setError(data.message ?? "Registrasi gagal");
        return;
      }

      // Auto-login on successful registration
      setMessage(data.message ?? "Registrasi berhasil");
      notifyClientDataChanged("auth:changed");
      router.replace("/reservasi");
      router.refresh();
    } catch {
      setError("Tidak bisa registrasi sekarang");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-md bg-white border border-black/10 p-8">
      <h1 className="text-2xl tracking-widest uppercase font-semibold text-black">
        Daftar Member
      </h1>
      <p className="text-sm text-black/60 mt-2">
        Buat akun baru untuk reservasi dan akses layanan.
      </p>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-xs tracking-widest uppercase text-black/70">
            Nama Lengkap
          </span>
          <input
            className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-xs tracking-widest uppercase text-black/70">
            Email
          </span>
          <input
            className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-xs tracking-widest uppercase text-black/70">
            Nomor Telepon (Opsional)
          </span>
          <input
            className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-xs tracking-widest uppercase text-black/70">
            Password
          </span>
          <input
            className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-black/50 mt-1">Minimal 6 karakter</p>
        </label>

        <label className="block">
          <span className="text-xs tracking-widest uppercase text-black/70">
            Konfirmasi Password
          </span>
          <input
            className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2.5 text-xs tracking-[0.2em] uppercase font-bold disabled:opacity-50"
        >
          {loading ? "Mendaftar..." : "Daftar"}
        </button>
      </form>

      <p className="text-sm text-black/60 mt-6 text-center">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="text-black font-semibold hover:underline"
        >
          Login di sini
        </Link>
      </p>
    </section>
  );
}
