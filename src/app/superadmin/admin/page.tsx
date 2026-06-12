"use client";

import { useEffect, useMemo, useState } from "react";
import {
  confirmAction,
  useToastFeedback,
} from "@/components/ui/useToastFeedback";
import { formatIndonesianDateTime } from "@/lib/dateFormat";
import { authFetch } from "@/lib/authClient";

type BranchOption = {
  branchId: string;
  branchCode: string;
  branchName: string;
};

type AdminItem = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  branchId: string | null;
  branchName: string;
  branchCode: string;
  timezone: string;
  jobTitle: string | null;
  generatedPassword?: {
    password: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type AdminResponse = AdminItem[];

type FormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  branchId: string;
  jobTitle: string;
};

const initialForm: FormState = {
  fullName: "",
  email: "",
  phoneNumber: "",
  branchId: "",
  jobTitle: "Admin",
};

export default function AdminPage() {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useToastFeedback({
    message,
    error,
    onMessageShown: () => setMessage(null),
    onErrorShown: () => setError(null),
  });

  async function loadData() {
    try {
      setLoading(true);
      const [adminsRes, branchesRes] = await Promise.all([
        authFetch("/api/superadmin/admins"),
        authFetch("/api/superadmin/branches"),
      ]);

      const adminsJson = (await adminsRes.json()) as AdminResponse & {
        message?: string;
      };
      const branchesJson = (await branchesRes.json()) as {
        branches?: BranchOption[];
        message?: string;
      };

      if (!adminsRes.ok) {
        throw new Error(adminsJson.message ?? "Gagal memuat admin");
      }

      if (!branchesRes.ok) {
        throw new Error(branchesJson.message ?? "Gagal memuat cabang");
      }

      setAdmins(adminsJson);
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
      setError(err instanceof Error ? err.message : "Gagal memuat admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredAdmins = useMemo(() => {
    return admins.filter((admin) => {
      if (filterBranch !== "all" && admin.branchId !== filterBranch) {
        return false;
      }

      if (filterStatus === "active" && !admin.isActive) {
        return false;
      }

      if (filterStatus === "inactive" && admin.isActive) {
        return false;
      }

      return true;
    });
  }, [admins, filterBranch, filterStatus]);

  function openCreateModal() {
    setEditingId(null);
    setForm((current) => ({
      ...initialForm,
      branchId: current.branchId || branches[0]?.branchId || "",
    }));
    setShowModal(true);
  }

  function openEditModal(admin: AdminItem) {
    setEditingId(admin.id);
    setForm({
      fullName: admin.fullName,
      email: admin.email,
      phoneNumber: admin.phoneNumber ?? "",
      branchId: admin.branchId ?? "",
      jobTitle: admin.jobTitle ?? "Admin",
    });
    setShowModal(true);
  }

  async function saveAdmin() {
    if (!form.fullName || !form.email || !form.branchId) {
      setError("Nama, email, dan cabang wajib diisi");
      return;
    }

    const confirmed = await confirmAction({
      title: editingId ? "Simpan perubahan admin?" : "Tambah admin?",
      text: editingId
        ? `Data admin ${form.fullName} akan diperbarui.`
        : `Admin ${form.fullName} akan dibuat.`,
      confirmButtonText: editingId ? "Ya, simpan" : "Ya, tambah",
    });

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await authFetch(
        editingId
          ? `/api/superadmin/admins/${editingId}`
          : "/api/superadmin/admins",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            phoneNumber: form.phoneNumber || undefined,
            branchId: form.branchId,
            jobTitle: form.jobTitle || undefined,
          }),
        },
      );

      const json = (await response.json()) as {
        message?: string;
        result?: { temporaryPassword?: string };
      };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal menyimpan admin");
      }

      setMessage(
        editingId
          ? "Admin berhasil diperbarui"
          : `Admin berhasil dibuat. Temporary password: ${json.result?.temporaryPassword ?? "-"}`,
      );
      setShowModal(false);
      setEditingId(null);
      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan admin");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(admin: AdminItem) {
    const confirmed = await confirmAction({
      title: admin.isActive ? "Nonaktifkan admin?" : "Aktifkan admin?",
      text: `Status admin ${admin.fullName} akan diubah.`,
      confirmButtonText: admin.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan",
      icon: "warning",
      danger: admin.isActive,
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setMessage(null);
      const response = await authFetch(`/api/superadmin/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal update status admin");
      }
      setMessage(json.message ?? "Status admin diperbarui");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal update status admin",
      );
    }
  }

  async function copyPassword(password?: string | null) {
    if (!password) {
      setError("Password belum tersimpan");
      return;
    }

    await navigator.clipboard.writeText(password);
    setMessage("Password disalin");
  }

  async function resetPassword(admin: AdminItem) {
    const confirmed = await confirmAction({
      title: "Reset password admin?",
      text: `Password ${admin.fullName} akan diganti dan disimpan permanen.`,
      confirmButtonText: "Ya, reset",
      icon: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setMessage(null);
      const response = await authFetch(
        `/api/superadmin/admins/${admin.id}/reset-password`,
        { method: "POST" },
      );
      const json = (await response.json()) as {
        message?: string;
        result?: { temporaryPassword?: string };
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal reset password admin");
      }

      setMessage(
        `${json.message ?? "Password admin direset"}. Password baru: ${json.result?.temporaryPassword ?? "-"}`,
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal reset password admin",
      );
    }
  }

  async function updatePassword(admin: AdminItem) {
    const password = window.prompt(
      `Password baru untuk ${admin.fullName}`,
      admin.generatedPassword?.password ?? "",
    );
    if (password === null) {
      return;
    }

    if (password.trim().length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    try {
      setError(null);
      setMessage(null);
      const response = await authFetch(
        `/api/superadmin/admins/${admin.id}/password`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password.trim() }),
        },
      );
      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal update password admin");
      }

      setMessage("Password admin diperbarui");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal update password admin",
      );
    }
  }

  async function deletePassword(admin: AdminItem) {
    const confirmed = await confirmAction({
      title: "Hapus password tersimpan?",
      text: `Password yang tampil untuk ${admin.fullName} akan dihapus dari catatan. Password login saat ini tidak berubah.`,
      confirmButtonText: "Ya, hapus",
      icon: "warning",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setMessage(null);
      const response = await authFetch(
        `/api/superadmin/admins/${admin.id}/password`,
        { method: "DELETE" },
      );
      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal hapus password tersimpan");
      }

      setMessage("Password tersimpan dihapus");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal hapus password tersimpan",
      );
    }
  }

  async function deleteAdmin(adminId: string) {
    const admin = admins.find((item) => item.id === adminId);
    const confirmed = await confirmAction({
      title: "Hapus admin?",
      text: `Admin ${admin?.fullName ?? "ini"} akan dihapus dan tidak bisa dikembalikan.`,
      confirmButtonText: "Ya, hapus",
      icon: "warning",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);
      setMessage(null);
      const response = await authFetch(`/api/superadmin/admins/${adminId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal hapus admin");
      }
      setMessage("Admin berhasil dihapus");
      setDeletingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal hapus admin");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Kelola Admin</h2>
          <p className="text-xs text-gray-500 mt-1">
            Data akun admin berasal dari database dan bisa diaktifkan atau
            diperbarui.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-black text-white text-xs font-semibold tracking-wide rounded-lg hover:bg-gray-800 transition-colors"
        >
          + TAMBAH ADMIN
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
          {filteredAdmins.length} admin ditemukan
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredAdmins.map((admin) => (
          <div
            key={admin.id}
            className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {admin.fullName}
                </p>
                <p className="text-xs text-gray-500">{admin.email}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {admin.branchName} · {admin.branchCode} · {admin.timezone}
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                  admin.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {admin.isActive ? "AKTIF" : "NONAKTIF"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                  Role
                </p>
                <p className="text-xs font-bold text-gray-900 uppercase">
                  {admin.role}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                  Job Title
                </p>
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {admin.jobTitle ?? "-"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                  Must Change
                </p>
                <p className="text-xs font-semibold text-gray-900">
                  {admin.mustChangePassword ? "Ya" : "Tidak"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                  Updated
                </p>
                <p className="text-[10px] font-semibold text-gray-700">
                  {formatIndonesianDateTime(admin.updatedAt)}
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                    Password Tersimpan
                  </p>
                  <p className="font-mono text-xs font-semibold text-gray-900 truncate">
                    {admin.generatedPassword?.password ?? "-"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    copyPassword(admin.generatedPassword?.password)
                  }
                  className="text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700"
                >
                  Copy
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => updatePassword(admin)}
                  className="text-[11px] px-2 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700"
                >
                  Ubah
                </button>
                <button
                  onClick={() => deletePassword(admin)}
                  className="text-[11px] px-2 py-1.5 rounded-md border border-red-100 bg-red-50 text-red-600"
                >
                  Hapus
                </button>
                <button
                  onClick={() => resetPassword(admin)}
                  className="text-[11px] px-2 py-1.5 rounded-md border border-gray-900 bg-gray-900 text-white"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(admin)}
                className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit Info
              </button>
              <button
                onClick={() => toggleActive(admin)}
                className={`flex-1 text-xs px-3 py-2 rounded-lg transition-colors ${
                  admin.isActive
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                }`}
              >
                {admin.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
              <button
                onClick={() => deleteAdmin(admin.id)}
                className="flex-1 text-xs px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredAdmins.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">Tidak ada admin ditemukan</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-3">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? "Edit Admin" : "Tambah Admin Baru"}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
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
                Job Title
              </label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    jobTitle: event.target.value,
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
                onClick={saveAdmin}
                disabled={saving}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Hapus Admin</h3>
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus admin ini? Tindakan ini tidak
              dapat dibatalkan.
            </p>
            <div className="flex items-center gap-2 pt-3">
              <button
                onClick={() => setDeletingId(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => deleteAdmin(deletingId)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
