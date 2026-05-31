"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  confirmAction,
  useToastFeedback,
} from "@/components/ui/useToastFeedback";
import { formatIndonesianDateTime } from "@/lib/dateFormat";
import PaymentSuccessModal from "@/components/ui/PaymentSuccessModal";
import { authFetch } from "@/lib/authClient";

type Role = "ADMIN" | "SUPER_ADMIN";

type CatalogBranch = {
  id: string;
  code: string;
  name: string;
  services: Array<{ id: string; name: string; price: number }>;
  barbermen: Array<{ id: string; name: string }>;
};

type BookingItem = {
  id: string;
  code: string;
  status:
    | "UPCOMING"
    | "IN_PROGRESS"
    | "PAYMENT_PENDING"
    | "COMPLETED"
    | "CANCELED"
    | "NO_SHOW";
  scheduledStart: string;
  isWalkIn: boolean;
  walkInName?: string | null;
  service: { id: string; name: string; price: number };
  products: Array<{
    id: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  totalDue: number;
  remainingDue: number;
  barberman: { id: string; name: string };
  member: { fullName: string } | null;
  payment?: {
    id: string;
    status: PaymentStatus;
    amountDue: number;
    amountPaid: number | null;
    changeAmount: number | null;
    isDeposit: boolean;
    depositAmount: number | null;
    externalRef: string | null;
    paidAt: string | null;
    qrisString: string | null;
    qrisImageUrl: string | null;
    qrisExpiresAt: string | null;
  } | null;
};

type ProductCatalogItem = {
  id: string;
  sku: string;
  name: string;
  stockQty: number;
  sellingPrice: number;
};

type DashboardResponse = {
  date: string;
  summary: {
    total: number;
    upcoming: number;
    inProgress: number;
    completed: number;
    paymentPending: number;
  };
  bookings: BookingItem[];
};

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED";

type PaymentInfo = {
  id: string;
  status: PaymentStatus;
  externalRef: string | null;
};

type QrisResponse = {
  qrString?: string | null;
  referenceId?: string | null;
  expiresAt?: string | null;
};

type QrisModalState = {
  bookingId: string;
  bookingCode: string;
  paymentId: string | null;
  paymentStatus: PaymentStatus | null;
  externalRef: string | null;
  qrString: string | null;
  expiresAt: string | null;
};

type BookingProductModalState = {
  bookingId: string;
  bookingCode: string;
  bookingStatus: BookingItem["status"];
};

type ReceiptDetail = {
  booking: {
    id: string;
    code: string;
    status: BookingItem["status"];
    scheduledStart: string;
    completedAt: string | null;
    isWalkIn: boolean;
    walkInName?: string | null;
    walkInPhone?: string | null;
  };
  branch: {
    id: string;
    code: string;
    name: string;
  };
  customer: {
    fullName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
  };
  barberman: {
    id: string;
    name: string;
  } | null;
  service: {
    id: string;
    name: string;
    price: number;
  };
  products: Array<{
    id: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  totals: {
    service: number;
    products: number;
    amountDue: number;
  };
  payment: {
    id: string;
    method: "QRIS" | "CASH";
    status: PaymentStatus;
    amountDue: number;
    amountPaid: number | null;
    changeAmount: number | null;
    paidAt: string | null;
    externalRef: string | null;
  } | null;
};

type PaymentSuccessState = {
  bookingId: string;
  bookingCode: string;
  amount: number;
  method: "QRIS" | "CASH";
};

const SUMMARY_STATUS_KEY_MAP = {
  UPCOMING: "upcoming",
  IN_PROGRESS: "inProgress",
  PAYMENT_PENDING: "paymentPending",
  COMPLETED: "completed",
} as const;

function getSummaryKey(status: BookingItem["status"]) {
  return SUMMARY_STATUS_KEY_MAP[status as keyof typeof SUMMARY_STATUS_KEY_MAP];
}

function toRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function toDateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function statusBadge(status: BookingItem["status"]) {
  const map: Record<BookingItem["status"], string> = {
    UPCOMING: "bg-blue-50 text-blue-700",
    IN_PROGRESS: "bg-amber-50 text-amber-700",
    PAYMENT_PENDING: "bg-violet-50 text-violet-700",
    COMPLETED: "bg-emerald-50 text-emerald-700",
    CANCELED: "bg-red-50 text-red-700",
    NO_SHOW: "bg-gray-100 text-gray-600",
  };

  return map[status];
}

export default function ReservasiPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [branches, setBranches] = useState<CatalogBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInServiceId, setWalkInServiceId] = useState("");
  const [walkInBarberId, setWalkInBarberId] = useState("");
  const [walkInTime, setWalkInTime] = useState("10:00");
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);
  const [qrisModal, setQrisModal] = useState<QrisModalState | null>(null);
  const [qrisModalVisible, setQrisModalVisible] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);
  const [retryingQris, setRetryingQris] = useState(false);
  const [productCatalog, setProductCatalog] = useState<ProductCatalogItem[]>(
    [],
  );
  const [productModal, setProductModal] =
    useState<BookingProductModalState | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductQty, setSelectedProductQty] = useState(1);
  const [savingProduct, setSavingProduct] = useState(false);
  const [removingProductId, setRemovingProductId] = useState<string | null>(
    null,
  );
  const [receiptModal, setReceiptModal] = useState<ReceiptDetail | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [paymentSuccess, setPaymentSuccess] =
    useState<PaymentSuccessState | null>(null);

  const qrisModalOpen = qrisModalVisible && qrisModal !== null;
  const qrisBookingId = qrisModal?.bookingId ?? null;
  const canRetryQris =
    qrisModal?.paymentStatus === "PENDING" ||
    qrisModal?.paymentStatus === "EXPIRED" ||
    qrisModal?.paymentStatus === "FAILED";

  useToastFeedback({ message, error });

  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

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
        const catalogJson = (await catalogRes.json()) as {
          branches?: CatalogBranch[];
          message?: string;
        };

        if (!catalogRes.ok) {
          throw new Error(catalogJson.message ?? "Gagal memuat katalog");
        }

        const catalogBranches = catalogJson.branches ?? [];
        setBranches(catalogBranches);

        const initialBranchId =
          me.user.role === "ADMIN"
            ? (me.user.branchId ?? catalogBranches[0]?.id ?? "")
            : (catalogBranches[0]?.id ?? "");

        setBranchId(initialBranchId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat halaman");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId) ?? null,
    [branches, branchId],
  );

  const selectedProductBooking = useMemo(
    () =>
      (data?.bookings ?? []).find(
        (booking) => booking.id === productModal?.bookingId,
      ) ?? null,
    [data?.bookings, productModal?.bookingId],
  );

  useEffect(() => {
    if (!selectedBranch) {
      setWalkInServiceId("");
      setWalkInBarberId("");
      return;
    }

    if (
      !selectedBranch.services.some((service) => service.id === walkInServiceId)
    ) {
      setWalkInServiceId(selectedBranch.services[0]?.id ?? "");
    }

    if (
      !selectedBranch.barbermen.some((barber) => barber.id === walkInBarberId)
    ) {
      setWalkInBarberId("");
    }
  }, [selectedBranch, walkInServiceId, walkInBarberId]);

  useEffect(() => {
    async function loadProductCatalog() {
      if (!branchId) {
        setProductCatalog([]);
        return;
      }

      try {
        const query = new URLSearchParams();
        if (role === "SUPER_ADMIN") {
          query.set("branchId", branchId);
        }

        const response = await authFetch(
          `/api/inventory/items${query.toString() ? `?${query.toString()}` : ""}`,
        );
        const json = (await response.json()) as {
          items?: ProductCatalogItem[];
          message?: string;
        };

        if (!response.ok) {
          throw new Error(json.message ?? "Gagal memuat katalog produk");
        }

        const items = (json.items ?? []).filter((item) => item.stockQty > 0);
        setProductCatalog(items);

        if (!items.some((item) => item.id === selectedProductId)) {
          setSelectedProductId(items[0]?.id ?? "");
          setSelectedProductQty(1);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Gagal memuat katalog produk",
        );
      }
    }

    void loadProductCatalog();
  }, [branchId, role, selectedProductId]);

  const loadDashboard = useCallback(async () => {
    if (!branchId || !date) {
      return;
    }

    setError(null);

    try {
      setLoading(true);
      const query = new URLSearchParams({ date });
      if (role === "SUPER_ADMIN") {
        query.set("branchId", branchId);
      }

      const response = await authFetch(
        `/api/bookings/admin/today?${query.toString()}`,
      );
      const json = (await response.json()) as DashboardResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal memuat reservasi");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat reservasi");
    } finally {
      setLoading(false);
    }
  }, [branchId, date, role]);

  const syncBookingStatusLocally = useCallback(
    (bookingId: string, nextStatus: BookingItem["status"]) => {
      setData((prev) => {
        if (!prev) {
          return prev;
        }

        const bookingIndex = prev.bookings.findIndex(
          (booking) => booking.id === bookingId,
        );

        if (bookingIndex < 0) {
          return prev;
        }

        const currentBooking = prev.bookings[bookingIndex];
        if (currentBooking.status === nextStatus) {
          return prev;
        }

        const updatedBookings = [...prev.bookings];
        updatedBookings[bookingIndex] = {
          ...currentBooking,
          status: nextStatus,
        };

        const updatedSummary = { ...prev.summary };
        const oldKey = getSummaryKey(currentBooking.status);
        const newKey = getSummaryKey(nextStatus);

        if (oldKey) {
          updatedSummary[oldKey] = Math.max(0, updatedSummary[oldKey] - 1);
        }

        if (newKey) {
          updatedSummary[newKey] += 1;
        }

        return {
          ...prev,
          bookings: updatedBookings,
          summary: updatedSummary,
        };
      });
    },
    [],
  );

  const syncBookingDataLocally = useCallback(
    (bookingId: string, updater: (current: BookingItem) => BookingItem) => {
      setData((prev) => {
        if (!prev) {
          return prev;
        }

        const bookingIndex = prev.bookings.findIndex(
          (booking) => booking.id === bookingId,
        );

        if (bookingIndex < 0) {
          return prev;
        }

        const updatedBookings = [...prev.bookings];
        updatedBookings[bookingIndex] = updater(updatedBookings[bookingIndex]);

        return {
          ...prev,
          bookings: updatedBookings,
        };
      });
    },
    [],
  );

  async function addProductToBooking() {
    if (!productModal?.bookingId) {
      return;
    }

    if (!selectedProductId) {
      setError("Pilih produk terlebih dahulu");
      return;
    }

    if (!Number.isFinite(selectedProductQty) || selectedProductQty <= 0) {
      setError("Qty produk harus lebih dari 0");
      return;
    }

    const selectedProduct = productCatalog.find(
      (item) => item.id === selectedProductId,
    );
    const confirmed = await confirmAction({
      title: "Tambah produk ke booking?",
      text: `${selectedProductQty} x ${selectedProduct?.name ?? "produk"} akan ditambahkan ke booking ${productModal.bookingCode}.`,
      confirmButtonText: "Ya, tambah",
    });

    if (!confirmed) {
      return;
    }

    try {
      setSavingProduct(true);
      setError(null);
      setMessage(null);

      const response = await authFetch(
        `/api/bookings/admin/${productModal.bookingId}/products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: role === "SUPER_ADMIN" ? branchId : undefined,
            inventoryItemId: selectedProductId,
            quantity: selectedProductQty,
          }),
        },
      );

      const json = (await response.json()) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal menambahkan produk");
      }

      setMessage(json.message ?? "Produk berhasil ditambahkan");
      await loadDashboard();
      setSelectedProductQty(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan produk");
    } finally {
      setSavingProduct(false);
    }
  }

  async function removeProductFromBooking(
    bookingId: string,
    bookingProductId: string,
  ) {
    const product = selectedProductBooking?.products.find(
      (item) => item.id === bookingProductId,
    );
    const confirmed = await confirmAction({
      title: "Hapus produk dari booking?",
      text: `${product?.itemName ?? "Produk ini"} akan dihapus dari booking.`,
      confirmButtonText: "Ya, hapus",
      icon: "warning",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      setRemovingProductId(bookingProductId);
      setError(null);
      setMessage(null);

      const response = await authFetch(
        `/api/bookings/admin/${bookingId}/products`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: role === "SUPER_ADMIN" ? branchId : undefined,
            bookingProductId,
          }),
        },
      );

      const json = (await response.json()) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal menghapus produk");
      }

      setMessage(json.message ?? "Produk berhasil dihapus");
      await loadDashboard();
      syncBookingDataLocally(bookingId, (current) => ({
        ...current,
        products: current.products.filter(
          (item) => item.id !== bookingProductId,
        ),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus produk");
    } finally {
      setRemovingProductId(null);
    }
  }

  async function openReceipt(bookingId: string) {
    try {
      setLoadingReceipt(true);
      setError(null);

      const response = await authFetch(`/api/payments/receipt/${bookingId}`);
      const json = (await response.json()) as {
        message?: string;
        receipt?: ReceiptDetail;
      };

      if (!response.ok || !json.receipt) {
        throw new Error(json.message ?? "Gagal memuat detail nota");
      }

      setReceiptModal(json.receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail nota");
    } finally {
      setLoadingReceipt(false);
    }
  }

  function printReceipt() {
    if (!receiptModal) {
      return;
    }

    const customerName = receiptModal.customer.fullName ?? "Walk-in";
    const paidAtLabel = receiptModal.payment?.paidAt
      ? formatIndonesianDateTime(receiptModal.payment.paidAt)
      : "-";

    const productRows = receiptModal.products
      .map(
        (item) => `
          <tr>
            <td style="padding:4px 0; border-bottom:1px dashed #ddd;">${item.itemName}</td>
            <td style="padding:4px 0; border-bottom:1px dashed #ddd; text-align:center;">${item.quantity}</td>
            <td style="padding:4px 0; border-bottom:1px dashed #ddd; text-align:right;">${toRupiah(item.subtotal)}</td>
          </tr>
        `,
      )
      .join("");

    const html = `
      <html>
        <head><title>Nota ${receiptModal.booking.code}</title></head>
        <body style="font-family:Arial, sans-serif; padding:20px; color:#111;">
          <h2 style="margin:0;">${receiptModal.branch.name}</h2>
          <p style="margin:4px 0 16px; font-size:12px; color:#555;">Cabang ${receiptModal.branch.code}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>No Booking:</strong> ${receiptModal.booking.code}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Pelanggan:</strong> ${customerName}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Barber:</strong> ${receiptModal.barberman?.name ?? "-"}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Jadwal:</strong> ${formatIndonesianDateTime(receiptModal.booking.scheduledStart)}</p>
          <hr style="margin:16px 0;" />
          <table style="width:100%; font-size:13px; border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;">${receiptModal.service.name}</td>
              <td style="text-align:center;">1</td>
              <td style="text-align:right;">${toRupiah(receiptModal.service.price)}</td>
            </tr>
            ${productRows}
          </table>
          <hr style="margin:16px 0;" />
          <p style="margin:2px 0; font-size:13px;"><strong>Total:</strong> ${toRupiah(receiptModal.totals.amountDue)}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Metode:</strong> ${receiptModal.payment?.method ?? "-"}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Bayar:</strong> ${receiptModal.payment?.amountPaid !== null && receiptModal.payment?.amountPaid !== undefined ? toRupiah(receiptModal.payment.amountPaid) : "-"}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Kembalian:</strong> ${receiptModal.payment?.changeAmount !== null && receiptModal.payment?.changeAmount !== undefined ? toRupiah(receiptModal.payment.changeAmount) : "-"}</p>
          <p style="margin:2px 0; font-size:13px;"><strong>Waktu Bayar:</strong> ${paidAtLabel}</p>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=480,height=700");
    if (!printWindow) {
      setError("Popup blocker aktif. Izinkan popup untuk cetak nota.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const pollPaymentStatus = useCallback(
    async (bookingId: string, silent = true) => {
      if (!silent) {
        setPollingPayment(true);
      }

      try {
        const response = await authFetch(`/api/payments/booking/${bookingId}`);
        const json = (await response.json()) as {
          message?: string;
          booking?: { status?: BookingItem["status"] };
          payment?: PaymentInfo | null;
        };

        if (!response.ok) {
          throw new Error(json.message ?? "Gagal memuat status pembayaran");
        }

        const bookingStatus = json.booking?.status;
        const payment = json.payment ?? null;

        if (bookingStatus === "COMPLETED" || payment?.status === "PAID") {
          syncBookingStatusLocally(bookingId, "COMPLETED");
          if (!silent) {
            setMessage(
              "Pembayaran QRIS terkonfirmasi. Booking otomatis menjadi COMPLETED.",
            );
          }
        }

        setQrisModal((prev) => {
          if (!prev || prev.bookingId !== bookingId) {
            return prev;
          }

          return {
            ...prev,
            paymentId: payment?.id ?? prev.paymentId,
            paymentStatus: payment?.status ?? prev.paymentStatus,
            externalRef: payment?.externalRef ?? prev.externalRef,
          };
        });
      } catch (err) {
        if (!silent) {
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat status pembayaran",
          );
        }
      } finally {
        if (!silent) {
          setPollingPayment(false);
        }
      }
    },
    [syncBookingStatusLocally],
  );

  useEffect(() => {
    if (!qrisModalOpen || !qrisBookingId) {
      return;
    }

    void pollPaymentStatus(qrisBookingId, false);

    const timer = window.setInterval(() => {
      void pollPaymentStatus(qrisBookingId);
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [qrisModalOpen, qrisBookingId, pollPaymentStatus]);

  useEffect(() => {
    const pendingBookings = (data?.bookings ?? []).filter(
      (booking) => booking.status === "PAYMENT_PENDING",
    );

    if (pendingBookings.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      for (const booking of pendingBookings) {
        void pollPaymentStatus(booking.id);
      }
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [data?.bookings, pollPaymentStatus]);

  useEffect(() => {
    if (branchId && date && role) {
      loadDashboard();
    }
  }, [branchId, date, role, loadDashboard]);

  async function updateStatus(
    bookingId: string,
    status: "IN_PROGRESS" | "COMPLETED",
  ) {
    const booking = data?.bookings.find((item) => item.id === bookingId);
    const confirmed = await confirmAction({
      title:
        status === "IN_PROGRESS"
          ? "Mulai layanan booking?"
          : "Tandai booking selesai?",
      text: `Status booking ${booking?.code ?? "ini"} akan diubah menjadi ${status}.`,
      confirmButtonText:
        status === "IN_PROGRESS" ? "Ya, mulai" : "Ya, selesaikan",
      icon: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setMessage(null);

      const body: { status: "IN_PROGRESS" | "COMPLETED"; branchId?: string } = {
        status,
      };
      if (role === "SUPER_ADMIN") {
        body.branchId = branchId;
      }

      const response = await authFetch(`/api/bookings/admin/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal update status");
      }

      setMessage(json.message ?? "Status booking ter-update");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update status");
    }
  }

  async function payCash(booking: BookingItem) {
    const bookingId = booking.id;
    const amountDue = booking.remainingDue;
    const amountInput = await Swal.fire({
      title: "Konfirmasi pembayaran cash",
      text: `Masukkan nominal cash diterima untuk booking ${booking.code}. Minimal ${toRupiah(amountDue)}.`,
      input: "text",
      inputValue: String(amountDue),
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, proses",
      cancelButtonText: "Batal",
      confirmButtonColor: "#111827",
      cancelButtonColor: "#6b7280",
      inputValidator: (value) => {
        const amount = Number(value.replace(/[^\d]/g, ""));
        if (!Number.isFinite(amount) || amount <= 0) {
          return "Nominal cash tidak valid";
        }
        if (amount < amountDue) {
          return `Nominal minimal ${toRupiah(amountDue)}`;
        }
        return null;
      },
    });

    if (!amountInput.isConfirmed || !amountInput.value) {
      return;
    }

    const amountPaid = Number(amountInput.value.replace(/[^\d]/g, ""));
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      setError("Nominal cash tidak valid");
      return;
    }

    try {
      setError(null);
      setMessage(null);

      const response = await authFetch("/api/payments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          method: "CASH",
          amountPaid,
        }),
      });

      const json = (await response.json()) as {
        message?: string;
        result?: {
          booking?: { id: string };
        };
      };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal memproses pembayaran cash");
      }

      setMessage(json.message ?? "Pembayaran cash berhasil");
      await loadDashboard();
      setPaymentSuccess({
        bookingId: json.result?.booking?.id ?? bookingId,
        bookingCode: booking.code,
        amount: amountDue,
        method: "CASH",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memproses pembayaran cash",
      );
    }
  }

  async function payQris(booking: BookingItem) {
    const confirmed = await confirmAction({
      title: "Proses pembayaran QRIS?",
      text: `QRIS untuk booking ${booking.code} akan dibuat.`,
      confirmButtonText: "Ya, buat QRIS",
    });

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setMessage(null);

      const response = await authFetch("/api/payments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          method: "QRIS",
        }),
      });

      const json = (await response.json()) as {
        message?: string;
        result?: {
          payment?: PaymentInfo;
          qris?: QrisResponse;
        };
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal inisialisasi QRIS");
      }

      syncBookingStatusLocally(booking.id, "PAYMENT_PENDING");

      setQrisModal({
        bookingId: booking.id,
        bookingCode: booking.code,
        paymentId: json.result?.payment?.id ?? null,
        paymentStatus: json.result?.payment?.status ?? "PENDING",
        externalRef:
          json.result?.payment?.externalRef ??
          json.result?.qris?.referenceId ??
          null,
        qrString: json.result?.qris?.qrString ?? null,
        expiresAt: json.result?.qris?.expiresAt ?? null,
      });
      setQrisModalVisible(true);

      setMessage(json.message ?? "QRIS berhasil diinisialisasi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal inisialisasi QRIS");
    }
  }

  async function retryQris() {
    if (!qrisModal?.paymentId) {
      setError(
        "Payment QRIS tidak ditemukan. Inisialisasi ulang dari booking.",
      );
      return;
    }

    const confirmed = await confirmAction({
      title: "Buat ulang QRIS?",
      text: `QRIS booking ${qrisModal.bookingCode} akan dibuat ulang.`,
      confirmButtonText: "Ya, buat ulang",
      icon: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      setRetryingQris(true);
      setError(null);
      setMessage(null);

      const response = await authFetch("/api/payments/qris/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: qrisModal.paymentId }),
      });

      const json = (await response.json()) as {
        message?: string;
        result?: {
          payment?: PaymentInfo;
          qris?: QrisResponse;
        };
      };

      if (!response.ok) {
        throw new Error(json.message ?? "Gagal retry QRIS");
      }

      setQrisModal((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          paymentId: json.result?.payment?.id ?? prev.paymentId,
          paymentStatus: json.result?.payment?.status ?? "PENDING",
          externalRef:
            json.result?.payment?.externalRef ??
            json.result?.qris?.referenceId ??
            prev.externalRef,
          qrString: json.result?.qris?.qrString ?? prev.qrString,
          expiresAt: json.result?.qris?.expiresAt ?? prev.expiresAt,
        };
      });

      syncBookingStatusLocally(qrisModal.bookingId, "PAYMENT_PENDING");
      setMessage(json.message ?? "QRIS berhasil dibuat ulang");
      setQrisModalVisible(true);
      await pollPaymentStatus(qrisModal.bookingId, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal retry QRIS");
    } finally {
      setRetryingQris(false);
    }
  }

  async function copyQrString() {
    if (!qrisModal?.qrString) {
      return;
    }

    try {
      await navigator.clipboard.writeText(qrisModal.qrString);
      setMessage("QR string berhasil disalin");
    } catch {
      setError("Gagal menyalin QR string");
    }
  }

  function openQrisModal(booking: BookingItem) {
    setError(null);
    setMessage(null);
    if (qrisModal?.bookingId !== booking.id) {
      setQrisModal({
        bookingId: booking.id,
        bookingCode: booking.code,
        paymentId: null,
        paymentStatus: null,
        externalRef: null,
        qrString: null,
        expiresAt: null,
      });
    }

    setQrisModalVisible(true);
  }

  async function createWalkIn() {
    if (!walkInName || !walkInServiceId || !date || !walkInTime) {
      setError("Lengkapi data walk-in terlebih dahulu");
      return;
    }

    const confirmed = await confirmAction({
      title: "Tambah walk-in?",
      text: `Booking walk-in untuk ${walkInName} pada ${date} ${walkInTime} akan dibuat.`,
      confirmButtonText: "Ya, tambah",
    });

    if (!confirmed) {
      return;
    }

    try {
      setSubmittingWalkIn(true);
      setError(null);
      setMessage(null);

      const response = await authFetch("/api/bookings/admin/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: role === "SUPER_ADMIN" ? branchId : undefined,
          serviceId: walkInServiceId,
          barbermanId: walkInBarberId || undefined,
          walkInName,
          walkInPhone: walkInPhone || undefined,
          scheduledStart: toDateTimeIso(date, walkInTime),
        }),
      });

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "Gagal menambah walk-in");
      }

      setMessage(json.message ?? "Walk-in berhasil ditambahkan");
      setWalkInOpen(false);
      setWalkInName("");
      setWalkInPhone("");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah walk-in");
    } finally {
      setSubmittingWalkIn(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Reservasi Harian</h2>
          <p className="text-xs text-gray-500 mt-1">
            Data realtime dari API booking.
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

          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white"
          />

          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            className="bg-black text-white rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Tambah Walk-in
          </button>

          <button
            type="button"
            onClick={loadDashboard}
            className="border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Total
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {data.summary.total}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Upcoming
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {data.summary.upcoming}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              In Progress
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {data.summary.inProgress}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Payment Pending
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {data.summary.paymentPending}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Completed
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {data.summary.completed}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Pelanggan
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Layanan
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Barber
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Jadwal
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
                Status
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
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Loading...
                </td>
              </tr>
            )}

            {!loading && (data?.bookings.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Tidak ada reservasi pada tanggal ini
                </td>
              </tr>
            )}

            {!loading &&
              (data?.bookings ?? []).map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-gray-50 last:border-b-0"
                >
                  <td className="px-4 py-3 text-xs text-gray-900">
                    {booking.member?.fullName ??
                      booking.walkInName ??
                      "Walk-in"}
                    {booking.isWalkIn && (
                      <span className="text-[10px] text-orange-600 ml-2">
                        Walk-in
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    <div className="space-y-1">
                      <p>
                        {booking.service.name}
                        <span className="text-gray-400 ml-2">
                          {toRupiah(booking.service.price)}
                        </span>
                      </p>
                      {booking.products.length > 0 && (
                        <div className="space-y-0.5">
                          {booking.products.map((product) => (
                            <p
                              key={product.id}
                              className="text-[11px] text-gray-500"
                            >
                              + {product.itemName} x{product.quantity} (
                              {toRupiah(product.subtotal)})
                            </p>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] font-semibold text-gray-800">
                        Total tagihan: {toRupiah(booking.totalDue)}
                      </p>
                      <p className="text-[11px] font-semibold text-emerald-700">
                        Sisa tagihan: {toRupiah(booking.remainingDue)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {booking.barberman.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {formatIndonesianDateTime(booking.scheduledStart)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full font-semibold ${statusBadge(booking.status)}`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      {booking.status === "UPCOMING" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(booking.id, "IN_PROGRESS")
                          }
                          className="px-2.5 py-1.5 text-[11px] rounded-md bg-black text-white font-semibold"
                        >
                          Mulai
                        </button>
                      )}

                      {booking.status === "IN_PROGRESS" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setProductModal({
                                bookingId: booking.id,
                                bookingCode: booking.code,
                                bookingStatus: booking.status,
                              })
                            }
                            className="px-2.5 py-1.5 text-[11px] rounded-md bg-slate-100 text-slate-700 font-semibold"
                          >
                            Produk
                          </button>
                          <button
                            type="button"
                            onClick={() => payCash(booking)}
                            className="px-2.5 py-1.5 text-[11px] rounded-md bg-emerald-600 text-white font-semibold"
                          >
                            Cash Sisa
                          </button>
                          <button
                            type="button"
                            onClick={() => payQris(booking)}
                            className="px-2.5 py-1.5 text-[11px] rounded-md bg-violet-600 text-white font-semibold"
                          >
                            QRIS Sisa
                          </button>
                        </>
                      )}

                      {booking.status === "UPCOMING" && (
                        <button
                          type="button"
                          onClick={() =>
                            setProductModal({
                              bookingId: booking.id,
                              bookingCode: booking.code,
                              bookingStatus: booking.status,
                            })
                          }
                          className="px-2.5 py-1.5 text-[11px] rounded-md bg-slate-100 text-slate-700 font-semibold"
                        >
                          Produk
                        </button>
                      )}

                      {booking.status === "PAYMENT_PENDING" && (
                        <button
                          type="button"
                          onClick={() => openQrisModal(booking)}
                          className="px-2.5 py-1.5 text-[11px] rounded-md bg-violet-100 text-violet-700 font-semibold"
                        >
                          Detail QRIS
                        </button>
                      )}

                      {booking.status === "COMPLETED" && (
                        <button
                          type="button"
                          onClick={() => void openReceipt(booking.id)}
                          className="px-2.5 py-1.5 text-[11px] rounded-md bg-emerald-100 text-emerald-700 font-semibold"
                        >
                          Nota
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {loadingReceipt && (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
          Memuat detail nota...
        </div>
      )}

      {walkInOpen && selectedBranch && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                Tambah Walk-in
              </h3>
              <button
                type="button"
                onClick={() => setWalkInOpen(false)}
                className="text-xs text-gray-500"
              >
                Tutup
              </button>
            </div>

            <label className="block">
              <span className="text-xs text-gray-500">Nama pelanggan</span>
              <input
                value={walkInName}
                onChange={(event) => setWalkInName(event.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Nomor HP (opsional)</span>
              <input
                value={walkInPhone}
                onChange={(event) => setWalkInPhone(event.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Layanan</span>
              <select
                value={walkInServiceId}
                onChange={(event) => setWalkInServiceId(event.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {selectedBranch.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {toRupiah(service.price)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Barber (opsional)</span>
              <select
                value={walkInBarberId}
                onChange={(event) => setWalkInBarberId(event.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Siapa saja</option>
                {selectedBranch.barbermen.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Jam</span>
              <input
                type="time"
                value={walkInTime}
                onChange={(event) => setWalkInTime(event.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWalkInOpen(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={createWalkIn}
                disabled={submittingWalkIn}
                className="flex-1 bg-black text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-50"
              >
                {submittingWalkIn ? "Memproses..." : "Tambahkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {productModal && selectedProductBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Produk Booking
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Booking {selectedProductBooking.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProductModal(null)}
                className="text-xs text-gray-500"
              >
                Tutup
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-xs text-gray-600">
                Service:{" "}
                <span className="font-semibold">
                  {selectedProductBooking.service.name}
                </span>
                <span className="ml-2">
                  {toRupiah(selectedProductBooking.service.price)}
                </span>
              </p>
              <p className="text-xs text-gray-700 font-semibold mt-1">
                Total tagihan saat ini:{" "}
                {toRupiah(selectedProductBooking.totalDue)}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_130px] gap-2 items-end">
              <label className="block">
                <span className="text-xs text-gray-500">Pilih Produk</span>
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {productCatalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku}) - {toRupiah(item.sellingPrice)} •
                      stok {item.stockQty}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">Qty</span>
                <input
                  type="number"
                  min={1}
                  value={selectedProductQty}
                  onChange={(event) =>
                    setSelectedProductQty(
                      Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                    )
                  }
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>

              <button
                type="button"
                onClick={addProductToBooking}
                disabled={savingProduct || productCatalog.length === 0}
                className="bg-black text-white rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {savingProduct ? "Menyimpan..." : "Tambah Produk"}
              </button>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-gray-500">
                      Produk
                    </th>
                    <th className="text-left px-3 py-2 text-gray-500">Qty</th>
                    <th className="text-left px-3 py-2 text-gray-500">
                      Subtotal
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {selectedProductBooking.products.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-center text-gray-500"
                      >
                        Belum ada produk tambahan
                      </td>
                    </tr>
                  )}

                  {selectedProductBooking.products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b last:border-b-0 border-gray-100"
                    >
                      <td className="px-3 py-2 text-gray-700">
                        {product.itemName}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {product.quantity}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {toRupiah(product.subtotal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            removeProductFromBooking(
                              selectedProductBooking.id,
                              product.id,
                            )
                          }
                          disabled={removingProductId === product.id}
                          className="text-[11px] rounded-md px-2 py-1 bg-red-50 text-red-700 font-semibold disabled:opacity-50"
                        >
                          {removingProductId === product.id
                            ? "Hapus..."
                            : "Hapus"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {qrisModalOpen && qrisModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  QRIS Payment
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Booking {qrisModal.bookingCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrisModalVisible(false)}
                className="text-xs text-gray-500"
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <p className="text-gray-600">
                Status payment:{" "}
                <span className="font-semibold text-gray-900">
                  {qrisModal.paymentStatus ?? "-"}
                </span>
                {pollingPayment && (
                  <span className="ml-2 text-[11px] text-gray-500">
                    mengecek...
                  </span>
                )}
              </p>
              {qrisModal.externalRef && (
                <p className="text-gray-600">
                  Reference:{" "}
                  <span className="font-mono">{qrisModal.externalRef}</span>
                </p>
              )}
              {qrisModal.expiresAt && (
                <p className="text-gray-600">
                  Berlaku sampai:{" "}
                  {formatIndonesianDateTime(qrisModal.expiresAt)}
                </p>
              )}
            </div>

            {qrisModal.qrString ? (
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (qrisModal.qrString) {
                        window.location.replace(qrisModal.qrString);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow w-full text-center block transition-colors"
                  >
                    Buka Link Pembayaran Xendit
                  </button>
                </div>
                <button
                  type="button"
                  onClick={copyQrString}
                  className="w-full border border-gray-300 rounded-lg py-2 text-xs font-semibold"
                >
                  Salin Link Pembayaran
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                QR string belum tersedia di sesi ini. Jika payment sudah
                expired, gunakan retry untuk generate QR baru.
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQrisModalVisible(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={retryQris}
                disabled={retryingQris || !qrisModal.paymentId || !canRetryQris}
                className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-50"
              >
                {retryingQris ? "Retrying..." : "Retry QRIS"}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-gray-200 p-5 space-y-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Nota Pembayaran
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Booking {receiptModal.booking.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="text-xs text-gray-500"
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                <p>
                  <span className="text-gray-500">Cabang:</span>{" "}
                  {receiptModal.branch.name}
                </p>
                <p>
                  <span className="text-gray-500">Pelanggan:</span>{" "}
                  {receiptModal.customer.fullName ?? "Walk-in"}
                </p>
                <p>
                  <span className="text-gray-500">Barber:</span>{" "}
                  {receiptModal.barberman?.name ?? "-"}
                </p>
                <p>
                  <span className="text-gray-500">Jadwal:</span>{" "}
                  {formatIndonesianDateTime(
                    receiptModal.booking.scheduledStart,
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                <p>
                  <span className="text-gray-500">Metode:</span>{" "}
                  {receiptModal.payment?.method ?? "-"}
                </p>
                <p>
                  <span className="text-gray-500">Status:</span>{" "}
                  {receiptModal.payment?.status ?? "-"}
                </p>
                <p>
                  <span className="text-gray-500">Waktu Bayar:</span>{" "}
                  {receiptModal.payment?.paidAt
                    ? formatIndonesianDateTime(receiptModal.payment.paidAt)
                    : "-"}
                </p>
                {receiptModal.payment?.externalRef && (
                  <p>
                    <span className="text-gray-500">Reference:</span>{" "}
                    <span className="font-mono">
                      {receiptModal.payment.externalRef}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-gray-500">Item</th>
                    <th className="text-left px-3 py-2 text-gray-500">Qty</th>
                    <th className="text-right px-3 py-2 text-gray-500">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">
                      {receiptModal.service.name}
                    </td>
                    <td className="px-3 py-2 text-gray-700">1</td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {toRupiah(receiptModal.service.price)}
                    </td>
                  </tr>

                  {receiptModal.products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b last:border-b-0 border-gray-100"
                    >
                      <td className="px-3 py-2 text-gray-700">
                        {product.itemName}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {product.quantity}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {toRupiah(product.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs space-y-1">
              <p className="flex justify-between">
                <span className="text-gray-500">Subtotal Service</span>
                <span className="font-semibold">
                  {toRupiah(receiptModal.totals.service)}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-gray-500">Subtotal Produk</span>
                <span className="font-semibold">
                  {toRupiah(receiptModal.totals.products)}
                </span>
              </p>
              <p className="flex justify-between text-sm">
                <span className="text-gray-900 font-bold">Total Tagihan</span>
                <span className="text-gray-900 font-bold">
                  {toRupiah(receiptModal.totals.amountDue)}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-gray-500">Nominal Bayar</span>
                <span className="font-semibold">
                  {receiptModal.payment?.amountPaid !== null &&
                  receiptModal.payment?.amountPaid !== undefined
                    ? toRupiah(receiptModal.payment.amountPaid)
                    : "-"}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-gray-500">Kembalian</span>
                <span className="font-semibold">
                  {receiptModal.payment?.changeAmount !== null &&
                  receiptModal.payment?.changeAmount !== undefined
                    ? toRupiah(receiptModal.payment.changeAmount)
                    : "-"}
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={printReceipt}
                className="flex-1 bg-black text-white rounded-lg py-2 text-xs font-semibold"
              >
                Cetak Nota
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentSuccessModal
        isOpen={paymentSuccess !== null}
        title="Pembayaran Berhasil"
        description={
          paymentSuccess
            ? `Pelunasan booking ${paymentSuccess.bookingCode} berhasil via ${paymentSuccess.method}.`
            : ""
        }
        amountLabel={
          paymentSuccess
            ? `Nominal: ${toRupiah(paymentSuccess.amount)}`
            : undefined
        }
        buttonLabel="Lihat Nota"
        onClose={() => {
          const bookingId = paymentSuccess?.bookingId;
          setPaymentSuccess(null);
          if (bookingId) {
            void openReceipt(bookingId);
          }
        }}
      />
    </div>
  );
}
