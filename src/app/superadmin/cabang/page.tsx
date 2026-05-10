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

type FormMode = "create" | "edit" | null;
type EditingBranch = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  isActive: boolean;
};

export default function CabangPage() {
  const [data, setData] = useState<BranchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingBranch, setEditingBranch] = useState<EditingBranch | null>(
    null,
  );
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    timezone: "Asia/Jakarta",
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useToastFeedback({ error, success });

  const loadBranches = async () => {
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
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat cabang";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  const handleOpenCreateForm = () => {
    setFormData({
      code: "",
      name: "",
      timezone: "Asia/Jakarta",
      isActive: true,
    });
    setEditingBranch(null);
    setFormMode("create");
  };

  const handleOpenEditForm = (branch: BranchSummary) => {
    setEditingBranch({
      id: branch.branchId,
      code: branch.branchCode,
      name: branch.branchName,
      timezone: branch.timezone,
      isActive: branch.isActive,
    });
    setFormData({
      code: branch.branchCode,
      name: branch.branchName,
      timezone: branch.timezone,
      isActive: branch.isActive,
    });
    setFormMode("edit");
  };

  const handleCloseForm = () => {
    setFormMode(null);
    setEditingBranch(null);
    setFormData({
      code: "",
      name: "",
      timezone: "Asia/Jakarta",
      isActive: true,
    });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim() || !formData.name.trim()) {
      setError("Code dan Name harus diisi");
      return;
    }

    setSubmitting(true);
    try {
      if (formMode === "create") {
        const response = await fetch("/api/superadmin/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: formData.code.trim(),
            name: formData.name.trim(),
            timezone: formData.timezone,
          }),
        });

        const json = (await response.json()) as { message?: string };
        if (!response.ok) {
          throw new Error(json.message ?? "Gagal membuat cabang");
        }

        setSuccess("Cabang berhasil dibuat");
        handleCloseForm();
        await loadBranches();
      } else if (formMode === "edit" && editingBranch) {
        const response = await fetch(
          `/api/superadmin/branches/${editingBranch.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formData.name.trim(),
              timezone: formData.timezone,
              isActive: formData.isActive,
            }),
          },
        );

        const json = (await response.json()) as { message?: string };
        if (!response.ok) {
          throw new Error(json.message ?? "Gagal mengupdate cabang");
        }

        setSuccess("Cabang berhasil diupdate");
        handleCloseForm();
        await loadBranches();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Operasi gagal";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Yakin hapus cabang "${branchName}"?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/superadmin/branches/${branchId}`, {
        method: "DELETE",
      });

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal menghapus cabang");
      }

      setSuccess("Cabang berhasil dihapus");
      await loadBranches();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Operasi gagal";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 px-3 py-1 rounded-full bg-gray-100">
            Tanggal {data?.date ? formatIndonesianDate(data.date) : "-"}
          </div>
          <button
            onClick={handleOpenCreateForm}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
          >
            + Tambah Cabang
          </button>
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

                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-600 mb-4">
                  <p>Total booking: {branch.totalBookings}</p>
                  <p>Selesai: {branch.completedBookings}</p>
                  <p>Pendapatan: {formatRupiah(branch.revenue)}</p>
                  <p>Top service: {branch.topService}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEditForm(branch)}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      handleDeleteBranch(branch.branchId, branch.branchName)
                    }
                    disabled={submitting}
                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Form */}
      {formMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {formMode === "create" ? "Tambah Cabang Baru" : "Edit Cabang"}
            </h3>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Code Cabang
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  disabled={formMode === "edit"}
                  placeholder="e.g., SKA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nama Cabang
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Surakarta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  placeholder="e.g., Asia/Jakarta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {formMode === "edit" && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="rounded"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Aktif
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
