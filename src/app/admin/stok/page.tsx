"use client";

import { useEffect, useState } from "react";
import {
  confirmAction,
  useToastFeedback,
} from "@/components/ui/useToastFeedback";
import { formatIndonesianDateTime } from "@/lib/dateFormat";
import { authFetch } from "@/lib/authClient";

type Role = "ADMIN" | "SUPER_ADMIN";
type StockStatus = "aman" | "menipis" | "habis";
type FilterStatus = "semua" | "menipis" | "habis";

type Branch = {
  id: string;
  name: string;
};

type InventoryItem = {
  id: string;
  branchId: string;
  sku: string;
  name: string;
  sellingPrice: number;
  stockQty: number;
  minStockQty: number;
  isActive: boolean;
  imageUrl: string | null;
  updatedAt: string;
};

function toRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

async function uploadProductImage(
  itemId: string,
  branchId: string,
  file: File,
) {
  const data = new FormData();
  data.append("file", file);
  data.append("branchId", branchId);
  const response = await authFetch(`/api/inventory/items/${itemId}/image`, {
    method: "POST",
    body: data,
  });
  const json = (await response.json()) as { message?: string };
  if (!response.ok) {
    throw new Error(json.message ?? "Gagal mengunggah gambar produk");
  }
}

type InventoryMovement = {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  beforeQty: number;
  afterQty: number;
  note: string | null;
  referenceId: string | null;
  createdAt: string;
  inventoryItem: {
    id: string;
    sku: string;
    name: string;
  };
  actedBy: {
    id: string;
    fullName: string;
    role: Role;
  } | null;
};

function getStockStatus(item: InventoryItem): StockStatus {
  if (item.stockQty === 0) {
    return "habis";
  }

  if (item.stockQty <= item.minStockQty) {
    return "menipis";
  }

  return "aman";
}

function getMovementTypeStyle(type: InventoryMovement["type"]) {
  if (type === "IN") {
    return { label: "Masuk", className: "bg-emerald-100 text-emerald-700" };
  }

  if (type === "OUT") {
    return { label: "Keluar", className: "bg-red-100 text-red-700" };
  }

  return { label: "Adjust", className: "bg-slate-100 text-slate-700" };
}

function StockBadge({ item }: { item: InventoryItem }) {
  const status = getStockStatus(item);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-semibold ${
        status === "aman"
          ? "bg-emerald-100 text-emerald-700"
          : status === "menipis"
            ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "aman"
            ? "bg-emerald-500"
            : status === "menipis"
              ? "bg-amber-500"
              : "bg-red-500"
        }`}
      />
      {status === "aman" ? "Aman" : status === "menipis" ? "Menipis" : "Habis"}
    </span>
  );
}

function AddItemModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: {
    sku: string;
    name: string;
    sellingPrice: number;
    stockQty: number;
    minStockQty: number;
    imageFile: File | null;
  }) => Promise<void>;
}) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [sellingPrice, setSellingPrice] = useState(0);
  const [stockQty, setStockQty] = useState(0);
  const [minStockQty, setMinStockQty] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!sku.trim() || !name.trim()) {
      return;
    }

    const confirmed = await confirmAction({
      title: "Tambah item stok?",
      text: `${name.trim()} akan ditambahkan ke stok cabang ini.`,
      confirmButtonText: "Ya, tambah",
    });

    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        sellingPrice,
        stockQty,
        minStockQty,
        imageFile,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">
            Tambah Item Stok
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black"
            aria-label="Tutup modal tambah item"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">SKU</label>
            <input
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black"
              placeholder="POMADE-001"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              Nama Item
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black"
              placeholder="Pomade Monarch"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              Harga Jual
            </label>
            <input
              type="number"
              min={0}
              value={sellingPrice}
              onChange={(event) =>
                setSellingPrice(Math.max(0, Number(event.target.value) || 0))
              }
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                Stok Awal
              </label>
              <input
                type="number"
                min={0}
                value={stockQty}
                onChange={(event) =>
                  setStockQty(Math.max(0, Number(event.target.value) || 0))
                }
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                Min. Stok
              </label>
              <input
                type="number"
                min={0}
                value={minStockQty}
                onChange={(event) =>
                  setMinStockQty(Math.max(0, Number(event.target.value) || 0))
                }
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              Gambar Produk (opsional)
            </label>
            <div className="flex items-center gap-3">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-16 w-16 rounded-lg object-cover bg-gray-100 border border-gray-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
                  Belum ada
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setImageFile(file);
                  setImagePreview(file ? URL.createObjectURL(file) : null);
                }}
                className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-900 file:text-white file:text-xs file:cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              JPG/PNG/WEBP, maks 5 MB
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 font-semibold disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductImageModal({
  item,
  branchId,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  branchId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) {
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await uploadProductImage(item.id, branchId, file);
      onSaved("Gambar produk diperbarui");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah gambar");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const confirmed = await confirmAction({
      title: "Hapus gambar produk?",
      text: `Gambar ${item.name} akan dihapus dari penyimpanan.`,
      confirmButtonText: "Ya, hapus",
      icon: "warning",
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const response = await authFetch(
        `/api/inventory/items/${item.id}/image`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId }),
        },
      );
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal menghapus gambar");
      }
      onSaved("Gambar produk dihapus");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus gambar");
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? item.imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Gambar Produk</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black"
            aria-label="Tutup modal gambar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown}
                alt={item.name}
                className="h-20 w-20 rounded-lg object-cover bg-gray-100 border border-gray-200"
              />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400">
                Belum ada
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
              <p className="text-xs text-gray-500">{item.sku}</p>
            </div>
          </div>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={(event) => {
              const picked = event.target.files?.[0] ?? null;
              setFile(picked);
              setPreview(picked ? URL.createObjectURL(picked) : null);
            }}
            className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-900 file:text-white file:text-xs file:cursor-pointer"
          />
          <p className="text-[10px] text-gray-400">JPG/PNG/WEBP, maks 5 MB</p>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            {item.imageUrl && (
              <button
                onClick={handleRemove}
                disabled={busy}
                className="flex-1 py-2.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                Hapus
              </button>
            )}
            <button
              onClick={handleUpload}
              disabled={busy || !file}
              className="flex-1 py-2.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 font-semibold disabled:opacity-50"
            >
              {busy ? "Menyimpan..." : "Simpan Gambar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({
  item,
  mode,
  onClose,
  onConfirm,
}: {
  item: InventoryItem;
  mode: "tambah" | "kurangi";
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 capitalize">
            {mode} Stok
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black"
            aria-label="Tutup modal adjustment"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400">Produk</p>
            <p className="font-semibold text-gray-900 mt-0.5">{item.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              SKU: <strong>{item.sku}</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Stok saat ini: <strong>{item.stockQty} pcs</strong>
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              Jumlah {mode}
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAmount(Math.max(1, amount - 1))}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 font-bold text-lg"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(event) =>
                  setAmount(
                    Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                  )
                }
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-center text-lg font-bold focus:outline-none focus:border-black"
              />
              <button
                onClick={() => setAmount(amount + 1)}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 font-bold text-lg"
              >
                +
              </button>
            </div>
          </div>

          <div className="bg-gray-100 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-gray-500">Stok setelah {mode}</span>
            <span className="font-bold text-gray-900">
              {mode === "tambah"
                ? item.stockQty + amount
                : Math.max(0, item.stockQty - amount)}{" "}
              pcs
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={() => {
                void onConfirm(amount).then(onClose);
              }}
              className={`flex-1 py-2.5 text-sm text-white rounded-lg font-semibold transition-colors ${
                mode === "tambah"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-500 hover:bg-red-600"
              }`}
            >
              Konfirmasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MovementHistoryModal({
  item,
  loading,
  movements,
  onClose,
  onReload,
}: {
  item: InventoryItem;
  loading: boolean;
  movements: InventoryMovement[];
  onClose: () => void;
  onReload: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 flex justify-end">
      <div className="h-full w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Histori Movement Stok
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {item.name} • {item.sku}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onReload}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-black"
              aria-label="Tutup histori movement"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="text-xs text-gray-500">
              Memuat histori movement...
            </div>
          )}

          {!loading && movements.length === 0 && (
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-4">
              Belum ada movement untuk item ini.
            </div>
          )}

          {!loading && movements.length > 0 && (
            <div className="space-y-3">
              {movements.map((movement) => {
                const typeStyle = getMovementTypeStyle(movement.type);

                return (
                  <div
                    key={movement.id}
                    className="border border-gray-100 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full ${typeStyle.className}`}
                        >
                          {typeStyle.label}
                        </span>
                        <p className="text-xs text-gray-700">
                          Qty: <strong>{movement.quantity}</strong> • Saldo:{" "}
                          <strong>
                            {movement.beforeQty} -&gt; {movement.afterQty}
                          </strong>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Oleh: {movement.actedBy?.fullName ?? "System"} (
                          {movement.actedBy?.role ?? "SYSTEM"})
                        </p>
                      </div>

                      <p className="text-[11px] text-gray-500 text-right">
                        {formatIndonesianDateTime(movement.createdAt)}
                      </p>
                    </div>

                    {(movement.note || movement.referenceId) && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                        {movement.note && (
                          <p className="text-xs text-gray-700">
                            Catatan: {movement.note}
                          </p>
                        )}
                        {movement.referenceId && (
                          <p className="text-xs text-gray-500">
                            Ref:{" "}
                            <span className="font-mono">
                              {movement.referenceId}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StokPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useToastFeedback({
    message,
    error,
    onMessageShown: () => setMessage(null),
    onErrorShown: () => setError(null),
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<{
    item: InventoryItem;
    mode: "tambah" | "kurangi";
  } | null>(null);

  const [historyTarget, setHistoryTarget] = useState<InventoryItem | null>(
    null,
  );
  const [imageTarget, setImageTarget] = useState<InventoryItem | null>(null);
  const [historyMovements, setHistoryMovements] = useState<InventoryMovement[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("semua");
  const [minStockDrafts, setMinStockDrafts] = useState<Record<string, string>>(
    {},
  );
  const [minStockSavingId, setMinStockSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        setError(null);

        const meResponse = await authFetch("/api/auth/me");
        const me = (await meResponse.json()) as {
          user?: { role?: Role; branchId?: string | null };
          message?: string;
        };

        if (!meResponse.ok || !me.user?.role) {
          throw new Error(me.message ?? "Gagal memuat sesi");
        }

        setRole(me.user.role);

        const catalogResponse = await authFetch("/api/bookings/catalog");
        const catalog = (await catalogResponse.json()) as {
          branches?: Array<{ id: string; name: string }>;
          message?: string;
        };

        if (!catalogResponse.ok) {
          throw new Error(catalog.message ?? "Gagal memuat daftar cabang");
        }

        const branchList = catalog.branches ?? [];
        setBranches(branchList);

        const initialBranchId =
          me.user.role === "ADMIN"
            ? (me.user.branchId ?? branchList[0]?.id ?? "")
            : (branchList[0]?.id ?? "");

        setBranchId(initialBranchId);
      } catch (bootstrapError) {
        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Gagal memuat halaman stok",
        );
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function loadItems(currentBranchId: string) {
    if (!currentBranchId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams({ branchId: currentBranchId });
      const response = await authFetch(`/api/inventory/items?${query.toString()}`);
      const data = (await response.json()) as {
        items?: InventoryItem[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal memuat item stok");
      }

      const nextItems = data.items ?? [];
      setItems(nextItems);
      setMinStockDrafts(
        Object.fromEntries(
          nextItems.map((item) => [item.id, String(item.minStockQty)]),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat item stok",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (branchId) {
      void loadItems(branchId);
    }
  }, [branchId]);

  async function loadMovements(item: InventoryItem) {
    try {
      setHistoryLoading(true);
      const query = new URLSearchParams({
        branchId,
        itemId: item.id,
        limit: "25",
      });

      const response = await authFetch(
        `/api/inventory/movements?${query.toString()}`,
      );
      const data = (await response.json()) as {
        movements?: InventoryMovement[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal memuat histori movement");
      }

      setHistoryMovements(data.movements ?? []);
    } catch (movementError) {
      setError(
        movementError instanceof Error
          ? movementError.message
          : "Gagal memuat histori movement",
      );
      setHistoryMovements([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openMovementHistory(item: InventoryItem) {
    setHistoryTarget(item);
    setHistoryMovements([]);
    await loadMovements(item);
  }

  async function handleCreateItem(payload: {
    sku: string;
    name: string;
    sellingPrice: number;
    stockQty: number;
    minStockQty: number;
    imageFile: File | null;
  }) {
    try {
      setError(null);
      setMessage(null);

      const { imageFile, ...itemPayload } = payload;
      const response = await authFetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          ...itemPayload,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        item?: { id?: string };
      };
      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menambah item stok");
      }

      if (imageFile && data.item?.id) {
        await uploadProductImage(data.item.id, branchId, imageFile);
      }

      setMessage(data.message ?? "Item stok berhasil ditambahkan");
      await loadItems(branchId);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Gagal menambah item stok",
      );
      throw createError;
    }
  }

  async function handleAdjust(
    itemId: string,
    mode: "tambah" | "kurangi",
    amount: number,
  ) {
    setError(null);
    setMessage(null);

    const confirmed = await confirmAction({
      title: mode === "tambah" ? "Tambah stok?" : "Kurangi stok?",
      text: `Stok akan ${mode === "tambah" ? "ditambah" : "dikurangi"} ${amount} pcs.`,
      confirmButtonText: mode === "tambah" ? "Ya, tambah" : "Ya, kurangi",
      icon: "warning",
      danger: mode === "kurangi",
    });

    if (!confirmed) {
      return;
    }

    const response = await authFetch("/api/inventory/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        itemId,
        type: mode === "tambah" ? "IN" : "OUT",
        quantity: amount,
        note:
          mode === "tambah"
            ? "Manual restock by admin"
            : "Manual usage adjustment by admin",
      }),
    });

    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(data.message ?? "Gagal menyesuaikan stok");
      return;
    }

    setMessage(data.message ?? "Perubahan stok berhasil disimpan");
    await loadItems(branchId);

    if (historyTarget?.id === itemId) {
      await loadMovements(historyTarget);
    }
  }

  async function handleMinStockUpdate(item: InventoryItem) {
    const rawDraft = minStockDrafts[item.id] ?? String(item.minStockQty);
    const parsed = Number(rawDraft);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Min. stok harus angka >= 0");
      return;
    }

    const minStockQty = Math.trunc(parsed);

    if (minStockQty === item.minStockQty) {
      return;
    }

    const confirmed = await confirmAction({
      title: "Update minimum stok?",
      text: `Minimum stok ${item.name} akan diubah menjadi ${minStockQty} pcs.`,
      confirmButtonText: "Ya, update",
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setMessage(null);
      setMinStockSavingId(item.id);

      const response = await authFetch(`/api/inventory/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          minStockQty,
        }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "Gagal memperbarui minimum stok");
      }

      setMessage("Minimum stok berhasil diperbarui");
      await loadItems(branchId);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Gagal memperbarui minimum stok",
      );
    } finally {
      setMinStockSavingId(null);
    }
  }

  const lowCount = items.filter(
    (item) => getStockStatus(item) !== "aman",
  ).length;

  const filtered =
    filterStatus === "semua"
      ? items
      : items.filter((item) => getStockStatus(item) === filterStatus);

  const filterTabs: Array<{ key: FilterStatus; label: string }> = [
    { key: "semua", label: "Semua" },
    { key: "menipis", label: "Menipis" },
    { key: "habis", label: "Habis" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Stok Produk</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length} item aktif
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role === "SUPER_ADMIN" && (
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-xs"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors"
          >
            + Item Baru
          </button>

          <button
            onClick={() => {
              void loadItems(branchId);
            }}
            className="border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {lowCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <svg
            className="w-5 h-5 text-red-500 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm font-semibold text-red-800">
            {lowCount} produk membutuhkan perhatian - segera lakukan restok
          </p>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterStatus === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3.5">
                  SKU
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3.5">
                  Produk
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3.5">
                  Harga
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3.5">
                  Stok
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3.5 min-w-37.5">
                  Min. Stok
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3.5">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 tracking-wider uppercase px-5 py-3.5 hidden lg:table-cell">
                  Update
                </th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-6 text-xs text-gray-500 text-center"
                  >
                    Memuat data stok...
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-6 text-xs text-gray-500 text-center"
                  >
                    Belum ada item stok aktif
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((item) => {
                  const minStockDraft =
                    minStockDrafts[item.id] ?? String(item.minStockQty);
                  const parsedMinStock = Number(minStockDraft);
                  const hasMinStockChanged = Number.isFinite(parsedMinStock)
                    ? Math.trunc(parsedMinStock) !== item.minStockQty
                    : false;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 transition-colors ${getStockStatus(item) === "habis" ? "bg-red-50/30" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs text-gray-700">
                          {item.sku}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-9 w-9 rounded-md object-cover bg-gray-100 border border-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-md bg-gray-100 border border-gray-100 shrink-0 flex items-center justify-center text-[10px] text-gray-400">
                              —
                            </div>
                          )}
                          <p className="font-medium text-gray-900 text-xs">
                            {item.name}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-gray-700">
                          {toRupiah(item.sellingPrice)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-bold text-gray-900">
                          {item.stockQty}{" "}
                          <span className="text-xs font-normal text-gray-400">
                            pcs
                          </span>
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={minStockDraft}
                            onChange={(event) =>
                              setMinStockDrafts((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-black"
                          />
                          <button
                            onClick={() => {
                              void handleMinStockUpdate(item);
                            }}
                            disabled={
                              minStockSavingId === item.id ||
                              !hasMinStockChanged
                            }
                            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            {minStockSavingId === item.id
                              ? "Simpan..."
                              : "Simpan"}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StockBadge item={item} />
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <p className="text-xs text-gray-700">
                          {formatIndonesianDateTime(item.updatedAt)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setImageTarget(item)}
                            className="text-[11px] px-2.5 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-semibold transition-colors"
                          >
                            Foto
                          </button>
                          <button
                            onClick={() => {
                              void openMovementHistory(item);
                            }}
                            className="text-[11px] px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-semibold transition-colors"
                          >
                            Histori
                          </button>
                          <button
                            onClick={() =>
                              setAdjustTarget({ item, mode: "tambah" })
                            }
                            className="text-[11px] px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-semibold transition-colors"
                          >
                            + Tambah
                          </button>
                          <button
                            onClick={() =>
                              setAdjustTarget({ item, mode: "kurangi" })
                            }
                            disabled={item.stockQty === 0}
                            className="text-[11px] px-2.5 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            - Kurangi
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateItem}
        />
      )}

      {imageTarget && (
        <ProductImageModal
          item={imageTarget}
          branchId={branchId}
          onClose={() => setImageTarget(null)}
          onSaved={(msg) => {
            setMessage(msg);
            setImageTarget(null);
            void loadItems(branchId);
          }}
        />
      )}

      {adjustTarget && (
        <AdjustModal
          item={adjustTarget.item}
          mode={adjustTarget.mode}
          onClose={() => setAdjustTarget(null)}
          onConfirm={(amount) =>
            handleAdjust(adjustTarget.item.id, adjustTarget.mode, amount)
          }
        />
      )}

      {historyTarget && (
        <MovementHistoryModal
          item={historyTarget}
          loading={historyLoading}
          movements={historyMovements}
          onClose={() => setHistoryTarget(null)}
          onReload={() => {
            void loadMovements(historyTarget);
          }}
        />
      )}
    </div>
  );
}
