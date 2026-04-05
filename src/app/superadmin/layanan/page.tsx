"use client";

import { useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/components/ui/useToastFeedback";

type BranchOption = {
  branchId: string;
  branchCode: string;
  branchName: string;
};

type ServiceItem = {
  id: string;
  code: string;
  name: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  price: string | number;
  durationMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: string;
  description: string;
  usageCount: number;
};

type FormState = {
  branchId: string;
  name: string;
  price: number;
  durationMinutes: number;
  bufferMinutes: number;
};

const initialForm: FormState = {
  branchId: "",
  name: "",
  price: 50000,
  durationMinutes: 45,
  bufferMinutes: 10,
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function LayananPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);

  useToastFeedback({ message, error });

  async function loadData() {
    try {
      setLoading(true);
      const [servicesRes, branchesRes] = await Promise.all([
        fetch("/api/superadmin/services"),
        fetch("/api/superadmin/branches"),
      ]);

      const servicesJson = (await servicesRes.json()) as ServiceItem[] & {
        message?: string;
      };
      const branchesJson = (await branchesRes.json()) as {
        branches?: BranchOption[];
        message?: string;
      };

      if (!servicesRes.ok) {
        throw new Error(servicesJson.message ?? "Gagal memuat layanan");
      }

      if (!branchesRes.ok) {
        throw new Error(branchesJson.message ?? "Gagal memuat cabang");
      }

      setServices(servicesJson);
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
      setError(err instanceof Error ? err.message : "Gagal memuat layanan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(services.map((service) => service.category)),
    );
    return ["all", ...values];
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (filterBranch !== "all" && service.branchId !== filterBranch) {
        return false;
      }
      if (filterCategory !== "all" && service.category !== filterCategory) {
        return false;
      }
      return true;
    });
  }, [services, filterBranch, filterCategory]);

  function openCreateModal() {
    setEditingId(null);
    setForm((current) => ({
      ...initialForm,
      branchId: current.branchId || branches[0]?.branchId || "",
    }));
    setShowModal(true);
  }

  function openEditModal(service: ServiceItem) {
    setEditingId(service.id);
    setForm({
      branchId: service.branchId,
      name: service.name,
      price: Number(service.price),
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
    });
    setShowModal(true);
  }

  async function saveService() {
    if (!form.branchId || !form.name) {
      setError("Cabang dan nama layanan wajib diisi");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        editingId
          ? `/api/superadmin/services/${editingId}`
          : "/api/superadmin/services",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: form.branchId,
            name: form.name,
            price: form.price,
            durationMinutes: form.durationMinutes,
            bufferMinutes: form.bufferMinutes,
          }),
        },
      );

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal menyimpan layanan");
      }

      setMessage(editingId ? "Layanan diperbarui" : "Layanan dibuat");
      setShowModal(false);
      setEditingId(null);
      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan layanan");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: ServiceItem) {
    try {
      setError(null);
      setMessage(null);
      const response = await fetch(`/api/superadmin/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !service.isActive }),
      });
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal update status layanan");
      }
      setMessage(json.message ?? "Status layanan diperbarui");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal update status layanan",
      );
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Kelola Layanan</h2>
          <p className="text-xs text-gray-500 mt-1">
            Master layanan, harga, dan durasi disajikan langsung dari database.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-black text-white text-xs font-semibold tracking-wide rounded-lg hover:bg-gray-800 transition-colors"
        >
          + TAMBAH LAYANAN
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
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
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="all">Semua Kategori</option>
          {categories
            .filter((category) => category !== "all")
            .map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
        </select>

        <div className="ml-auto text-xs text-gray-400">
          {filteredServices.length} layanan ditemukan
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">
                  {service.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {service.description}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {service.branchName} · {service.branchCode}
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded-full font-semibold ml-2 shrink-0 ${
                  service.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {service.isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                  Kategori
                </p>
                <p className="text-xs font-semibold text-gray-900 capitalize">
                  {service.category}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                  Durasi
                </p>
                <p className="text-xs font-bold text-gray-900">
                  {service.durationMinutes} mnt
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                  Harga
                </p>
                <p className="text-xs font-bold text-gray-900">
                  {formatRupiah(Number(service.price))}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(service)}
                className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(service)}
                className={`flex-1 text-xs px-3 py-2 rounded-lg transition-colors ${
                  service.isActive
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                }`}
              >
                {service.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredServices.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">Tidak ada layanan ditemukan</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-3">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? "Edit Layanan" : "Tambah Layanan Baru"}
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
                Nama Layanan
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Harga
                </label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: Number(event.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Durasi
                </label>
                <input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      durationMinutes: Number(event.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Buffer
              </label>
              <input
                type="number"
                value={form.bufferMinutes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    bufferMinutes: Number(event.target.value),
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
                onClick={saveService}
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
