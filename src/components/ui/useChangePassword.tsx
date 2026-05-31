"use client";

import { useState } from "react";
import { authFetch } from "@/lib/authClient";
import { confirmAction } from "./useToastFeedback";
import Swal from "sweetalert2";

export function useChangePassword() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleChangePassword() {
    if (!oldPassword || !newPassword || !confirmPassword) {
      void Swal.fire({
        title: "Semua field wajib diisi",
        text: "Mohon lengkapi password lama, password baru, dan konfirmasi password.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
      return;
    }

    if (newPassword.length < 6) {
      void Swal.fire({
        title: "Password baru minimal 6 karakter",
        text: "Mohon gunakan password yang lebih panjang.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      void Swal.fire({
        title: "Password konfirmasi tidak sesuai",
        text: "Pastikan konfirmasi password sama dengan password baru.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
      return;
    }

    const confirmed = await confirmAction({
      title: "Ubah password?",
      text: "Password akun akan diganti dengan password baru.",
      confirmButtonText: "Ya, ubah",
      icon: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      const response = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal mengubah password");
      }

      void Swal.fire({
        title: "Password berhasil diubah",
        text: "Silakan gunakan password baru pada login berikutnya.",
        icon: "success",
        confirmButtonColor: "#111827",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowModal(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal mengubah password";
      void Swal.fire({
        title: message,
        text: "Mohon coba lagi. Jika masalah berlanjut, hubungi admin.",
        icon: "error",
        confirmButtonColor: "#111827",
      });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return {
    showModal,
    setShowModal,
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    handleChangePassword,
    loading,
    reset,
  };
}

export function ChangePasswordModal({
  showModal,
  setShowModal,
  oldPassword,
  setOldPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  handleChangePassword,
  loading,
}: ReturnType<typeof useChangePassword>) {
  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Ubah Password</h3>
          <p className="text-xs text-gray-500 mt-1">
            Masukkan password lama dan password baru untuk mengubah akun Anda
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Password Lama
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={loading}
            placeholder="Masukkan password lama"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Password Baru
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            placeholder="Masukkan password baru (min 6 karakter)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Konfirmasi Password Baru
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            placeholder="Ketik ulang password baru"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => {
              setShowModal(false);
            }}
            disabled={loading}
            className="flex-1 px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleChangePassword}
            disabled={loading}
            className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Ubah Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
