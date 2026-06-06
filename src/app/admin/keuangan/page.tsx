"use client";

import { useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/components/ui/useToastFeedback";
import { formatIndonesianTime } from "@/lib/dateFormat";
import { authFetch } from "@/lib/authClient";
import { ClientTodayLabel } from "@/components/ui/ClientDateText";

type Role = "ADMIN" | "SUPER_ADMIN";

type CatalogBranch = {
  id: string;
  code: string;
  name: string;
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
  service: { id: string; name: string; price: number };
  barberman: { id: string; name: string };
  member: { fullName: string } | null;
  isWalkIn: boolean;
  walkInName?: string | null;
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

type PaymentInfo = {
  id: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  method: "QRIS" | "CASH" | null;
  amountDue: number | string | null;
  amountPaid: number | string | null;
  externalRef: string | null;
};

type PaymentBookingResponse = {
  booking?: { id: string; code: string; status: string };
  payment?: PaymentInfo | null;
  message?: string;
};

type MeResponse = {
  user?: {
    role?: Role;
    branchId?: string | null;
  };
  message?: string;
};

type CatalogResponse = {
  branches?: CatalogBranch[];
  message?: string;
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export default function KeuanganPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<CatalogBranch[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [payments, setPayments] = useState<Record<string, PaymentInfo | null>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useToastFeedback({ error });

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);

        const meRes = await authFetch("/api/auth/me");
        const me = (await meRes.json()) as MeResponse;
        if (!meRes.ok || !me.user?.role) {
          throw new Error(me.message ?? "Gagal memuat sesi");
        }

        const catalogRes = await authFetch("/api/bookings/catalog");
        const catalog = (await catalogRes.json()) as CatalogResponse;
        if (!catalogRes.ok) {
          throw new Error(catalog.message ?? "Gagal memuat cabang");
        }

        const catalogBranches = catalog.branches ?? [];
        setRole(me.user.role);
        setBranches(catalogBranches);
        setBranchId(
          me.user.role === "ADMIN"
            ? (me.user.branchId ?? catalogBranches[0]?.id ?? "")
            : (catalogBranches[0]?.id ?? ""),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat halaman");
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!branchId || !role) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const date = new Date().toISOString().slice(0, 10);
        const query = new URLSearchParams({ date });
        if (role === "SUPER_ADMIN") {
          query.set("branchId", branchId);
        }

        const dashboardRes = await authFetch(
          `/api/bookings/admin/today?${query.toString()}`,
        );
        const dashboardJson =
          (await dashboardRes.json()) as DashboardResponse & {
            message?: string;
          };

        if (!dashboardRes.ok) {
          throw new Error(dashboardJson.message ?? "Gagal memuat transaksi");
        }

        setDashboard(dashboardJson);

        const paymentEntries = await Promise.all(
          dashboardJson.bookings.map(async (booking) => {
            const paymentRes = await authFetch(
              `/api/payments/booking/${booking.id}`,
            );
            const paymentJson =
              (await paymentRes.json()) as PaymentBookingResponse;

            if (!paymentRes.ok) {
              return [booking.id, null] as const;
            }

            return [booking.id, paymentJson.payment ?? null] as const;
          }),
        );

        setPayments(Object.fromEntries(paymentEntries));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat keuangan");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [branchId, role]);

  const transactions = useMemo(() => {
    return (dashboard?.bookings ?? [])
      .filter((booking) => booking.status !== "CANCELED")
      .map((booking) => {
        const payment = payments[booking.id] ?? null;
        const paidAmount =
          payment?.status === "PAID"
            ? toNumber(payment.amountPaid ?? payment.amountDue)
            : booking.status === "COMPLETED"
              ? booking.service.price
              : 0;

        return {
          booking,
          payment,
          paidAmount,
          method:
            payment?.method ?? (booking.status === "COMPLETED" ? "CASH" : null),
        };
      })
      .filter(
        (item) => item.paidAmount > 0 || item.payment?.status === "PENDING",
      );
  }, [dashboard?.bookings, payments]);

  const revenue = transactions.reduce((sum, item) => sum + item.paidAmount, 0);
  const qrisRevenue = transactions
    .filter((item) => item.method === "QRIS")
    .reduce((sum, item) => sum + item.paidAmount, 0);
  const cashRevenue = transactions
    .filter((item) => item.method === "CASH")
    .reduce((sum, item) => sum + item.paidAmount, 0);
  const totalTransactions = transactions.filter(
    (item) =>
      item.payment?.status === "PAID" || item.booking.status === "COMPLETED",
  ).length;
  const qrisPercent =
    revenue > 0 ? Math.round((qrisRevenue / revenue) * 100) : 0;
  const cashPercent =
    revenue > 0 ? Math.round((cashRevenue / revenue) * 100) : 0;

  const serviceRecap = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const item of transactions) {
      const current = map.get(item.booking.service.name) ?? {
        count: 0,
        total: 0,
      };
      current.count += 1;
      current.total += item.paidAmount;
      map.set(item.booking.service.name, current);
    }

    return Array.from(map.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const selectedBranchName =
    branches.find((branch) => branch.id === branchId)?.name ?? "Semua cabang";

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Rekap Keuangan</h2>
          <p className="text-xs text-gray-500 mt-1">
            Data transaksi diambil dari booking dan payment yang tersimpan di
            database.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {role === "SUPER_ADMIN" && (
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
          <span className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
            <ClientTodayLabel /> · {selectedBranchName}
          </span>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {dashboard && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl p-5 bg-black text-white shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1">
                Total Pendapatan
              </p>
              <p className="text-2xl font-bold">{formatRupiah(revenue)}</p>
              <p className="text-xs text-white/60 mt-1">
                {totalTransactions} transaksi terbayar
              </p>
            </div>
            <div className="rounded-xl p-5 bg-violet-50 shadow-sm border border-violet-100">
              <p className="text-[10px] uppercase tracking-[0.25em] text-violet-500 mb-1">
                Via QRIS
              </p>
              <p className="text-2xl font-bold text-violet-900">
                {formatRupiah(qrisRevenue)}
              </p>
              <p className="text-xs text-violet-600 mt-1">
                {qrisPercent}% dari total
              </p>
            </div>
            <div className="rounded-xl p-5 bg-emerald-50 shadow-sm border border-emerald-100">
              <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-500 mb-1">
                Via Cash
              </p>
              <p className="text-2xl font-bold text-emerald-900">
                {formatRupiah(cashRevenue)}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                {cashPercent}% dari total
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  Riwayat Transaksi Hari Ini
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                        Jam
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                        Pelanggan
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3 hidden md:table-cell">
                        Layanan
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3 hidden lg:table-cell">
                        Barber
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                        Metode
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                        Nominal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-10 text-center text-sm text-gray-400"
                        >
                          Belum ada transaksi
                        </td>
                      </tr>
                    )}
                    {transactions.map(
                      ({ booking, payment, paidAmount, method }) => (
                        <tr
                          key={booking.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs text-gray-500">
                              {formatIndonesianTime(booking.scheduledStart)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-xs font-medium text-gray-900">
                              {booking.member?.fullName ??
                                booking.walkInName ??
                                "Walk-in"}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {booking.code}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <p className="text-xs text-gray-600">
                              {booking.service.name}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 hidden lg:table-cell">
                            <p className="text-xs text-gray-600">
                              {booking.barberman.name}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex text-[10px] px-2 py-1 rounded-full font-semibold ${method === "QRIS" ? "bg-violet-100 text-violet-700" : method === "CASH" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                            >
                              {payment?.status === "PAID"
                                ? (method ?? "COMPLETED")
                                : (payment?.status ?? booking.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <p className="text-xs font-bold text-gray-900">
                              {formatRupiah(paidAmount)}
                            </p>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-3.5 text-xs font-bold text-gray-700 uppercase tracking-wider"
                      >
                        Total
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-bold text-gray-900">
                        {formatRupiah(revenue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  Rekap per Layanan
                </h3>
              </div>
              {serviceRecap.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">
                  Belum ada data
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {serviceRecap.map((item) => {
                    const pct = revenue > 0 ? (item.total / revenue) * 100 : 0;
                    return (
                      <div key={item.name} className="px-5 py-3.5">
                        <div className="flex items-center justify-between mb-1.5 gap-3">
                          <p className="text-xs font-medium text-gray-900">
                            {item.name}
                          </p>
                          <p className="text-xs font-bold text-gray-900">
                            {formatRupiah(item.total)}
                          </p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-black h-1.5 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {item.count}x · {Math.round(pct)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
