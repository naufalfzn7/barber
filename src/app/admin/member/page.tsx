"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmAction,
  useToastFeedback,
} from "@/components/ui/useToastFeedback";
import { formatIndonesianDateShort } from "@/lib/dateFormat";
import { authFetch } from "@/lib/authClient";

type Role = "ADMIN" | "SUPER_ADMIN";

type CatalogBranch = {
  id: string;
  name: string;
};

type MemberItem = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  branchId?: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
  generatedPassword?: {
    password: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export default function MemberPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [branches, setBranches] = useState<CatalogBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useToastFeedback({ message, error });

  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);

        const meRes = await authFetch("/api/auth/me");
        const me = (await meRes.json()) as {
          user?: { role?: Role; branchId?: string | null };
          message?: string;
        };

        if (!meRes.ok || !me.user?.role) {
          throw new Error(me.message ?? "Gagal memuat sesi");
        }

        setRole(me.user.role);

        const catalogRes = await authFetch("/api/bookings/catalog");
        const catalog = (await catalogRes.json()) as {
          branches?: CatalogBranch[];
          message?: string;
        };

        if (!catalogRes.ok) {
          throw new Error(catalog.message ?? "Gagal memuat cabang");
        }

        const list = catalog.branches ?? [];
        setBranches(list);

        const initialBranchId =
          me.user.role === "ADMIN"
            ? (me.user.branchId ?? list[0]?.id ?? "")
            : (list[0]?.id ?? "");

        setBranchId(initialBranchId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat halaman");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      if (!role) {
        return;
      }

      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (role === "SUPER_ADMIN" && branchId) {
        query.set("branchId", branchId);
      }

      const response = await authFetch(
        `/api/members${query.toString() ? `?${query.toString()}` : ""}`,
      );
      const json = (await response.json()) as {
        members?: MemberItem[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal memuat member");
      }

      setMembers(json.members ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat member");
    } finally {
      setLoading(false);
    }
  }, [role, branchId]);

  useEffect(() => {
    if (role && (role === "ADMIN" || branchId)) {
      loadMembers();
    }
  }, [role, branchId, loadMembers]);

  async function createMember() {
    if (!fullName || !email) {
      setError("Nama dan email wajib diisi");
      return;
    }

    const confirmed = await confirmAction({
      title: "Daftarkan member?",
      text: `Member ${fullName} akan dibuat dengan email ${email}.`,
      confirmButtonText: "Ya, daftarkan",
    });

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await authFetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phoneNumber: phoneNumber || undefined,
          branchId: role === "SUPER_ADMIN" ? branchId : undefined,
        }),
      });

      const json = (await response.json()) as {
        message?: string;
        temporaryPassword?: string;
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal membuat member");
      }

      setMessage(
        `${json.message ?? "Member created"}. Password sementara: ${json.temporaryPassword ?? "-"}`,
      );
      setShowAddModal(false);
      setFullName("");
      setEmail("");
      setPhoneNumber("");
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat member");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(memberId: string) {
    const member = members.find((item) => item.id === memberId);
    const confirmed = await confirmAction({
      title: "Reset password member?",
      text: `Password ${member?.fullName ?? "member ini"} akan diganti dan password sementara baru akan dibuat.`,
      confirmButtonText: "Ya, reset",
      icon: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setMessage(null);

      const response = await authFetch(`/api/members/${memberId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: role === "SUPER_ADMIN" ? branchId : undefined,
        }),
      });

      const json = (await response.json()) as {
        message?: string;
        temporaryPassword?: string;
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal reset password");
      }

      setMessage(
        `${json.message ?? "Password reset successful"}. Password baru: ${json.temporaryPassword ?? "-"}`,
      );
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reset password");
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

  async function updatePassword(member: MemberItem) {
    const password = window.prompt(
      `Password baru untuk ${member.fullName}`,
      member.generatedPassword?.password ?? "",
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
      const response = await authFetch(`/api/members/${member.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: password.trim(),
          branchId: role === "SUPER_ADMIN" ? branchId : undefined,
        }),
      });
      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal update password member");
      }

      setMessage("Password member diperbarui");
      await loadMembers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal update password member",
      );
    }
  }

  async function deletePassword(member: MemberItem) {
    const confirmed = await confirmAction({
      title: "Hapus password tersimpan?",
      text: `Password yang tampil untuk ${member.fullName} akan dihapus dari catatan. Password login saat ini tidak berubah.`,
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
      const response = await authFetch(`/api/members/${member.id}/password`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: role === "SUPER_ADMIN" ? branchId : undefined,
        }),
      });
      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal hapus password tersimpan");
      }

      setMessage("Password tersimpan dihapus");
      await loadMembers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal hapus password tersimpan",
      );
    }
  }

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const q = search.toLowerCase();
        return (
          member.fullName.toLowerCase().includes(q) ||
          member.email.toLowerCase().includes(q) ||
          (member.phoneNumber ?? "").includes(search)
        );
      }),
    [members, search],
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Kelola Member</h2>
          <p className="text-xs text-gray-500 mt-1">
            Data dari endpoint member API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="bg-black text-white rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Daftarkan Member
          </button>

          <button
            type="button"
            onClick={loadMembers}
            className="border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cari nama, email, atau nomor HP"
        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Nama
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Email
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Nomor HP
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Terdaftar
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Password
              </th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Loading...
                </td>
              </tr>
            )}

            {!loading && filteredMembers.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Tidak ada member
                </td>
              </tr>
            )}

            {!loading &&
              filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-gray-50 last:border-b-0"
                >
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">
                    {member.fullName}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {member.email}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {member.phoneNumber || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {formatIndonesianDateShort(member.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {member.isActive ? "Aktif" : "Nonaktif"}
                    {member.mustChangePassword ? " · Wajib ganti password" : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="font-mono max-w-36 truncate">
                        {member.generatedPassword?.password ?? "-"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyPassword(member.generatedPassword?.password)
                        }
                        className="px-2 py-1 text-[11px] rounded-md border border-gray-300 text-gray-700 font-semibold"
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => updatePassword(member)}
                        className="px-2.5 py-1.5 text-[11px] rounded-md border border-gray-300 text-gray-700 font-semibold"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePassword(member)}
                        className="px-2.5 py-1.5 text-[11px] rounded-md border border-red-100 bg-red-50 text-red-600 font-semibold"
                      >
                        Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(member.id)}
                        className="px-2.5 py-1.5 text-[11px] rounded-md border border-gray-900 bg-gray-900 text-white font-semibold"
                      >
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                Daftarkan Member Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs text-gray-500"
              >
                Tutup
              </button>
            </div>

            <label className="block">
              <span className="text-xs text-gray-500">Nama lengkap</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Nomor HP</span>
              <input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={createMember}
                disabled={saving}
                className="flex-1 bg-black text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Daftarkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
