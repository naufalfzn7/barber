"use client";

import { useSyncExternalStore } from "react";
import { formatIndonesianDate } from "@/lib/dateFormat";

function subscribe() {
  return () => {};
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayLabel() {
  return formatIndonesianDate(new Date());
}

function getYear() {
  return String(new Date().getFullYear());
}

export function useClientTodayIso() {
  return useSyncExternalStore(subscribe, getTodayIso, () => "");
}

export function ClientTodayLabel({ fallback = "-" }: { fallback?: string }) {
  const label = useSyncExternalStore(subscribe, getTodayLabel, () => fallback);
  return <>{label}</>;
}

export function ClientYear({ fallback = "2026" }: { fallback?: string }) {
  const year = useSyncExternalStore(subscribe, getYear, () => fallback);
  return <>{year}</>;
}
