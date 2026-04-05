"use client";

import { useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/components/ui/useToastFeedback";

type BranchOption = {
  branchId: string;
  branchCode: string;
  branchName: string;
};

type BarbermanItem = {
  id: string;
  name: string;
  code: string;
  phoneNumber: string | null;
  isActive: boolean;
  defaultDuration: number;
  createdAt: string;
  updatedAt: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  specialization: string[];
  totalServices: number;
  avgServicesPerMonth: number;
};

type FormState = {
  branchId: string;
  name: string;
  phoneNumber: string;
  defaultDuration: number;
};

const initialForm: FormState = {
  branchId: "",
  name: "",
  phoneNumber: "",
  defaultDuration: 60,
};

export default function BarbermanPage() {
  const [barbermen, setBarbermen] = useState<BarbermanItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);

  useToastFeedback({ message, error });

  async function loadData() {
    try {
      setLoading(true);
      const [barberRes, branchesRes] = await Promise.all([
        fetch("/api/superadmin/barbermen"),
        fetch("/api/superadmin/branches"),
      ]);

      const barberJson = (await barberRes.json()) as BarbermanItem[] & {
        message?: string;
      };
      const branchesJson = (await branchesRes.json()) as {
        branches?: BranchOption[];
        message?: string;
      };

      if (!barberRes.ok) {
        throw new Error(barberJson.message ?? "Gagal memuat barberman");
      }

      if (!branchesRes.ok) {
        throw new Error(branchesJson.message ?? "Gagal memuat cabang");
      }

      setBarbermen(barberJson);
      setBranches(
        (branchesJson.branches ?? []).map((branch) => ({
          branchId: branch.branchId,
          branchCode: branch.branchCode,
          branchName: branch.branchName,
        })),
      );
      setForm((current) =>
        current.branchId || (branchesJson.branches ?? [])[0]
          ? current
          : {
              ...current,
              branchId: (branchesJson.branches ?? [])[0]?.branchId ?? "",
            },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat barberman");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredBarbers = useMemo(() => {
    return barbermen.filter((barberman) => {
      if (filterBranch !== "all" && barberman.branchId !== filterBranch) {
        return false;
      }
      if (filterStatus === "active" && !barberman.isActive) {
        return false;
      }
      if (filterStatus === "inactive" && barberman.isActive) {
        return false;
      }
      return true;
    });
  }, [barbermen, filterBranch, filterStatus]);

  function openCreateModal() {
    setEditingId(null);
    setForm((current) => ({
      ...initialForm,
      branchId: current.branchId || branches[0]?.branchId || "",
    }));
    setShowModal(true);
  }

  function openEditModal(barberman: BarbermanItem) {
    setEditingId(barberman.id);
    setForm({
      branchId: barberman.branchId,
      name: barberman.name,
      phoneNumber: barberman.phoneNumber ?? "",
      defaultDuration: barberman.defaultDuration,
    });
    setShowModal(true);
  }

  async function saveBarberman() {
    if (!form.branchId || !form.name) {
      setError("Cabang dan nama wajib diisi");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        editingId
          ? `/api/superadmin/barbermen/${editingId}`
          : "/api/superadmin/barbermen",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: form.branchId,
            name: form.name,
            phoneNumber: form.phoneNumber || undefined,
            defaultDuration: form.defaultDuration,
          }),
        },
      );

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal menyimpan barberman");
      }

      setMessage(editingId ? "Barberman diperbarui" : "Barberman dibuat");
      setShowModal(false);
      setEditingId(null);
      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan barberman",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(barberman: BarbermanItem) {
    try {
      setError(null);
      setMessage(null);
      const response = await fetch(
        `/api/superadmin/barbermen/${barberman.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !barberman.isActive }),
        },
      );
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal update status barberman");
      }
      setMessage(json.message ?? "Status barberman diperbarui");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal update status barberman",
      );
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Kelola Barberman</h2>
          <p className="text-xs text-gray-500 mt-1">
            Daftar barberman diambil dari database dan bisa ditambah atau
            diaktifkan/nonaktifkan.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-black text-white text-xs font-semibold tracking-wide rounded-lg hover:bg-gray-800 transition-colors"
        >
          + TAMBAH BARBERMAN
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
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
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>

        <div className="ml-auto text-xs text-gray-400">
          {filteredBarbers.length} barberman ditemukan
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBarbers.map((barberman) => (
          <div
            key={barberman.id}
            className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {barberman.name}
                </p>
                <p className="text-xs text-gray-500">{barberman.branchName}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {barberman.code} · default {barberman.defaultDuration} menit
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                  barberman.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {barberman.isActive ? "AKTIF" : "NONAKTIF"}
              </span>
            </div>

            <div className="mb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
                Spesialisasi dari booking selesai
              </p>
              <div className="flex flex-wrap gap-1">
                {barberman.specialization.length === 0 && (
                  <span className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    Belum ada data
                  </span>
                )}
                {barberman.specialization.map((spec) => (
                  <span
                    key={spec}
                    className="text-[10px] px-2 py-1 bg-gray-100 text-gray-700 rounded-full"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                  Total
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {barberman.totalServices}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                  Avg / Bulan
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {barberman.avgServicesPerMonth}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                  Joined
                </p>
                <p className="text-[10px] font-semibold text-gray-700">
                  {new Date(barberman.createdAt).getFullYear()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(barberman)}
                className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(barberman)}
                className={`flex-1 text-xs px-3 py-2 rounded-lg transition-colors ${
                  barberman.isActive
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                }`}
              >
                {barberman.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredBarbers.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">Tidak ada barberman ditemukan</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-3">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? "Edit Barberman" : "Tambah Barberman Baru"}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Cabang
              </label>
              <select
                value={form.branchId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    branchId: event.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {branches.map((branch) => (
                  <option key={branch.branchId} value={branch.branchId}>
                    {branch.branchName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nama Barberman
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nomor HP
              </label>
              <input
                type="text"
                value={form.phoneNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phoneNumber: event.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Default Duration (menit)
              </label>
              <input
                type="number"
                value={form.defaultDuration}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultDuration: Number(event.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex items-center gap-2 pt-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={saveBarberman}
                disabled={saving}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
