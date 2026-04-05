"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToastFeedback } from "@/components/ui/useToastFeedback";
import { formatIndonesianDate } from "@/lib/dateFormat";

type Branch = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  barbermen: Array<{ id: string; code: string; name: string }>;
};

type OperatingHour = {
  id: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

type BarberSchedule = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isDayOff: boolean;
  barberman: { id: string; name: string; code: string };
};

type Holiday = {
  id: string;
  date: string;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  barberman: { id: string; name: string; code: string } | null;
};

type ApiListResponse<T> = { data: T };

type TabId = "hours" | "barber" | "holiday" | "system";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const DEFAULT_HOURS: OperatingHour[] = DAYS.map((dayOfWeek) => ({
  id: dayOfWeek,
  dayOfWeek,
  openTime: "09:00",
  closeTime: "21:00",
  isClosed: false,
}));

const emptyBarberForm = {
  barbermanId: "",
  date: "",
  startTime: "09:00",
  endTime: "21:00",
  isDayOff: false,
};

const emptyHolidayForm = {
  date: "",
  barbermanId: "",
  isFullDay: true,
  startTime: "09:00",
  endTime: "21:00",
  reason: "",
};

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T;
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: string }).message ?? "Request failed")
        : "Request failed";
    throw new Error(message);
  }
  return data;
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatIndonesianDate(date);
}

export default function PengaturanPage() {
  const [selectedTab, setSelectedTab] = useState<TabId>("hours");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [hours, setHours] = useState<OperatingHour[]>(DEFAULT_HOURS);
  const [barberSchedules, setBarberSchedules] = useState<BarberSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [barberForm, setBarberForm] = useState(emptyBarberForm);
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [savingBarberSchedule, setSavingBarberSchedule] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useToastFeedback({ message, error });

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const branchBarberOptions = selectedBranch?.barbermen ?? [];

  const loadBranches = useCallback(async () => {
    const response = await fetch("/api/bookings/catalog", {
      cache: "no-store",
      credentials: "include",
    });
    const result = await readJson<{ branches: Branch[] }>(response);
    const nextBranches = result.branches ?? [];
    setBranches(nextBranches);

    setSelectedBranchId((current) => current || nextBranches[0]?.id || "");
  }, []);

  const loadOperatingHours = useCallback(async (branchId: string) => {
    const response = await fetch(
      `/api/scheduling/operating-hours?branchId=${encodeURIComponent(branchId)}`,
      { cache: "no-store", credentials: "include" },
    );
    const result = await readJson<ApiListResponse<OperatingHour[]>>(response);
    const byDay = new Map(
      (result.data ?? []).map((item) => [item.dayOfWeek, item]),
    );
    setHours(
      DAYS.map(
        (dayOfWeek) =>
          byDay.get(dayOfWeek) ?? {
            id: dayOfWeek,
            dayOfWeek,
            openTime: "09:00",
            closeTime: "21:00",
            isClosed: false,
          },
      ),
    );
  }, []);

  const loadBarberSchedules = useCallback(async (branchId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await fetch(
      `/api/scheduling/barber-schedules?branchId=${encodeURIComponent(
        branchId,
      )}&date=${today}`,
      { cache: "no-store", credentials: "include" },
    );
    const result = await readJson<ApiListResponse<BarberSchedule[]>>(response);
    setBarberSchedules(result.data ?? []);
  }, []);

  const loadHolidays = useCallback(async (branchId: string) => {
    const response = await fetch(
      `/api/scheduling/holidays?branchId=${encodeURIComponent(branchId)}`,
      { cache: "no-store", credentials: "include" },
    );
    const result = await readJson<ApiListResponse<Holiday[]>>(response);
    setHolidays(result.data ?? []);
  }, []);

  const loadAll = useCallback(
    async (branchId: string) => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadOperatingHours(branchId),
          loadBarberSchedules(branchId),
          loadHolidays(branchId),
        ]);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Gagal memuat data pengaturan",
        );
      } finally {
        setLoading(false);
      }
    },
    [loadBarberSchedules, loadHolidays, loadOperatingHours],
  );

  useEffect(() => {
    void loadBranches().catch((cause) => {
      setError(
        cause instanceof Error ? cause.message : "Gagal memuat cabang aktif",
      );
      setLoading(false);
    });
  }, [loadBranches]);

  useEffect(() => {
    if (!selectedBranchId) {
      return;
    }
    void loadAll(selectedBranchId);
    setBarberForm((current) => ({ ...current, barbermanId: "", date: "" }));
    setHolidayForm((current) => ({ ...current, barbermanId: "", date: "" }));
  }, [loadAll, selectedBranchId]);

  async function handleSaveHours() {
    if (!selectedBranchId) {
      return;
    }

    setSavingHours(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/scheduling/operating-hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branchId: selectedBranchId, hours }),
      });
      await readJson<{ data: OperatingHour[] }>(response);
      setMessage("Jam operasional tersimpan.");
      await loadOperatingHours(selectedBranchId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Gagal menyimpan jam operasional",
      );
    } finally {
      setSavingHours(false);
    }
  }

  async function handleSaveBarberSchedule() {
    if (!selectedBranchId) {
      return;
    }

    setSavingBarberSchedule(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/scheduling/barber-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: selectedBranchId,
          ...barberForm,
        }),
      });
      await readJson<{ data: BarberSchedule | null }>(response);
      setMessage("Jadwal barber tersimpan.");
      setBarberForm(emptyBarberForm);
      await loadBarberSchedules(selectedBranchId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Gagal menyimpan jadwal barber",
      );
    } finally {
      setSavingBarberSchedule(false);
    }
  }

  async function handleSaveHoliday() {
    if (!selectedBranchId) {
      return;
    }

    setSavingHoliday(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/scheduling/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: selectedBranchId,
          ...holidayForm,
          barbermanId: holidayForm.barbermanId || undefined,
          reason: holidayForm.reason || undefined,
        }),
      });
      await readJson<{ data: Holiday }>(response);
      setMessage("Libur tersimpan.");
      setHolidayForm(emptyHolidayForm);
      await loadHolidays(selectedBranchId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal menyimpan libur",
      );
    } finally {
      setSavingHoliday(false);
    }
  }

  async function handleDeleteHoliday(holidayId: string) {
    if (!selectedBranchId) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/scheduling/holidays/${holidayId}?branchId=${encodeURIComponent(
          selectedBranchId,
        )}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      await readJson<{ data: { deleted: boolean } }>(response);
      setMessage("Libur dihapus.");
      await loadHolidays(selectedBranchId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal menghapus libur",
      );
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Pengaturan Operasional
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Atur jam buka, jadwal barber, dan libur untuk cabang aktif.
          </p>
        </div>

        <div className="min-w-65">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Cabang
          </label>
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
          >
            {branches.length === 0 ? (
              <option value="">Tidak ada cabang aktif</option>
            ) : (
              branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { id: "hours", label: "Jam Operasional" },
          { id: "barber", label: "Jadwal Barber" },
          { id: "holiday", label: "Libur" },
          { id: "system", label: "System" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedTab(tab.id as TabId)}
            className={`px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              selectedTab === tab.id
                ? "text-black border-b-2 border-black"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Memuat data pengaturan...
        </div>
      ) : null}

      {!loading && !selectedBranch ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Tidak ada cabang aktif yang bisa dikelola.
        </div>
      ) : null}

      {selectedBranch && selectedTab === "hours" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 border-b border-gray-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {selectedBranch.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Zona waktu {selectedBranch.timezone}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveHours}
                disabled={savingHours}
                className="rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingHours ? "Menyimpan..." : "Simpan Jam Operasional"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {hours.map((item, index) => (
                <div
                  key={item.dayOfWeek}
                  className="grid gap-3 rounded-lg bg-gray-50 p-3 lg:grid-cols-[140px_1fr_1fr_160px] lg:items-center"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      {item.dayOfWeek}
                    </p>
                  </div>
                  <label className="text-xs text-gray-500">
                    <span className="mb-1 block font-semibold text-gray-700">
                      Jam Buka
                    </span>
                    <input
                      type="time"
                      value={item.openTime}
                      disabled={item.isClosed}
                      onChange={(event) => {
                        const next = [...hours];
                        next[index] = {
                          ...next[index],
                          openTime: event.target.value,
                        };
                        setHours(next);
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                    />
                  </label>
                  <label className="text-xs text-gray-500">
                    <span className="mb-1 block font-semibold text-gray-700">
                      Jam Tutup
                    </span>
                    <input
                      type="time"
                      value={item.closeTime}
                      disabled={item.isClosed}
                      onChange={(event) => {
                        const next = [...hours];
                        next[index] = {
                          ...next[index],
                          closeTime: event.target.value,
                        };
                        setHours(next);
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={item.isClosed}
                      onChange={(event) => {
                        const next = [...hours];
                        next[index] = {
                          ...next[index],
                          isClosed: event.target.checked,
                        };
                        setHours(next);
                      }}
                      className="rounded border-gray-300"
                    />
                    Tutup
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selectedBranch && selectedTab === "barber" ? (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Atur Jadwal Barber
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Buat jadwal harian atau tandai libur untuk barberman tertentu.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-gray-500">
                <span className="mb-1 block font-semibold text-gray-700">
                  Barberman
                </span>
                <select
                  value={barberForm.barbermanId}
                  onChange={(event) =>
                    setBarberForm((current) => ({
                      ...current,
                      barbermanId: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Pilih barberman</option>
                  {branchBarberOptions.map((barberman) => (
                    <option key={barberman.id} value={barberman.id}>
                      {barberman.name} ({barberman.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-gray-500">
                <span className="mb-1 block font-semibold text-gray-700">
                  Tanggal
                </span>
                <input
                  type="date"
                  value={barberForm.date}
                  onChange={(event) =>
                    setBarberForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </label>

              <label className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-3 text-xs font-medium text-gray-600">
                <input
                  type="checkbox"
                  checked={barberForm.isDayOff}
                  onChange={(event) =>
                    setBarberForm((current) => ({
                      ...current,
                      isDayOff: event.target.checked,
                    }))
                  }
                  className="rounded border-gray-300"
                />
                Tandai libur penuh
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500">
                  <span className="mb-1 block font-semibold text-gray-700">
                    Mulai
                  </span>
                  <input
                    type="time"
                    value={barberForm.startTime}
                    disabled={barberForm.isDayOff}
                    onChange={(event) =>
                      setBarberForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                  />
                </label>
                <label className="block text-xs text-gray-500">
                  <span className="mb-1 block font-semibold text-gray-700">
                    Selesai
                  </span>
                  <input
                    type="time"
                    value={barberForm.endTime}
                    disabled={barberForm.isDayOff}
                    onChange={(event) =>
                      setBarberForm((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSaveBarberSchedule}
                disabled={savingBarberSchedule}
                className="w-full rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingBarberSchedule ? "Menyimpan..." : "Simpan Jadwal Barber"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Jadwal Hari Ini
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Data diambil dari cabang yang dipilih untuk tanggal hari ini.
              </p>
            </div>

            <div className="mt-4 divide-y divide-gray-100">
              {barberSchedules.length === 0 ? (
                <div className="py-6 text-sm text-gray-500">
                  Belum ada jadwal barber untuk tanggal ini.
                </div>
              ) : (
                barberSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {schedule.barberman.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDisplayDate(schedule.date)}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {schedule.isDayOff
                        ? "Libur penuh"
                        : `${schedule.startTime} - ${schedule.endTime}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedBranch && selectedTab === "holiday" ? (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Tambah Libur
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Bisa untuk cabang penuh atau barberman tertentu.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-gray-500">
                <span className="mb-1 block font-semibold text-gray-700">
                  Tanggal
                </span>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(event) =>
                    setHolidayForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </label>

              <label className="block text-xs text-gray-500">
                <span className="mb-1 block font-semibold text-gray-700">
                  Barberman opsional
                </span>
                <select
                  value={holidayForm.barbermanId}
                  onChange={(event) =>
                    setHolidayForm((current) => ({
                      ...current,
                      barbermanId: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Cabang penuh</option>
                  {branchBarberOptions.map((barberman) => (
                    <option key={barberman.id} value={barberman.id}>
                      {barberman.name} ({barberman.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-3 text-xs font-medium text-gray-600">
                <input
                  type="checkbox"
                  checked={holidayForm.isFullDay}
                  onChange={(event) =>
                    setHolidayForm((current) => ({
                      ...current,
                      isFullDay: event.target.checked,
                    }))
                  }
                  className="rounded border-gray-300"
                />
                Libur penuh
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500">
                  <span className="mb-1 block font-semibold text-gray-700">
                    Mulai
                  </span>
                  <input
                    type="time"
                    value={holidayForm.startTime}
                    disabled={holidayForm.isFullDay}
                    onChange={(event) =>
                      setHolidayForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                  />
                </label>
                <label className="block text-xs text-gray-500">
                  <span className="mb-1 block font-semibold text-gray-700">
                    Selesai
                  </span>
                  <input
                    type="time"
                    value={holidayForm.endTime}
                    disabled={holidayForm.isFullDay}
                    onChange={(event) =>
                      setHolidayForm((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                  />
                </label>
              </div>

              <label className="block text-xs text-gray-500">
                <span className="mb-1 block font-semibold text-gray-700">
                  Alasan
                </span>
                <input
                  type="text"
                  value={holidayForm.reason}
                  onChange={(event) =>
                    setHolidayForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Contoh: Libur nasional"
                />
              </label>

              <button
                type="button"
                onClick={handleSaveHoliday}
                disabled={savingHoliday}
                className="w-full rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingHoliday ? "Menyimpan..." : "Simpan Libur"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Daftar Libur
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Libur aktif untuk cabang yang dipilih.
              </p>
            </div>

            <div className="mt-4 divide-y divide-gray-100">
              {holidays.length === 0 ? (
                <div className="py-6 text-sm text-gray-500">
                  Belum ada data libur.
                </div>
              ) : (
                holidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDisplayDate(holiday.date)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {holiday.barberman
                          ? `${holiday.barberman.name} (${holiday.barberman.code})`
                          : "Cabang penuh"}
                        {holiday.reason ? ` · ${holiday.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {holiday.isFullDay
                          ? "Penuh"
                          : `${holiday.startTime ?? "-"} - ${holiday.endTime ?? "-"}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(holiday.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedTab === "system" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Informasi System
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Branch aktif</span>
                <span className="font-semibold">{branches.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Cabang dipilih</span>
                <span className="font-semibold">
                  {selectedBranch?.name ?? "-"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Barberman tersedia</span>
                <span className="font-semibold">
                  {branchBarberOptions.length}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Libur tercatat</span>
                <span className="font-semibold">{holidays.length}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
