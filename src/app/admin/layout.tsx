"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RouteRulesPanel } from "@/components/ui/RouteRulesPanel";
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
      className={`h-full flex flex-col bg-linear-to-b from-slate-900 via-slate-800 to-slate-700 text-white transition-all duration-300 ${collapsed ? "w-0 overflow-hidden" : "w-64"}`}
    >
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.25em] text-white/60 uppercase mb-0.5">
              Dashboard
            </p>
            <h1 className="text-base font-bold tracking-widest uppercase">
              MONARCH
            </h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white lg:hidden"
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
        <div className="mt-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-white/70 tracking-wide truncate">
            {branchName} · {branchCode}
          </span>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-3">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm tracking-wide transition-all ${isActive ? "bg-white text-black font-semibold" : "text-white/80 hover:text-white hover:bg-white/10"}`}
                >
                  <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-6 py-5 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
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
          className="mt-3 w-full text-left text-[11px] text-white/60 hover:text-white tracking-widest uppercase transition-colors"
        >
          Ubah Password →
        </button>
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="mt-2 w-full text-left text-[11px] text-white/60 hover:text-white tracking-widest uppercase transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? "Keluar..." : "Keluar →"}
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
        const meRes = await fetch("/api/auth/me");
        const me = (await meRes.json()) as MeResponse;

        if (!meRes.ok || !me.user?.role) {
          return;
        }

        setRole(me.user.role);
        setUserName(me.user.fullName ?? "Admin");
        setUserEmail(me.user.email ?? "-");

        if (me.user.branchId) {
          const catalogRes = await fetch(
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
      await fetch("/api/auth/logout", { method: "POST" });
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
    <div className="flex h-screen bg-[#F5F5F3] overflow-hidden font-sans">
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
            className="fixed inset-0 bg-black/50"
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
        <header className="shrink-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-md hover:bg-gray-100"
              onClick={() => setMobileSidebarOpen(true)}
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
            <button className="relative p-1.5 rounded-md hover:bg-gray-100">
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
