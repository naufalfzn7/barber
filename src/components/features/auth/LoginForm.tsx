"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const MEMBER_DEFAULT_REDIRECT = "/reservasi";

function resolveMemberRedirect(nextPath: string): string {
  const normalized = (nextPath || "").trim();

  if (!normalized || normalized === "/") {
    return MEMBER_DEFAULT_REDIRECT;
  }

  if (
    normalized === "/surakarta#book" ||
    normalized === "/yogyakarta#book" ||
    normalized.startsWith("/admin") ||
    normalized.startsWith("/superadmin")
  ) {
    return MEMBER_DEFAULT_REDIRECT;
  }

  return normalized;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as {
        message?: string;
        user?: { role?: "MEMBER" | "ADMIN" | "SUPER_ADMIN" };
      };

      if (!response.ok) {
        setError(data.message ?? "Login failed");
        return;
      }

      if (data.user?.role === "SUPER_ADMIN") {
        router.replace("/superadmin/dashboard");
        return;
      }

      if (data.user?.role === "ADMIN") {
        router.replace("/admin/dashboard");
        return;
      }

      router.replace(resolveMemberRedirect(nextPath));
    } catch {
      setError("Unable to login right now");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-md bg-white border border-black/10 p-8">
      <h1 className="text-2xl tracking-widest uppercase font-semibold text-black">
        Login
      </h1>
      <p className="text-sm text-black/60 mt-2">
        Masuk untuk akses reservasi dan dashboard sesuai role.
      </p>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
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
            Password
          </span>
          <input
            className="mt-1 w-full border border-black/20 px-3 py-2 text-sm"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2.5 text-xs tracking-[0.2em] uppercase font-bold disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="text-sm text-black/60 mt-6 text-center">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="text-black font-semibold hover:underline"
        >
          Daftar di sini
        </Link>
      </p>
    </section>
  );
}
