"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RouteRulesPanel } from "@/components/ui/RouteRulesPanel";
import { authFetch, notifyClientDataChanged } from "@/lib/authClient";
import { formatIndonesianDate } from "@/lib/dateFormat";
import {
  useChangePassword,
  ChangePasswordModal,
} from "@/components/ui/useChangePassword";

type Role = "ADMIN" | "SUPER_ADMIN";

type MeResponse = {
  user?: {
    role?: Role;
    branchId?: string | null;
    fullName?: string;
    email?: string;
  };
  message?: string;
};

type CatalogResponse = {
  branches?: Array<{
    id: string;
    code: string;
    name: string;
    timezone: string;
  }>;
  message?: string;
};

const navLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/reservasi", label: "Reservasi" },
  { href: "/admin/member", label: "Member" },
  { href: "/admin/stok", label: "Stok Produk" },
  { href: "/admin/keuangan", label: "Keuangan" },
];

function Sidebar({
  branchName,
  branchCode,
  userName,
  userEmail,
  collapsed,
  onClose,
  onLogout,
  isLoggingOut,
  onChangePassword,
}: {
  branchName: string;
  branchCode: string;
  userName: string;
  userEmail: string;
  collapsed: boolean;
  onClose?: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  onChangePassword: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`h-full flex flex-col border-r border-black/10 bg-[#111111] text-white shadow-2xl transition-all duration-300 ${collapsed ? "w-0 overflow-hidden" : "w-72"}`}
    >
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-[0.24em] text-white/45">
              Dashboard
            </p>
            <h1 className="text-lg font-bold uppercase tracking-[0.32em]">
              MONARCH
            </h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="border border-white/10 p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Tutup sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-5 border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
            Cabang aktif
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-white">
            {branchName}
          </p>
          <div className="mt-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="truncate text-[11px] tracking-wide text-white/60">
            {branchCode}
          </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className={`flex min-h-11 items-center gap-3 border-l-2 px-3 py-2.5 text-sm tracking-wide transition-all ${isActive ? "border-[#C9A66B] bg-white text-black font-semibold" : "border-transparent text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white"}`}
                >
                  <span className="h-2 w-2 bg-current opacity-70" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center bg-white text-xs font-bold text-black">
            {userName
              .split(" ")
              .map((item) => item[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {userName}
            </p>
            <p className="text-[10px] text-white/60 truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={onChangePassword}
          className="mt-4 w-full border border-white/10 px-3 py-2 text-left text-[11px] uppercase tracking-widest text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          Ubah Password -&gt;
        </button>
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="mt-2 w-full border border-white/10 px-3 py-2 text-left text-[11px] uppercase tracking-widest text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          {isLoggingOut ? "Keluar..." : "Keluar ->"}
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState("Admin");
  const [userEmail, setUserEmail] = useState("-");
  const [branchName, setBranchName] = useState("Cabang aktif");
  const [branchCode, setBranchCode] = useState("-");
  const router = useRouter();
  const pathname = usePathname();
  const changePassword = useChangePassword();

  useEffect(() => {
    async function bootstrap() {
      try {
        const meRes = await authFetch("/api/auth/me", { cache: "no-store" });
        const me = (await meRes.json()) as MeResponse;

        if (!meRes.ok || !me.user?.role) {
          return;
        }

        setRole(me.user.role);
        setUserName(me.user.fullName ?? "Admin");
        setUserEmail(me.user.email ?? "-");

        if (me.user.branchId) {
          const catalogRes = await authFetch(
            `/api/bookings/catalog?branchId=${me.user.branchId}`,
          );
          const catalog = (await catalogRes.json()) as CatalogResponse;
          const branch = catalog.branches?.[0];
          if (catalogRes.ok && branch) {
            setBranchName(branch.name);
            setBranchCode(branch.code);
          }
        }
      } catch {
        setRole(null);
      }
    }

    void bootstrap();
  }, []);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await authFetch("/api/auth/logout", { method: "POST" });
      notifyClientDataChanged("auth:changed");
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  const currentPage = useMemo(() => {
    return navLinks.find(
      (link) => pathname === link.href || pathname.startsWith(link.href + "/"),
    );
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F3] font-sans">
      <div className="hidden lg:flex shrink-0">
        <Sidebar
          branchName={branchName}
          branchCode={branchCode}
          userName={userName}
          userEmail={userEmail}
          collapsed={false}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
          onChangePassword={() => changePassword.setShowModal(true)}
        />
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 shrink-0">
            <Sidebar
              branchName={branchName}
              branchCode={branchCode}
              userName={userName}
              userEmail={userEmail}
              collapsed={false}
              onClose={() => setMobileSidebarOpen(false)}
              onLogout={handleLogout}
              isLoggingOut={isLoggingOut}
              onChangePassword={() => changePassword.setShowModal(true)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-black/10 bg-white/95 px-4 shadow-sm backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="border border-black/10 p-2 transition-colors hover:bg-[#F4F1EC] lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Buka sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {currentPage?.label ?? "Admin"}
              </p>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                {role === "SUPER_ADMIN"
                  ? "Akses super admin lintas cabang"
                  : `${branchName} · ${branchCode}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden md:block">
              {formatIndonesianDate(new Date())}
            </span>
            <button className="relative border border-black/10 p-2 transition-colors hover:bg-[#F4F1EC]">
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <RouteRulesPanel scope="admin" />
          {children}
        </main>
      </div>

      <ChangePasswordModal {...changePassword} />
    </div>
  );
}
