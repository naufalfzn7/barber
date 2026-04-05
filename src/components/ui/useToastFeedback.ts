"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

function normalizeSuccessMessage(message: string) {
  if (message.trim().length === 0) {
    return "Berhasil";
  }

  return message;
}

function normalizeErrorMessage(error: string) {
  const text = error.trim();
  const lower = text.toLowerCase();

  if (lower.includes("selected slot is no longer available")) {
    return "Slot yang dipilih sudah terpakai. Silakan pilih jam lain.";
  }

  if (
    lower.includes("outside your branch scope") ||
    lower.includes("forbidden")
  ) {
    return "Anda tidak memiliki akses untuk aksi ini.";
  }

  if (lower.includes("request failed") || lower.includes("failed to fetch")) {
    return "Koneksi sedang bermasalah. Mohon coba lagi.";
  }

  if (lower.length === 0) {
    return "Terjadi kendala saat memproses permintaan.";
  }

  return text;
}

function getSuccessDescription(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("dibuat") || lower.includes("ditambahkan")) {
    return "Data baru sudah tersimpan.";
  }

  if (lower.includes("diperbarui") || lower.includes("tersimpan")) {
    return "Perubahan sudah berhasil disimpan.";
  }

  if (lower.includes("dihapus")) {
    return "Data berhasil dihapus.";
  }

  return "Aksi berhasil diproses.";
}

function getErrorDescription(error: string) {
  const lower = error.toLowerCase();

  if (
    lower.includes("slot") ||
    lower.includes("jadwal") ||
    lower.includes("overlap")
  ) {
    return "Coba pilih waktu lain yang masih tersedia.";
  }

  if (
    lower.includes("wajib") ||
    lower.includes("invalid") ||
    lower.includes("kurang")
  ) {
    return "Mohon cek kembali data yang Anda masukkan.";
  }

  if (
    lower.includes("akses") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized")
  ) {
    return "Silakan login dengan akun yang memiliki izin yang sesuai.";
  }

  return "Mohon coba lagi. Jika masalah berlanjut, hubungi admin.";
}

export function useToastFeedback(input: {
  message?: string | null;
  error?: string | null;
}) {
  const lastMessageRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const lastMessageShownAtRef = useRef<number>(0);
  const lastErrorShownAtRef = useRef<number>(0);

  useEffect(() => {
    if (input.message !== null && input.message !== undefined) {
      return;
    }

    lastMessageRef.current = null;
    lastMessageShownAtRef.current = 0;
  }, [input.message]);

  useEffect(() => {
    if (input.error !== null && input.error !== undefined) {
      return;
    }

    lastErrorRef.current = null;
    lastErrorShownAtRef.current = 0;
  }, [input.error]);

  useEffect(() => {
    if (!input.message) {
      return;
    }

    const now = Date.now();
    const isSameMessage = input.message === lastMessageRef.current;
    const isTooSoon = now - lastMessageShownAtRef.current < 1200;
    if (isSameMessage && isTooSoon) {
      return;
    }

    lastMessageRef.current = input.message;
    lastMessageShownAtRef.current = now;
    const friendlyMessage = normalizeSuccessMessage(input.message);
    toast.success(friendlyMessage, {
      description: getSuccessDescription(friendlyMessage),
    });
  }, [input.message]);

  useEffect(() => {
    if (!input.error) {
      return;
    }

    const now = Date.now();
    const isSameError = input.error === lastErrorRef.current;
    const isTooSoon = now - lastErrorShownAtRef.current < 1200;
    if (isSameError && isTooSoon) {
      return;
    }

    lastErrorRef.current = input.error;
    lastErrorShownAtRef.current = now;
    const friendlyError = normalizeErrorMessage(input.error);
    toast.error(friendlyError, {
      description: getErrorDescription(friendlyError),
    });
  }, [input.error]);
}
