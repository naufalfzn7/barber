"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RouteRulesPanel } from "@/components/ui/RouteRulesPanel";
import { ClientTodayLabel } from "@/components/ui/ClientDateText";
import { authFetch, notifyClientDataChanged } from "@/lib/authClient";
import {
  useChangePassword,
  ChangePasswordModal,
} from "@/components/ui/useChangePassword";

const navLinks = [
  {
    href: "/superadmin/dashboard",
    label: "Dashboard",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    href: "/superadmin/cabang",
    label: "Kelola Cabang",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    href: "/superadmin/admin",
    label: "Kelola Admin",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
  {
    href: "/superadmin/barberman",
    label: "Kelola Barberman",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    href: "/superadmin/layanan",
    label: "Kelola Layanan",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
  {
    href: "/superadmin/laporan",
    label: "Laporan Keuangan",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    href: "/superadmin/pengaturan",
    label: "Pengaturan",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

function Sidebar({
  collapsed,
  onClose,
  onLogout,
  isLoggingOut,
  onChangePassword,
}: {
  collapsed: boolean;
  onClose?: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  onChangePassword: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`h-full flex flex-col border-r border-black/10 bg-[#111111] text-white shadow-2xl transition-all duration-300 ${
        collapsed ? "w-0 overflow-hidden" : "w-72"
      }`}
    >
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-[0.24em] text-white/45">
              Super Admin
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
            Scope
          </p>
          <p className="mt-1 text-sm font-semibold text-white">All Branches</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[11px] tracking-wide text-white/60">
              Full access
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
                  className={`flex min-h-11 items-center gap-3 border-l-2 px-3 py-2.5 text-sm tracking-wide transition-all ${
                    isActive
                      ? "border-[#C9A66B] bg-white text-black font-semibold"
                      : "border-transparent text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.icon}
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
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              Super Admin
            </p>
            <p className="text-[10px] text-white/40 truncate">
              Full Access · All Branches
            </p>
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

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const changePassword = useChangePassword();

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

  const currentPage = navLinks.find(
    (l) => pathname === l.href || pathname.startsWith(l.href + "/"),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F3] font-sans">
      <div className="hidden lg:flex shrink-0">
        <Sidebar
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
                {currentPage?.label ?? "Super Admin"}
              </p>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                Multi-branch Management Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden md:block">
              <ClientTodayLabel />
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
          <RouteRulesPanel scope="superadmin" />
          {children}
        </main>
      </div>

      <ChangePasswordModal {...changePassword} />
    </div>
  );
}
