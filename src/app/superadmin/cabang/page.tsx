"use client";

import { useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/components/ui/useToastFeedback";
import { formatIndonesianDate } from "@/lib/dateFormat";

type BranchSummary = {
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

type BranchResponse = {
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
  branches: BranchSummary[];
  alerts: Array<{
    id: string;
    branchId: string;
    branchName: string;
    productName: string;
    currentStock: number;
    minStock: number;
  }>;
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CabangPage() {
  const [data, setData] = useState<BranchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useToastFeedback({ error });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/superadmin/branches");
        const json = (await response.json()) as BranchResponse & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(json.message ?? "Gagal memuat cabang");
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat cabang");
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

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Kelola Cabang</h2>
          <p className="text-xs text-gray-500 mt-1">
            Monitoring cabang, kapasitas kru, dan performa harian dari database.
          </p>
        </div>
        <div className="text-xs text-gray-500 px-3 py-1 rounded-full bg-gray-100">
          Tanggal {data?.date ? formatIndonesianDate(data.date) : "-"}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-56 rounded-xl border border-gray-100 bg-white animate-pulse"
            />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                Active Branches
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {data.summary.activeBranches}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                Admin
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {sortedBranches.reduce(
                  (sum, branch) => sum + branch.adminCount,
                  0,
                )}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                Barberman
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {sortedBranches.reduce(
                  (sum, branch) => sum + branch.barberCount,
                  0,
                )}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                Revenue
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatRupiah(data.summary.revenue)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedBranches.map((branch) => (
              <div
                key={branch.branchId}
                className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      {branch.branchName}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {branch.branchCode} · {branch.timezone}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full font-semibold ${branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {branch.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                      Admin
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {branch.adminCount}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                      Barberman
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {branch.barberCount}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                      Layanan
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {branch.serviceCount}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                      Stok Rendah
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {branch.lowStockCount}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-600">
                  <p>Total booking: {branch.totalBookings}</p>
                  <p>Selesai: {branch.completedBookings}</p>
                  <p>Pendapatan: {formatRupiah(branch.revenue)}</p>
                  <p>Top service: {branch.topService}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
