"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/components/ui/useToastFeedback";
import { formatIndonesianDate } from "@/lib/dateFormat";

type OverviewBranch = {
  branchId: string;
  branchCode: string;
  branchName: string;
  timezone: string;
  isActive: boolean;
  adminCount: number;
  barberCount: number;
  serviceCount: number;
  totalBookings: number;
  completedBookings: number;
  revenue: number;
  qrisRevenue: number;
  cashRevenue: number;
  topService: string;
  lowStockCount: number;
  openedSince: string;
};

type OverviewResponse = {
  date: string;
  summary: {
    revenue: number;
    bookings: number;
    completed: number;
    qris: number;
    cash: number;
    activeBranches: number;
    lowStockAlerts: number;
  };
  branches: OverviewBranch[];
  alerts: Array<{
    id: string;
    branchId: string;
    branchName: string;
    productName: string;
    currentStock: number;
    minStock: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    total: number;
    branches: Array<{
      branchId: string;
      branchName: string;
      total: number;
    }>;
  }>;
};

const colors = ["#9EB3BC", "#4a6e7a", "#8a9ca6", "#c8d3d8"];

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
  color,
}: {
  label: string;
  value: string | number;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
      <div className={`mt-4 h-1.5 rounded-full ${color}`} />
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useToastFeedback({ error });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/superadmin/overview");
        const json = (await response.json()) as OverviewResponse & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(json.message ?? "Gagal memuat overview");
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat dashboard");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const sortedBranches = useMemo(
    () => [...(data?.branches ?? [])].sort((a, b) => b.revenue - a.revenue),
    [data?.branches],
  );

  const monthlyRevenue = data?.monthlyRevenue ?? [];
  const maxMonthlyRevenue = Math.max(
    ...monthlyRevenue.map((item) => item.total),
    1,
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Dashboard Super Admin
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Data realtime dari database, diperbarui per cabang dan laporan
            harian.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="px-3 py-1 rounded-full bg-gray-100">
            Tanggal {data?.date ? formatIndonesianDate(data.date) : "-"}
          </span>
          <Link
            href="/superadmin/laporan"
            className="px-3 py-1 rounded-full bg-black text-white font-semibold"
          >
            Buka Laporan
          </Link>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl border border-gray-100 bg-white animate-pulse"
            />
          ))}
        </div>
      )}

      {data && (
        <>
          {data.alerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">
                  Peringatan stok rendah
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  {data.alerts.length} item di bawah batas minimum pada beberapa
                  cabang.
                </p>
              </div>
              <Link
                href="/admin/stok"
                className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
              >
                Kelola Stok →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Pendapatan"
              value={formatRupiah(data.summary.revenue)}
              sub="Hari ini · Semua cabang"
              color="bg-gradient-to-r from-violet-500 to-purple-500"
            />
            <StatCard
              label="Total Booking"
              value={data.summary.bookings}
              sub={`${data.summary.completed} selesai · ${data.summary.bookings - data.summary.completed} ongoing`}
              color="bg-gradient-to-r from-blue-500 to-cyan-500"
            />
            <StatCard
              label="Completion Rate"
              value={`${data.summary.bookings > 0 ? Math.round((data.summary.completed / data.summary.bookings) * 100) : 0}%`}
              sub="Efisiensi layanan hari ini"
              color="bg-gradient-to-r from-emerald-500 to-green-500"
            />
            <StatCard
              label="Active Branches"
              value={data.summary.activeBranches}
              sub={`${data.branches.length} cabang terdaftar`}
              color="bg-gradient-to-r from-amber-500 to-orange-500"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                Performa Cabang Hari Ini
              </h2>
              <Link
                href="/superadmin/cabang"
                className="text-xs text-gray-400 hover:text-black transition-colors"
              >
                Lihat detail →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                      Cabang
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                      Booking
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3 hidden md:table-cell">
                      Selesai
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                      Pendapatan
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3 hidden lg:table-cell">
                      QRIS/Cash
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3 hidden lg:table-cell">
                      Top Service
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedBranches.map((branch) => {
                    const qrisPercent =
                      branch.revenue > 0
                        ? Math.round(
                            (branch.qrisRevenue / branch.revenue) * 100,
                          )
                        : 0;
                    return (
                      <tr
                        key={branch.branchId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#9EB3BC]/20 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-[#4a6e7a]">
                                {branch.branchName.slice(0, 1)}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-900">
                                {branch.branchName}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {branch.branchCode} · {branch.timezone}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center text-xs font-medium text-gray-900">
                          {branch.totalBookings}
                        </td>
                        <td className="px-5 py-3.5 text-center text-xs font-medium text-gray-900 hidden md:table-cell">
                          {branch.completedBookings}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs font-semibold text-gray-900">
                          {formatRupiah(branch.revenue)}
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell">
                          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500">
                            <span>QRIS {qrisPercent}%</span>
                            <span>Cash {100 - qrisPercent}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell text-center text-xs text-gray-600">
                          {branch.topService}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  Tren Pendapatan Bulanan
                </h3>
              </div>
              <div className="p-5 space-y-4">
                {monthlyRevenue.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Belum ada data pendapatan.
                  </p>
                )}
                {monthlyRevenue.map((month) => (
                  <div key={month.month}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-gray-700">
                        {month.month}
                      </p>
                      <p className="text-xs font-bold text-gray-900">
                        {formatRupiah(month.total)}
                      </p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden flex">
                      {month.branches.map((branch, index) => (
                        <div
                          key={branch.branchId}
                          className="h-2.5"
                          style={{
                            width: `${(branch.total / maxMonthlyRevenue) * 100}%`,
                            backgroundColor: colors[index % colors.length],
                          }}
                          title={`${branch.branchName}: ${formatRupiah(branch.total)}`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {month.branches.map((branch, index) => (
                        <span
                          key={branch.branchId}
                          className="text-[10px] text-gray-400 flex items-center gap-1"
                        >
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{
                              backgroundColor: colors[index % colors.length],
                            }}
                          />
                          {branch.branchName}: {formatRupiah(branch.total)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  Alert Stok Rendah
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.alerts.length === 0 && (
                  <div className="p-5 text-xs text-gray-500">
                    Tidak ada alert stok rendah saat ini.
                  </div>
                )}
                {data.alerts.slice(0, 6).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {alert.productName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {alert.branchName}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold text-gray-900">
                        {alert.currentStock} / {alert.minStock}
                      </p>
                      <p className="text-gray-500">stok saat ini</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
