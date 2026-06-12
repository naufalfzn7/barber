"use client";

import { useEffect, useState } from "react";
import {
  useChangePassword,
  ChangePasswordModal,
} from "@/components/ui/useChangePassword";
import {
  confirmAction,
  useToastFeedback,
} from "@/components/ui/useToastFeedback";
import { authFetch, notifyClientDataChanged } from "@/lib/authClient";

interface MemberInfo {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  memberCode?: string;
}

export default function MemberProfilePage() {
  const [loading, setLoading] = useState(true);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhoneNumber, setFormPhoneNumber] = useState("");

  const passwordChangeState = useChangePassword();

  useToastFeedback({
    message,
    error,
    onMessageShown: () => setMessage(null),
    onErrorShown: () => setError(null),
  });

  useEffect(() => {
    async function fetchMemberInfo() {
      try {
        const response = await authFetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch member info");
        const data = await response.json();
        setMemberInfo(data.user);
        setFormFullName(data.user.fullName);
        setFormEmail(data.user.email);
        setFormPhoneNumber(data.user.phoneNumber || "");
      } catch {
        setError("Gagal memuat informasi profil");
      } finally {
        setLoading(false);
      }
    }

    fetchMemberInfo();
  }, []);

  async function handleSaveProfile() {
    setError(null);
    setMessage(null);

    if (!formFullName.trim()) {
      setError("Nama lengkap tidak boleh kosong");
      return;
    }

    if (!formEmail.trim()) {
      setError("Email tidak boleh kosong");
      return;
    }

    const confirmed = await confirmAction({
      title: "Simpan profil?",
      text: "Perubahan data profil akan disimpan.",
      confirmButtonText: "Ya, simpan",
    });

    if (!confirmed) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await authFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formFullName,
          email: formEmail,
          phoneNumber: formPhoneNumber || null,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        user?: MemberInfo;
      };

      if (!response.ok) {
        setError(data.message ?? "Gagal menyimpan profil");
        return;
      }

      if (data.user) {
        setMemberInfo(data.user);
      }
      notifyClientDataChanged("auth:changed");
      setMessage("Profil berhasil diperbarui");
      setIsEditing(false);
    } catch {
      setError("Gagal menyimpan profil");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] py-10 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-black/10 p-8 text-center">
            <p className="text-black/60">Memuat profil...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!memberInfo) {
    return (
      <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] py-10 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-black/10 p-8 text-center">
            <p className="text-red-600">Gagal memuat profil</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <section className="bg-white border border-black/10 p-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl tracking-widest uppercase font-semibold text-black">
              Pengaturan Akun
            </h1>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-xs tracking-[0.2em] uppercase font-bold text-white bg-black hover:bg-black/80 transition-colors"
              >
                Edit Profil
              </button>
            )}
          </div>

          <div className="mt-8 space-y-6">
            {/* Member Info Section */}
            <div>
              <h2 className="text-xs tracking-widest uppercase text-black/70 font-semibold mb-4">
                Informasi Akun
              </h2>

              {isEditing ? (
                // Edit Form
                <div className="space-y-4 border-l-2 border-black/20 pl-4">
                  <div>
                    <label className="text-xs tracking-widest uppercase text-black/60 font-semibold">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      disabled={isSaving}
                      className="mt-1 w-full border border-black/20 px-3 py-2 text-sm disabled:bg-black/5"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-black/60 font-semibold">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      disabled={isSaving}
                      className="mt-1 w-full border border-black/20 px-3 py-2 text-sm disabled:bg-black/5"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-black/60 font-semibold">
                      Nomor Telepon
                    </label>
                    <input
                      type="tel"
                      value={formPhoneNumber}
                      onChange={(e) => setFormPhoneNumber(e.target.value)}
                      disabled={isSaving}
                      className="mt-1 w-full border border-black/20 px-3 py-2 text-sm disabled:bg-black/5"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="flex-1 bg-black text-white py-2 text-xs tracking-[0.2em] uppercase font-bold disabled:opacity-50"
                    >
                      {isSaving ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setFormFullName(memberInfo.fullName);
                        setFormEmail(memberInfo.email);
                        setFormPhoneNumber(memberInfo.phoneNumber || "");
                      }}
                      disabled={isSaving}
                      className="flex-1 border border-black/20 bg-white text-black py-2 text-xs tracking-[0.2em] uppercase font-bold hover:bg-black/5 disabled:opacity-50"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div className="space-y-4 border-l-2 border-black/20 pl-4">
                  <div>
                    <label className="text-xs tracking-widest uppercase text-black/60">
                      Nama Lengkap
                    </label>
                    <p className="text-sm text-black mt-1">
                      {memberInfo.fullName}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-black/60">
                      Email
                    </label>
                    <p className="text-sm text-black mt-1">
                      {memberInfo.email}
                    </p>
                  </div>
                  {memberInfo.phoneNumber && (
                    <div>
                      <label className="text-xs tracking-widest uppercase text-black/60">
                        Nomor Telepon
                      </label>
                      <p className="text-sm text-black mt-1">
                        {memberInfo.phoneNumber}
                      </p>
                    </div>
                  )}
                  {memberInfo.memberCode && (
                    <div>
                      <label className="text-xs tracking-widest uppercase text-black/60">
                        Kode Member
                      </label>
                      <p className="text-sm text-black mt-1 font-semibold">
                        {memberInfo.memberCode}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Security Section */}
            <div>
              <h2 className="text-xs tracking-widest uppercase text-black/70 font-semibold mb-4">
                Keamanan
              </h2>
              <button
                onClick={() => passwordChangeState.setShowModal(true)}
                className="px-4 py-2.5 text-xs tracking-[0.2em] uppercase font-bold text-white bg-black hover:bg-black/80 transition-colors"
              >
                Ubah Password
              </button>
              <p className="text-xs text-black/60 mt-2">
                Perbarui password Anda secara berkala untuk keamanan akun yang
                lebih baik.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal {...passwordChangeState} />
    </main>
  );
}
