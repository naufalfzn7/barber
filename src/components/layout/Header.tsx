"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { authFetch, notifyClientDataChanged } from "@/lib/authClient";
import { navItems, rightNavItems, socialLinks } from "@/lib/data";
import { NavItem } from "@/types";

type AuthRole = "MEMBER" | "ADMIN" | "SUPER_ADMIN";

type AuthSession = {
  fullName: string;
  role: AuthRole;
  branchId?: string | null;
};

function getInitials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function getRoleLabel(role: AuthRole) {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "ADMIN") return "Admin";
  return "Member";
}

function getRoleDestination(role: AuthRole) {
  if (role === "SUPER_ADMIN") return "/superadmin/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/reservasi";
}

function AccountButton({
  session,
  onLogout,
}: {
  session: AuthSession;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2 text-left shadow-sm hover:border-black/20 hover:bg-gray-50 transition-colors"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white text-[11px] font-bold tracking-[0.14em]">
          {getInitials(session.fullName)}
        </span>
        <span className="hidden xl:flex flex-col leading-tight">
          <span className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
            {getRoleLabel(session.role)}
          </span>
          <span className="text-xs font-semibold text-gray-900 max-w-35 truncate">
            {session.fullName}
          </span>
        </span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 10 6"
          fill="none"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9.354.646a.5.5 0 00-.708 0L5 4.293 1.354.646a.5.5 0 00-.708.708l4 4a.5.5 0 00.708 0l4-4a.5.5 0 000-.708z"
            fill="currentColor"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden z-50">
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
              Login sebagai
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {session.fullName}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {getRoleLabel(session.role)}
            </p>
          </div>

          <div className="p-2">
            <Link
              href={getRoleDestination(session.role)}
              className="block rounded-xl px-3 py-2 text-xs tracking-widest text-gray-700 hover:bg-gray-50 hover:text-black"
              onClick={() => setOpen(false)}
            >
              Buka Dashboard / Reservasi
            </Link>
            {session.role === "MEMBER" && (
              <Link
                href="/profile"
                className="block rounded-xl px-3 py-2 text-xs tracking-widest text-gray-700 hover:bg-gray-50 hover:text-black mt-1"
                onClick={() => setOpen(false)}
              >
                Pengaturan Akun
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void onLogout();
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-xs tracking-widest text-red-600 hover:bg-red-50 mt-1"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function DropdownMenu({ items }: { items: NavItem[] }) {
  return (
    <ul className="absolute top-full left-0 min-w-50 bg-white border border-gray-100 shadow-lg z-50 py-1">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            className="block px-4 py-2 text-xs tracking-widest text-gray-800 hover:bg-gray-50 transition-colors"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NavItemComponent({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (item.children) {
    return (
      <li className="relative" ref={ref}>
        <button
          className="flex items-center gap-1 text-xs tracking-widest text-gray-800 hover:text-black py-2 font-medium"
          onClick={() => setOpen((prev) => !prev)}
        >
          {item.label}
          <svg
            className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 10 6"
            fill="none"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9.354.646a.5.5 0 00-.708 0L5 4.293 1.354.646a.5.5 0 00-.708.708l4 4a.5.5 0 00.708 0l4-4a.5.5 0 000-.708z"
              fill="currentColor"
            />
          </svg>
        </button>
        {open && <DropdownMenu items={item.children} />}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className="text-xs tracking-widest text-gray-800 hover:text-black py-2 font-medium"
      >
        {item.label}
      </Link>
    </li>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(
    {},
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    if (pathname === "/login") {
      setSession(null);
      return;
    }

    async function loadSession() {
      try {
        const response = await authFetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          setSession(null);
          return;
        }

        const data = (await response.json()) as {
          user?: {
            role?: AuthRole;
            fullName?: string;
            branchId?: string | null;
          };
        };

        if (!active) {
          return;
        }

        setSession(
          data.user?.role && data.user?.fullName
            ? {
                role: data.user.role,
                fullName: data.user.fullName,
                branchId: data.user.branchId,
              }
            : null,
        );
      } catch {
        setSession(null);
      }
    }

    void loadSession();
    window.addEventListener("auth:changed", loadSession);

    return () => {
      active = false;
      window.removeEventListener("auth:changed", loadSession);
    };
  }, [pathname]);

  async function handleLogout() {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } finally {
      setSession(null);
      notifyClientDataChanged("auth:changed");
      router.refresh();
      router.replace("/");
    }
  }

  function toggleDropdown(label: string) {
    setOpenDropdowns((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  const mobileActionItems = session
    ? [
        { label: "AKUN", href: getRoleDestination(session.role) },
        { label: "LOGOUT", href: "#", action: handleLogout },
      ]
    : rightNavItems;

  return (
    <header className="sticky top-0 z-50 bg-[#EBEBEB]">
      <div className="max-w-374 mx-auto px-6 md:px-16 lg:px-24 xl:px-32">
        <div className="flex items-center justify-between h-18 md:h-22">
          {/* Left nav */}
          <div className="hidden lg:flex items-center gap-8 flex-1">
            <nav>
              <ul className="flex items-center gap-8">
                {navItems.map((item) => (
                  <NavItemComponent key={item.label} item={item} />
                ))}
              </ul>
            </nav>
          </div>

          {/* Hamburger */}
          <button
            className="lg:hidden p-2 -ml-2"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? "✕" : "≡"}
          </button>

          {/* Logo */}
          <div className="shrink-0 flex justify-center">
            <Link href="/">
              <Image
                src="/images/shared/logo.webp"
                alt="Monarch Barber"
                width={155}
                height={29}
                className="h-7 w-auto"
              />
            </Link>
          </div>

          {/* Right nav */}
          <div className="hidden lg:flex items-center gap-8 flex-1 justify-end">
            <ul className="flex items-center gap-8">
              {session ? (
                <AccountButton session={session} onLogout={handleLogout} />
              ) : (
                rightNavItems.map((item) => (
                  <NavItemComponent key={item.label} item={item} />
                ))
              )}
            </ul>
          </div>

          <div className="lg:hidden w-9" />
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="px-4 py-4">
            {session && (
              <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400">
                  Login sebagai
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {session.fullName}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {getRoleLabel(session.role)}
                </p>
              </div>
            )}

            <ul className="space-y-1">
              {[...navItems, ...mobileActionItems].map((item) => (
                <li key={item.label}>
                  {"action" in item ? (
                    <button
                      className="block py-2 text-xs tracking-widest font-medium text-gray-800 hover:text-black"
                      onClick={() => {
                        if ("action" in item && item.action) {
                          void item.action();
                        }
                        setMobileOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ) : "children" in item && item.children ? (
                    <>
                      {/* ✅ Fixed: driven by data, not hardcoded index */}
                      <button
                        className="w-full text-left py-2 text-xs tracking-widest font-medium text-gray-800 hover:text-black flex items-center justify-between"
                        onClick={() => toggleDropdown(item.label)}
                      >
                        {item.label}
                        <svg
                          className={`w-2.5 h-2.5 transition-transform ${openDropdowns[item.label] ? "rotate-180" : ""}`}
                          viewBox="0 0 10 6"
                          fill="none"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M9.354.646a.5.5 0 00-.708 0L5 4.293 1.354.646a.5.5 0 00-.708.708l4 4a.5.5 0 00.708 0l4-4a.5.5 0 000-.708z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                      {openDropdowns[item.label] && (
                        <ul className="pl-4 mt-1 space-y-1 border-l border-gray-200">
                          {item.children.map((child) => (
                            <li key={child.label}>
                              <Link
                                href={child.href}
                                className="block py-1.5 text-xs tracking-widest text-gray-600 hover:text-black"
                                onClick={() => setMobileOpen(false)}
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className="block py-2 text-xs tracking-widest font-medium text-gray-800 hover:text-black"
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {/* Social links */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <ul className="flex gap-4 flex-wrap">
                {socialLinks.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target={s.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="text-xs tracking-widest text-gray-500 hover:text-black"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
