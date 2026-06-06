"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.354.646a.5.5 0 00-.708 0L5 4.293 1.354.646a.5.5 0 00-.708.708l4 4a.5.5 0 00.708 0l4-4a.5.5 0 000-.708z"
        fill="currentColor"
      />
    </svg>
  );
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
        className="flex items-center gap-3 border border-black/10 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:border-black/30 hover:bg-[#F8F8F6]"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 items-center justify-center bg-black text-[11px] font-bold tracking-[0.14em] text-white">
          {getInitials(session.fullName)}
        </span>
        <span className="hidden xl:flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
            {getRoleLabel(session.role)}
          </span>
          <span className="max-w-35 truncate text-xs font-semibold text-gray-900">
            {session.fullName}
          </span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden border border-black/10 bg-white shadow-2xl">
          <div className="border-b border-black/10 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
              Login sebagai
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {session.fullName}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {getRoleLabel(session.role)}
            </p>
          </div>

          <div className="p-2">
            <Link
              href={getRoleDestination(session.role)}
              className="block px-3 py-2.5 text-xs tracking-widest text-gray-700 transition-colors hover:bg-[#F4F1EC] hover:text-black"
              onClick={() => setOpen(false)}
            >
              Buka Dashboard / Reservasi
            </Link>
            {session.role === "MEMBER" && (
              <Link
                href="/profile"
                className="mt-1 block px-3 py-2.5 text-xs tracking-widest text-gray-700 transition-colors hover:bg-[#F4F1EC] hover:text-black"
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
              className="mt-1 block w-full px-3 py-2.5 text-left text-xs tracking-widest text-red-600 transition-colors hover:bg-red-50"
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
    <ul className="absolute left-0 top-full z-50 mt-3 min-w-56 border border-black/10 bg-white py-2 shadow-2xl">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            className="block px-4 py-2.5 text-xs tracking-widest text-gray-700 transition-colors hover:bg-[#F4F1EC] hover:text-black"
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
  const pathname = usePathname();
  const childActive = item.children?.some((child) => child.href === pathname);
  const isActive = item.href === pathname || childActive;
  const navClass = `inline-flex h-10 items-center gap-2 border-b border-transparent text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
    isActive
      ? "border-black text-black"
      : "text-gray-600 hover:border-black/40 hover:text-black"
  }`;

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
          type="button"
          className={navClass}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          {item.label}
          <ChevronIcon open={open} />
        </button>
        {open && <DropdownMenu items={item.children} />}
      </li>
    );
  }

  return (
    <li>
      <Link href={item.href} className={navClass}>
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
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdowns({});
  }, [pathname]);

  const { data: session = null } = useQuery({
    queryKey: ["auth", "me"],
    enabled: pathname !== "/login",
    staleTime: 60_000,
    queryFn: async (): Promise<AuthSession | null> => {
      const response = await authFetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        user?: {
          role?: AuthRole;
          fullName?: string;
          branchId?: string | null;
        };
      };

      if (!data.user?.role || !data.user.fullName) {
        return null;
      }

      return {
        role: data.user.role,
        fullName: data.user.fullName,
        branchId: data.user.branchId,
      };
    },
  });

  useEffect(() => {
    function handleAuthChanged() {
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    }

    window.addEventListener("auth:changed", handleAuthChanged);
    return () => window.removeEventListener("auth:changed", handleAuthChanged);
  }, [queryClient]);

  async function handleLogout() {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } finally {
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
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
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[#EBEBEB]/95 shadow-sm backdrop-blur relative">
      <div className="mx-auto max-w-[93.5rem] px-5 md:px-10 lg:px-16 xl:px-24">
        <div className="flex h-18 items-center justify-between md:h-22">
          <div className="hidden flex-1 items-center gap-8 lg:flex">
            <nav aria-label="Navigasi utama">
              <ul className="flex items-center gap-7">
                {navItems.map((item) => (
                  <NavItemComponent key={item.label} item={item} />
                ))}
              </ul>
            </nav>
          </div>

          <button
            className="inline-flex h-11 w-11 items-center justify-center border border-black/10 bg-white text-black shadow-sm transition-colors hover:bg-[#F4F1EC] lg:hidden"
            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            type="button"
          >
            {mobileOpen ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeLinecap="square"
                  strokeWidth="1.8"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeLinecap="square"
                  strokeWidth="1.8"
                />
              </svg>
            )}
          </button>

          <div className="flex shrink-0 justify-center">
            <Link
              href="/"
              className="text-base font-semibold uppercase tracking-[0.36em] text-black md:text-lg"
              aria-label="Monarch homepage"
            >
              Monarch
            </Link>
          </div>

          <div className="hidden flex-1 items-center justify-end gap-8 lg:flex">
            <ul className="flex items-center gap-7">
              {session ? (
                <AccountButton session={session} onLogout={handleLogout} />
              ) : (
                rightNavItems.map((item) => (
                  <NavItemComponent key={item.label} item={item} />
                ))
              )}
            </ul>
          </div>

          <div className="w-11 lg:hidden" />
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-[60] h-[calc(100vh-72px)] bg-black/35 backdrop-blur-sm md:h-[calc(100vh-88px)] lg:hidden">
          <nav
            className="mr-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-r border-black/10 bg-white shadow-2xl"
            aria-label="Menu mobile"
          >
            <div className="border-b border-black/10 px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-400">
                Menu
              </p>
              <p className="mt-1 text-lg font-semibold uppercase tracking-[0.26em] text-black">
                Monarch
              </p>
            </div>

            <div className="flex-1 px-5 py-5">
              {session && (
                <div className="mb-5 border border-black/10 bg-[#F8F8F6] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
                    Login sebagai
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {session.fullName}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {getRoleLabel(session.role)}
                  </p>
                </div>
              )}

              <ul className="divide-y divide-black/10">
                {[...navItems, ...mobileActionItems].map((item) => (
                  <li key={item.label}>
                    {"action" in item ? (
                      <button
                        type="button"
                        className="flex min-h-14 w-full items-center justify-between py-4 text-left text-[12px] font-semibold uppercase tracking-[0.18em] text-gray-800 transition-colors hover:text-black"
                        onClick={() => {
                          if ("action" in item && item.action) {
                            void item.action();
                          }
                          setMobileOpen(false);
                        }}
                      >
                        {item.label}
                        <span className="text-gray-400">/</span>
                      </button>
                    ) : "children" in item && item.children ? (
                      <>
                        <button
                          type="button"
                          className="flex min-h-14 w-full items-center justify-between py-4 text-left text-[12px] font-semibold uppercase tracking-[0.18em] text-gray-800 transition-colors hover:text-black"
                          onClick={() => toggleDropdown(item.label)}
                          aria-expanded={openDropdowns[item.label]}
                        >
                          {item.label}
                          <ChevronIcon open={openDropdowns[item.label]} />
                        </button>
                        {openDropdowns[item.label] && (
                          <ul className="mb-3 border-l border-black/20 pl-4">
                            {item.children.map((child) => (
                              <li key={child.label}>
                                <Link
                                  href={child.href}
                                  className="block py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 transition-colors hover:text-black"
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
                        className="flex min-h-14 items-center justify-between py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-gray-800 transition-colors hover:text-black"
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.label}
                        <span className="text-gray-400">/</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-black/10 px-5 py-5">
              <ul className="grid grid-cols-2 gap-2">
                {socialLinks.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target={s.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-center border border-black/10 px-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 transition-colors hover:border-black hover:text-black"
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
