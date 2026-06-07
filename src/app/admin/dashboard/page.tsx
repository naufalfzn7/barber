"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToastFeedback } from "@/components/ui/useToastFeedback";
import { formatIndonesianTime } from "@/lib/dateFormat";
import { authFetch } from "@/lib/authClient";
import { ClientTodayLabel, useClientTodayIso } from "@/components/ui/ClientDateText";

type Role = "ADMIN" | "SUPER_ADMIN";

type BranchOption = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  barbermen: Array<{ id: string; name: string }>;
};

type BookingItem = {
  id: string;
  code: string;
  status:
    | "UPCOMING"
    | "IN_PROGRESS"
    | "PAYMENT_PENDING"
    | "COMPLETED"
    | "CANCELED"
    | "NO_SHOW";
  scheduledStart: string;
  isWalkIn: boolean;
  walkInName?: string | null;
  service: { id: string; name: string; price: number };
  barberman: { id: string; name: string } | null;
  member: { fullName: string } | null;
};

type DashboardResponse = {
  date: string;
  summary: {
    total: number;
    upcoming: number;
    inProgress: number;
    completed: number;
    paymentPending: number;
    canceled: number;
    noShow: number;
  };
  bookings: BookingItem[];
};

type AlertItem = {
  id: string;
  branchId: string;
  branchName?: string;
  productName?: string;
  currentStock?: number;
  minStock?: number;
  name?: string;
  stockQty?: number;
  minStockQty?: number;
};

type AlertsResponse = {
  alerts: AlertItem[];
};

type MeResponse = {
  user?: {
    role?: Role;
    branchId?: string | null;
  };
  message?: string;
};

type CatalogResponse = {
  branches?: BranchOption[];
  message?: string;
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl p-5 shadow-sm border border-gray-100 bg-white ${accent}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{sub}</p>
        </div>
        <div className="text-gray-500">{icon}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [branchId, setBranchId] = useState("");
  const today = useClientTodayIso();

  const bootstrapQuery = useQuery({
    queryKey: ["admin", "dashboard", "bootstrap"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [meRes, catalogRes] = await Promise.all([
        authFetch("/api/auth/me", { cache: "no-store" }),
        authFetch("/api/bookings/catalog"),
      ]);

      const me = (await meRes.json()) as MeResponse;
      const catalog = (await catalogRes.json()) as CatalogResponse;

      if (!meRes.ok || !me.user?.role) {
        throw new Error(me.message ?? "Gagal memuat sesi");
      }

      if (!catalogRes.ok) {
        throw new Error(catalog.message ?? "Gagal memuat cabang");
      }

      return {
        role: me.user.role,
        branchId: me.user.branchId ?? null,
        branches: catalog.branches ?? [],
      };
    },
  });

  const role = bootstrapQuery.data?.role ?? null;
  const branches = useMemo(
    () => bootstrapQuery.data?.branches ?? [],
    [bootstrapQuery.data?.branches],
  );
  const initialBranchId = useMemo(() => {
    if (!bootstrapQuery.data) {
      return "";
    }

    return bootstrapQuery.data.role === "ADMIN"
      ? (bootstrapQuery.data.branchId ?? bootstrapQuery.data.branches[0]?.id ?? "")
      : (bootstrapQuery.data.branches[0]?.id ?? "");
  }, [bootstrapQuery.data]);
  const selectedBranchId = branchId || initialBranchId;

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard", today, role, selectedBranchId],
    enabled: Boolean(today && selectedBranchId && role),
    staleTime: 30_000,
    queryFn: async () => {
      const query = new URLSearchParams({ date: today });
      if (role === "SUPER_ADMIN") {
        query.set("branchId", selectedBranchId);
      }

      const [dashboardRes, alertsRes] = await Promise.all([
        authFetch(`/api/bookings/admin/today?${query.toString()}`),
        authFetch(
          `/api/inventory/alerts${role === "SUPER_ADMIN" ? `?branchId=${selectedBranchId}` : ""}`,
        ),
      ]);

      const dashboardJson = (await dashboardRes.json()) as DashboardResponse & {
        message?: string;
      };
      const alertsJson = (await alertsRes.json()) as AlertsResponse & {
        message?: string;
      };

      if (!dashboardRes.ok) {
        throw new Error(dashboardJson.message ?? "Gagal memuat reservasi harian");
      }

      if (!alertsRes.ok) {
        throw new Error(alertsJson.message ?? "Gagal memuat alert stok");
      }

      return {
        dashboard: dashboardJson,
        alerts: alertsJson.alerts ?? [],
      };
    },
  });

  const dashboard = dashboardQuery.data?.dashboard ?? null;
  const alerts = dashboardQuery.data?.alerts ?? [];
  const error = bootstrapQuery.error ?? dashboardQuery.error;
  const loading = bootstrapQuery.isLoading || dashboardQuery.isLoading;

  useToastFeedback({
    error: error instanceof Error ? error.message : null,
  });

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const completedRevenue = useMemo(
    () =>
      (dashboard?.bookings ?? [])
        .filter((booking) => booking.status === "COMPLETED")
        .reduce((sum, booking) => sum + Number(booking.service.price), 0),
    [dashboard?.bookings],
  );

  const barberStatuses = useMemo(() => {
    const barbermen = selectedBranch?.barbermen ?? [];
    const bookings = dashboard?.bookings ?? [];

    return barbermen.slice(0, 6).map((barberman) => {
      const barberBookings = bookings.filter(
        (booking) => booking.barberman?.id === barberman.id,
      );
      const currentBooking = barberBookings.find(
        (booking) => booking.status === "IN_PROGRESS",
      );
      const waitingBooking = barberBookings.find((booking) =>
        ["UPCOMING", "PAYMENT_PENDING"].includes(booking.status),
      );

      let statusLabel = "Tersedia";
      let statusClass = "bg-emerald-100 text-emerald-700";
      let currentClient = "Tidak ada booking aktif";

      if (currentBooking) {
        statusLabel = "Melayani";
        statusClass = "bg-amber-100 text-amber-700";
        currentClient =
          currentBooking.member?.fullName ??
          currentBooking.walkInName ??
          "Walk-in";
      } else if (waitingBooking) {
        statusLabel = "Terjadwal";
        statusClass = "bg-blue-100 text-blue-700";
        currentClient =
          waitingBooking.member?.fullName ??
          waitingBooking.walkInName ??
          "Walk-in";
      }

      return {
        id: barberman.id,
        name: barberman.name,
        statusLabel,
        statusClass,
        currentClient,
        bookingCount: barberBookings.length,
      };
    });
  }, [dashboard?.bookings, selectedBranch?.barbermen]);

  const upcomingBookings = useMemo(
    () =>
      (dashboard?.bookings ?? [])
        .filter((booking) =>
          ["UPCOMING", "IN_PROGRESS", "PAYMENT_PENDING"].includes(
            booking.status,
          ),
        )
        .slice()
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
        .slice(0, 5),
    [dashboard?.bookings],
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Dashboard Admin</h2>
          <p className="text-xs text-gray-500 mt-1">
            Data operasional ditarik langsung dari booking, payment, dan
            inventory.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {role === "SUPER_ADMIN" && (
            <select
              value={selectedBranchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
          <span className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
            <ClientTodayLabel />
          </span>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {dashboard && (
        <>
          {alerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  Peringatan stok
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {alerts.length} item butuh perhatian pada cabang ini.
                </p>
              </div>
              <Link
                href="/admin/stok"
                className="text-xs font-semibold text-amber-700 hover:underline"
              >
                Buka stok →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Total Booking"
              value={dashboard.summary.total}
              sub="Hari ini"
              accent="bg-gray-50"
              icon={<span className="text-2xl">▣</span>}
            />
            <StatCard
              label="Sedang Jalan"
              value={dashboard.summary.inProgress}
              sub="Layanan aktif"
              accent="bg-blue-50"
              icon={<span className="text-2xl">⏱</span>}
            />
            <StatCard
              label="Selesai"
              value={dashboard.summary.completed}
              sub="Booking tuntas"
              accent="bg-emerald-50"
              icon={<span className="text-2xl">✓</span>}
            />
            <StatCard
              label="Pending Payment"
              value={dashboard.summary.paymentPending}
              sub="Menunggu Pembayaran"
              accent="bg-violet-50"
              icon={<span className="text-2xl">◌</span>}
            />
            <StatCard
              label="Pendapatan"
              value={formatRupiah(completedRevenue)}
              sub="Berdasarkan booking selesai"
              accent="bg-orange-50"
              icon={<span className="text-2xl">Rp</span>}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">
                  Reservasi Berikutnya
                </h2>
                <Link
                  href="/admin/reservasi"
                  className="text-xs text-gray-400 hover:text-black transition-colors"
                >
                  Lihat semua →
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {upcomingBookings.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Tidak ada reservasi
                  </p>
                )}
                {upcomingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                        {(
                          booking.member?.fullName ??
                          booking.walkInName ??
                          "BK"
                        )
                          .split(" ")
                          .map((item) => item[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {booking.member?.fullName ??
                            booking.walkInName ??
                            "Walk-in"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {booking.service.name} ·{" "}
                          {booking.barberman?.name ?? "Belum assigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-gray-500">
                        {formatIndonesianTime(booking.scheduledStart)}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-semibold tracking-wide ${booking.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700" : booking.status === "PAYMENT_PENDING" ? "bg-violet-100 text-violet-700" : "bg-blue-50 text-blue-600"}`}
                      >
                        {booking.status === "IN_PROGRESS"
                          ? "Berlangsung"
                          : booking.status === "PAYMENT_PENDING"
                            ? "Payment Pending"
                            : "Upcoming"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">
                  Barberman Hari Ini
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {barberStatuses.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Tidak ada barberman
                  </p>
                )}
                {barberStatuses.map((barber) => (
                  <div key={barber.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {barber.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {barber.currentClient}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-semibold ${barber.statusClass}`}
                      >
                        {barber.statusLabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      {barber.bookingCount} booking hari ini
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Alert Stok Rendah
              </h3>
              <Link
                href="/admin/stok"
                className="text-xs text-gray-400 hover:text-black transition-colors"
              >
                Lihat stok →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {alerts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-10">
                  Semua stok aman
                </p>
              )}
              {alerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {alert.productName ?? alert.name ?? "-"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {alert.branchName ?? selectedBranch?.name ?? "-"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-900">
                      {alert.currentStock ?? alert.stockQty ?? 0} /{" "}
                      {alert.minStock ?? alert.minStockQty ?? 0}
                    </p>
                    <p className="text-[10px] text-gray-400">stok saat ini</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
