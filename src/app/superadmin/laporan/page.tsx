"use client";

import { useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/components/ui/useToastFeedback";
import {
  formatIndonesianDate,
  formatIndonesianDateTime,
} from "@/lib/dateFormat";

type ReportRow = {
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

type ReportResponse = {
  rangeKey: string;
  rangeLabel: string;
  periodStart: string;
  summary: {
    revenue: number;
    bookings: number;
    completed: number;
    qris: number;
    cash: number;
    activeBranches: number;
    lowStockAlerts: number;
  };
  today: ReportRow[];
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

type ExportState = "excel" | "pdf" | null;

const rangeOptions = [
  { value: "today", label: "Hari Ini" },
  { value: "week", label: "7 Hari Terakhir" },
  { value: "month", label: "30 Hari Terakhir" },
];

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function buildFileStamp(dateRange: string) {
  return `laporan-superadmin-${dateRange}-${new Date().toISOString().slice(0, 10)}`;
}

function getRangeLabel(value: string) {
  return rangeOptions.find((item) => item.value === value)?.label ?? value;
}

export default function LaporanPage() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [dateRange, setDateRange] = useState("today");
  const [exporting, setExporting] = useState<ExportState>(null);

  useToastFeedback({ error });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const searchParams = new URLSearchParams();
        searchParams.set("range", dateRange);
        const response = await fetch(
          `/api/superadmin/reports?${searchParams.toString()}`,
        );
        const json = (await response.json()) as ReportResponse & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(json.message ?? "Gagal memuat laporan");
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat laporan");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [dateRange]);

  const branches = useMemo(
    () => [
      ...new Map(
        (data?.today ?? []).map((branch) => [branch.branchId, branch]),
      ).values(),
    ],
    [data?.today],
  );

  const visibleToday = useMemo(() => {
    if (selectedBranch === "all") return data?.today ?? [];
    return (data?.today ?? []).filter(
      (branch) => branch.branchId === selectedBranch,
    );
  }, [data?.today, selectedBranch]);

  const visibleMonthlyRevenue = useMemo(() => {
    return (data?.monthlyRevenue ?? []).map((month) => {
      const branchesForSelection =
        selectedBranch === "all"
          ? month.branches
          : month.branches.filter(
              (branch) => branch.branchId === selectedBranch,
            );

      return {
        ...month,
        total: branchesForSelection.reduce((sum, item) => sum + item.total, 0),
        branches: branchesForSelection,
      };
    });
  }, [data?.monthlyRevenue, selectedBranch]);

  const totalMonthlyRevenue = visibleMonthlyRevenue.reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const avgMonthly = visibleMonthlyRevenue.length
    ? totalMonthlyRevenue / visibleMonthlyRevenue.length
    : 0;
  const maxMonthlyRevenue = Math.max(
    ...visibleMonthlyRevenue.map((item) => item.total),
    1,
  );

  const summaryRevenue = visibleToday.reduce(
    (sum, branch) => sum + branch.revenue,
    0,
  );
  const summaryBookings = visibleToday.reduce(
    (sum, branch) => sum + branch.totalBookings,
    0,
  );
  const summaryCompleted = visibleToday.reduce(
    (sum, branch) => sum + branch.completedBookings,
    0,
  );
  const summaryQris = visibleToday.reduce(
    (sum, branch) => sum + branch.qrisRevenue,
    0,
  );
  const summaryCash = visibleToday.reduce(
    (sum, branch) => sum + branch.cashRevenue,
    0,
  );
  const averageTicket =
    summaryBookings > 0 ? summaryRevenue / summaryBookings : 0;
  const completionRate =
    summaryBookings > 0 ? (summaryCompleted / summaryBookings) * 100 : 0;
  const qrisShare =
    summaryRevenue > 0 ? (summaryQris / summaryRevenue) * 100 : 0;
  const cashShare =
    summaryRevenue > 0 ? (summaryCash / summaryRevenue) * 100 : 0;

  async function handleExportExcel() {
    if (!data) return;

    try {
      setExporting("excel");
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.aoa_to_sheet([
        ["Periode", data.rangeLabel],
        ["Rentang Mulai", formatIndonesianDate(data.periodStart)],
        ["Total Pendapatan", summaryRevenue],
        ["Total Booking", summaryBookings],
        ["Booking Selesai", summaryCompleted],
        ["Completion Rate", formatPercent(completionRate)],
        ["Average Ticket", averageTicket],
        ["QRIS Share", formatPercent(qrisShare)],
        ["Cash Share", formatPercent(cashShare)],
      ]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

      const comparisonSheet = XLSX.utils.json_to_sheet(
        visibleToday
          .slice()
          .sort((a, b) => b.revenue - a.revenue)
          .map((branch) => ({
            Cabang: branch.branchName,
            Kode: branch.branchCode,
            Timezone: branch.timezone,
            Booking: branch.totalBookings,
            Selesai: branch.completedBookings,
            Pendapatan: branch.revenue,
            QRIS: branch.qrisRevenue,
            Cash: branch.cashRevenue,
            "Top Service": branch.topService,
            "Low Stock": branch.lowStockCount,
          })),
      );
      XLSX.utils.book_append_sheet(
        workbook,
        comparisonSheet,
        "Perbandingan Cabang",
      );

      const monthlySheet = XLSX.utils.json_to_sheet(
        visibleMonthlyRevenue.map((month) => ({
          Bulan: month.month,
          Total: month.total,
          Cabang: month.branches.map((branch) => branch.branchName).join(", "),
        })),
      );
      XLSX.utils.book_append_sheet(workbook, monthlySheet, "Tren 6 Bulan");

      const alertSheet = XLSX.utils.json_to_sheet(
        (data.alerts ?? []).map((alert) => ({
          Cabang: alert.branchName,
          Produk: alert.productName,
          "Stok Saat Ini": alert.currentStock,
          "Minimum Stok": alert.minStock,
        })),
      );
      XLSX.utils.book_append_sheet(workbook, alertSheet, "Alert Stok");

      XLSX.writeFile(workbook, `${buildFileStamp(dateRange)}.xlsx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export Excel");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    if (!data) return;

    try {
      setExporting("pdf");
      const jsPDFModule = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const doc = new jsPDFModule.jsPDF({ orientation: "landscape" });
      const autoTable = autoTableModule.default;

      doc.setFontSize(16);
      doc.text("Laporan Keuangan Super Admin", 14, 16);
      doc.setFontSize(10);
      doc.text(`Periode: ${data.rangeLabel}`, 14, 23);
      doc.text(`Dibuat: ${formatIndonesianDateTime(new Date())}`, 14, 29);

      autoTable(doc, {
        startY: 35,
        head: [["Metrik", "Nilai"]],
        body: [
          ["Total Pendapatan", formatRupiah(summaryRevenue)],
          ["Total Booking", String(summaryBookings)],
          ["Booking Selesai", String(summaryCompleted)],
          ["Completion Rate", formatPercent(completionRate)],
          ["Average Ticket", formatRupiah(averageTicket)],
          ["QRIS Share", formatPercent(qrisShare)],
          ["Cash Share", formatPercent(cashShare)],
        ],
      });

      const comparisonStart =
        (doc as unknown as { lastAutoTable?: { finalY?: number } })
          .lastAutoTable?.finalY ?? 70;
      autoTable(doc, {
        startY: comparisonStart + 8,
        head: [
          [
            "Cabang",
            "Booking",
            "Selesai",
            "Pendapatan",
            "QRIS",
            "Cash",
            "Top Service",
          ],
        ],
        body: visibleToday
          .slice()
          .sort((a, b) => b.revenue - a.revenue)
          .map((branch) => [
            `${branch.branchName} (${branch.branchCode})`,
            String(branch.totalBookings),
            String(branch.completedBookings),
            formatRupiah(branch.revenue),
            formatRupiah(branch.qrisRevenue),
            formatRupiah(branch.cashRevenue),
            branch.topService,
          ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [25, 25, 25] },
      });

      const monthlyStart =
        (doc as unknown as { lastAutoTable?: { finalY?: number } })
          .lastAutoTable?.finalY ?? 140;
      autoTable(doc, {
        startY: monthlyStart + 8,
        head: [["Bulan", "Total", "Cabang"]],
        body: visibleMonthlyRevenue.map((month) => [
          month.month,
          formatRupiah(month.total),
          month.branches
            .map(
              (branch) => `${branch.branchName}: ${formatRupiah(branch.total)}`,
            )
            .join(" | "),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [74, 110, 122] },
      });

      const alertStart =
        (doc as unknown as { lastAutoTable?: { finalY?: number } })
          .lastAutoTable?.finalY ?? 200;
      autoTable(doc, {
        startY: alertStart + 8,
        head: [["Cabang", "Produk", "Stok Saat Ini", "Minimum"]],
        body: (data.alerts ?? []).map((alert) => [
          alert.branchName,
          alert.productName,
          String(alert.currentStock),
          String(alert.minStock),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [153, 27, 27] },
      });

      doc.save(`${buildFileStamp(dateRange)}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export PDF");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Laporan Keuangan</h2>
          <p className="text-xs text-gray-500 mt-1">
            Semua angka ditarik dari transaksi dan booking di database.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
            {data?.rangeLabel ?? getRangeLabel(dateRange)}
          </span>
          <button
            onClick={handleExportExcel}
            disabled={!data || exporting !== null}
            className="px-4 py-2 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting === "excel" ? "Mengekspor..." : "Export Excel"}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!data || exporting !== null}
            className="px-4 py-2 bg-black text-white text-xs font-semibold tracking-wide rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {exporting === "pdf" ? "Mengekspor..." : "Export PDF"}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">Semua Cabang</option>
              {branches.map((branch) => (
                <option key={branch.branchId} value={branch.branchId}>
                  {branch.branchName}
                </option>
              ))}
            </select>

            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-linear-to-br from-violet-500 to-purple-600 text-white rounded-xl p-5 shadow-lg">
              <p className="text-xs opacity-80 uppercase tracking-wide mb-1">
                Total Pendapatan
              </p>
              <p className="text-2xl font-bold">
                {formatRupiah(summaryRevenue)}
              </p>
              <p className="text-xs opacity-70 mt-1">
                {data.rangeLabel} ·{" "}
                {selectedBranch === "all" ? "Semua cabang" : "1 cabang"}
              </p>
            </div>

            <div className="bg-linear-to-br from-blue-500 to-cyan-600 text-white rounded-xl p-5 shadow-lg">
              <p className="text-xs opacity-80 uppercase tracking-wide mb-1">
                Total Transaksi
              </p>
              <p className="text-2xl font-bold">{summaryCompleted}</p>
              <p className="text-xs opacity-70 mt-1">
                dari {summaryBookings} booking
              </p>
            </div>

            <div className="bg-linear-to-br from-emerald-500 to-green-600 text-white rounded-xl p-5 shadow-lg">
              <p className="text-xs opacity-80 uppercase tracking-wide mb-1">
                QRIS
              </p>
              <p className="text-2xl font-bold">{formatRupiah(summaryQris)}</p>
              <p className="text-xs opacity-70 mt-1">
                {formatPercent(qrisShare)} dari total
              </p>
            </div>

            <div className="bg-linear-to-br from-amber-500 to-orange-600 text-white rounded-xl p-5 shadow-lg">
              <p className="text-xs opacity-80 uppercase tracking-wide mb-1">
                Average Ticket
              </p>
              <p className="text-2xl font-bold">
                {formatRupiah(averageTicket)}
              </p>
              <p className="text-xs opacity-70 mt-1">
                Completion rate {formatPercent(completionRate)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                Cash Share
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatPercent(cashShare)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                Completion Rate
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatPercent(completionRate)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                Active Branches
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {data.summary.activeBranches}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                Low Stock Alerts
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {data.summary.lowStockAlerts}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                Tren Pendapatan 6 Bulan
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Total: {formatRupiah(totalMonthlyRevenue)} · Rata-rata:{" "}
                {formatRupiah(avgMonthly)}/bulan
              </p>
            </div>
            <div className="p-5 space-y-3">
              {visibleMonthlyRevenue.length === 0 && (
                <p className="text-xs text-gray-500">
                  Belum ada data pendapatan bulanan.
                </p>
              )}
              {visibleMonthlyRevenue.map((month) => (
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
                    {month.branches.map((branch) => (
                      <div
                        key={branch.branchId}
                        className="h-2.5 bg-[#4a6e7a]"
                        style={{
                          width: `${(branch.total / maxMonthlyRevenue) * 100}%`,
                        }}
                        title={`${branch.branchName}: ${formatRupiah(branch.total)}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {month.branches.map((branch) => (
                      <span
                        key={branch.branchId}
                        className="text-[10px] text-gray-400"
                      >
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
                Perbandingan Cabang {data.rangeLabel}
              </h3>
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
                    <th className="text-center text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                      Selesai
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                      Pendapatan
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                      QRIS
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                      Cash
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3">
                      Top Service
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleToday
                    .slice()
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((branch) => (
                      <tr
                        key={branch.branchId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <p className="text-xs font-medium text-gray-900">
                            {branch.branchName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {branch.branchCode} · {branch.timezone}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="text-xs font-semibold text-gray-900">
                            {branch.totalBookings}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="text-xs text-gray-600">
                            {branch.completedBookings}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-xs font-bold text-gray-900">
                            {formatRupiah(branch.revenue)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-xs text-gray-600">
                            {formatRupiah(branch.qrisRevenue)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-xs text-gray-600">
                            {formatRupiah(branch.cashRevenue)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-center text-xs text-gray-600">
                          {branch.topService}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td className="px-5 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Total
                    </td>
                    <td className="px-5 py-3 text-center text-sm font-bold text-gray-900">
                      {visibleToday.reduce(
                        (sum, branch) => sum + branch.totalBookings,
                        0,
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-sm font-bold text-gray-900">
                      {visibleToday.reduce(
                        (sum, branch) => sum + branch.completedBookings,
                        0,
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                      {formatRupiah(
                        visibleToday.reduce(
                          (sum, branch) => sum + branch.revenue,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                      {formatRupiah(
                        visibleToday.reduce(
                          (sum, branch) => sum + branch.qrisRevenue,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                      {formatRupiah(
                        visibleToday.reduce(
                          (sum, branch) => sum + branch.cashRevenue,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                </tfoot>
              </table>
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
              {data.alerts.slice(0, 8).map((alert) => (
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
        </>
      )}
    </div>
  );
}
