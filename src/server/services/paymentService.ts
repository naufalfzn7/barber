import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { env } from "@/server/core/env";
import { bookingRepository } from "@/server/repositories/bookingRepository";
import { paymentRepository } from "@/server/repositories/paymentRepository";
import {
  getEarlierDeadline,
  getPendingBookingHoldExpiresAt,
  PENDING_BOOKING_HOLD_MINUTES,
} from "@/server/services/bookingHold";
import {
  formatDepositDeadlineLabel,
  getDepositPaymentDeadline,
  getDepositPaymentDeadlineHours,
} from "@/server/services/depositSettings";

type Actor = {
  userId: string;
  role: UserRole;
  branchId?: string | null;
};

type CompletePaymentInput = {
  bookingId: string;
  method: "QRIS" | "CASH";
  amountPaid?: number;
  actor: Actor;
};

type RetryQrisInput = {
  paymentId: string;
  actor: Actor;
};

type XenditQrisPayload = {
  external_id?: string;
  reference_id?: string;
  status?: string;
  paid_at?: string;
};

const XENDIT_CALLBACK_URL_REGEX =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,63}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

function assertAdminScope(actor: Actor, bookingBranchId: string) {
  if (actor.role === "ADMIN" && actor.branchId !== bookingBranchId) {
    throw new Error("Forbidden for other branch");
  }
}

async function assignQueueAfterPaidDeposit(result: {
  payment: { status: PaymentStatus; isDeposit: boolean };
  booking: { id: string } | null;
}) {
  if (
    result.booking &&
    result.payment.status === PaymentStatus.PAID &&
    result.payment.isDeposit
  ) {
    await bookingRepository.assignQueueTicket(result.booking.id);
  }
}

function toNumberDecimal(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function toPrismaDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function generateExternalRef(bookingCode: string): string {
  const compactBooking = bookingCode
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-12)
    .toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `QRIS-${compactBooking}-${stamp}`;
}

function normalizeXenditStatus(
  status: string | undefined,
): PaymentStatus | null {
  if (!status) {
    return null;
  }

  const upper = status.toUpperCase();
  if (["SUCCEEDED", "COMPLETED", "PAID", "SETTLED"].includes(upper)) {
    return PaymentStatus.PAID;
  }

  if (["EXPIRED"].includes(upper)) {
    return PaymentStatus.EXPIRED;
  }

  if (["FAILED"].includes(upper)) {
    return PaymentStatus.FAILED;
  }

  if (["PENDING", "ACTIVE"].includes(upper)) {
    return PaymentStatus.PENDING;
  }

  return null;
}

const MIN_XENDIT_INVOICE_DURATION_SECONDS = 60;

async function createXenditInvoice(input: {
  externalRef: string;
  amount: number;
  expiresAt?: Date;
}) {
  const callbackUrl =
    env.xenditCallbackUrl?.trim() ||
    `${env.appUrl}/api/payments/webhook/xendit`;

  if (!XENDIT_CALLBACK_URL_REGEX.test(callbackUrl)) {
    throw new Error(
      "Invalid XENDIT callback URL. Set XENDIT_CALLBACK_URL to a public URL (for example: https://your-domain.com/api/payments/webhook/xendit).",
    );
  }

  const basic = Buffer.from(`${env.xenditSecretKey}:`).toString("base64");

  const response = await fetch("https://api.xendit.co/v2/invoices", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: input.externalRef,
      amount: Math.round(input.amount),
      description: `Payment for booking ${input.externalRef}`,
      ...(input.expiresAt
        ? {
            invoice_duration: Math.floor(
              (input.expiresAt.getTime() - Date.now()) / 1000,
            ),
          }
        : {}),
      success_redirect_url: `${env.appUrl}/reservasi/pembayaran-sukses?xendit_ref=${encodeURIComponent(input.externalRef)}&xendit_status=paid`,
      callback_url: callbackUrl,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    external_id?: string;
    reference_id?: string;
    invoice_url?: string;
    qr_string?: string;
    status?: string;
    expiry_date?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(body.message ?? "Failed to create invoice transaction");
  }

  return {
    id: body.id ?? null,
    referenceId: body.external_id ?? body.reference_id ?? input.externalRef,
    qrString: body.invoice_url ?? null, // Store invoice URL in qrString column to avoid Prisma changes
    status: body.status ?? "PENDING",
    expiresAt: input.expiresAt?.toISOString() ?? body.expiry_date ?? null,
  };
}

export const paymentService = {
  async getReceiptByBookingId(bookingId: string, actor: Actor) {
    const booking = await paymentRepository.findReceiptByBookingId(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    assertAdminScope(actor, booking.branchId);

    if (actor.role === "MEMBER" && booking.memberId !== actor.userId) {
      throw new Error("Forbidden for other member booking");
    }

    const productsTotal = booking.products.reduce(
      (sum, product) => sum + toNumberDecimal(product.subtotal),
      0,
    );
    const serviceTotal = toNumberDecimal(booking.service.price);
    const amountDue = serviceTotal + productsTotal;

    return {
      receipt: {
        booking: {
          id: booking.id,
          code: booking.code,
          status: booking.status,
          scheduledStart: booking.scheduledStart,
          completedAt: booking.completedAt,
          isWalkIn: booking.isWalkIn,
          walkInName: booking.walkInName,
          walkInPhone: booking.walkInPhone,
        },
        branch: {
          id: booking.branch.id,
          code: booking.branch.code,
          name: booking.branch.name,
        },
        customer: {
          fullName: booking.member?.fullName ?? booking.walkInName ?? null,
          email: booking.member?.email ?? null,
          phoneNumber:
            booking.member?.phoneNumber ?? booking.walkInPhone ?? null,
        },
        barberman: booking.barberman
          ? {
              id: booking.barberman.id,
              name: booking.barberman.name,
            }
          : null,
        service: {
          id: booking.service.id,
          name: booking.service.name,
          price: serviceTotal,
        },
        products: booking.products.map((product) => ({
          id: product.id,
          itemName: product.itemName,
          quantity: product.quantity,
          unitPrice: toNumberDecimal(product.unitPrice),
          subtotal: toNumberDecimal(product.subtotal),
        })),
        totals: {
          service: serviceTotal,
          products: productsTotal,
          amountDue,
        },
        payment: booking.payment
          ? {
              id: booking.payment.id,
              method: booking.payment.method,
              status: booking.payment.status,
              amountDue: toNumberDecimal(booking.payment.amountDue),
              amountPaid: booking.payment.amountPaid
                ? toNumberDecimal(booking.payment.amountPaid)
                : null,
              changeAmount: booking.payment.changeAmount
                ? toNumberDecimal(booking.payment.changeAmount)
                : null,
              paidAt: booking.payment.paidAt,
              externalRef: booking.payment.externalRef,
            }
          : null,
      },
    };
  },

  async confirmQrisByReference(input: { externalRef: string; actor: Actor }) {
    const payment = await paymentRepository.findPaymentByExternalRef(
      input.externalRef,
    );
    if (!payment) {
      throw new Error("Payment reference not found");
    }

    if (payment.method !== PaymentMethod.QRIS) {
      throw new Error("Payment method is not QRIS");
    }

    const booking = await paymentRepository.findBookingForPayment(
      payment.bookingId,
    );
    if (!booking) {
      throw new Error("Booking not found");
    }

    assertAdminScope(input.actor, booking.branchId);

    const result = await paymentRepository.applyQrisWebhookStatus({
      externalRef: input.externalRef,
      paymentStatus: PaymentStatus.PAID,
      paidAt: new Date(),
    });

    if (!result) {
      throw new Error("Payment reference not found");
    }

    await assignQueueAfterPaidDeposit(result);

    return result;
  },

  async complete(input: CompletePaymentInput) {
    const booking = await paymentRepository.findBookingForPayment(
      input.bookingId,
    );
    if (!booking) {
      throw new Error("Booking not found");
    }

    assertAdminScope(input.actor, booking.branchId);

    if (
      booking.status !== BookingStatus.IN_PROGRESS &&
      booking.status !== BookingStatus.PAYMENT_PENDING
    ) {
      throw new Error("Booking is not ready for payment");
    }

    const productsTotal = booking.products.reduce(
      (sum, product) => sum + toNumberDecimal(product.subtotal),
      0,
    );
    const totalDue = toNumberDecimal(booking.service.price) + productsTotal;
    const alreadyPaid =
      booking.payment?.status === PaymentStatus.PAID
        ? toNumberDecimal(booking.payment.amountPaid ?? new Prisma.Decimal(0))
        : 0;
    const remainingDue = Math.max(totalDue - alreadyPaid, 0);

    if (input.method === "CASH") {
      if (
        typeof input.amountPaid !== "number" ||
        Number.isNaN(input.amountPaid)
      ) {
        throw new Error("amountPaid is required for cash payment");
      }

      if (input.amountPaid < remainingDue) {
        throw new Error("Cash paid amount is insufficient");
      }

      const changeAmount = input.amountPaid - remainingDue;

      const result = await paymentRepository.completeCashPayment({
        bookingId: booking.id,
        changedById: input.actor.userId,
        totalDue: toPrismaDecimal(totalDue),
        cashReceived: toPrismaDecimal(input.amountPaid),
        remainingDue: toPrismaDecimal(remainingDue),
        changeAmount: toPrismaDecimal(changeAmount),
        depositAmount:
          booking.payment?.status === PaymentStatus.PAID &&
          booking.payment?.isDeposit
            ? booking.payment.amountPaid
            : null,
      });

      if (!result) {
        throw new Error("Booking not found");
      }

      return {
        method: PaymentMethod.CASH,
        booking: result.booking,
        payment: result.payment,
      };
    }

    if (remainingDue <= 0) {
      throw new Error("No remaining payment due");
    }

    const externalRef = generateExternalRef(booking.code);
    const qris = await createXenditInvoice({
      externalRef,
      amount: remainingDue,
    });

    if (booking.status === BookingStatus.IN_PROGRESS) {
      await paymentRepository.setBookingPaymentPending({
        bookingId: booking.id,
        changedById: input.actor.userId,
        reason: "Service completed, waiting QRIS payment",
        serviceEndAt: new Date(),
      });
    }

    const payment = await paymentRepository.upsertQrisPayment({
      bookingId: booking.id,
      amountDue: toPrismaDecimal(remainingDue),
      externalRef: qris.referenceId,
      depositAmount:
        booking.payment?.status === PaymentStatus.PAID &&
        booking.payment?.isDeposit
          ? booking.payment.amountPaid
          : null,
      isDeposit: false,
      qrisString: qris.qrString,
      qrisImageUrl: qris.qrString, // Invoice URL
      qrisExpiresAt: qris.expiresAt ? new Date(qris.expiresAt) : null,
    });

    return {
      method: PaymentMethod.QRIS,
      bookingId: booking.id,
      payment,
      qris,
    };
  },

  async retryQris(input: RetryQrisInput) {
    const payment = await paymentRepository.findPaymentWithBooking(
      input.paymentId,
    );
    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.method !== PaymentMethod.QRIS) {
      throw new Error("Payment method is not QRIS");
    }

    // Skip admin scope check for members (verified at endpoint layer)
    if (input.actor.role !== "MEMBER") {
      assertAdminScope(input.actor, payment.booking.branchId);
    }

    if (
      payment.status !== PaymentStatus.EXPIRED &&
      payment.status !== PaymentStatus.FAILED &&
      payment.status !== PaymentStatus.PENDING
    ) {
      throw new Error("QRIS payment cannot be retried in current status");
    }

    if (payment.booking.status !== BookingStatus.PAYMENT_PENDING) {
      throw new Error("Booking is not in payment pending state");
    }

    const externalRef = generateExternalRef(payment.booking.code);
    const amountDue = toNumberDecimal(payment.amountDue);
    const deadlineHours = payment.isDeposit
      ? await getDepositPaymentDeadlineHours()
      : null;
    const expiresAt = payment.isDeposit
      ? getEarlierDeadline(
          getDepositPaymentDeadline({
            scheduledStart: payment.booking.scheduledStart,
            deadlineHours: deadlineHours ?? 1,
          }),
          getPendingBookingHoldExpiresAt(payment.booking.createdAt),
        )
      : undefined;

    if (
      expiresAt &&
      expiresAt.getTime() - Date.now() <
        MIN_XENDIT_INVOICE_DURATION_SECONDS * 1000
    ) {
      throw new Error(
        `Batas pembayaran deposit sudah lewat. Selesaikan pembayaran maksimal ${PENDING_BOOKING_HOLD_MINUTES} menit setelah reservasi dibuat atau paling lambat ${formatDepositDeadlineLabel(deadlineHours ?? 1)} sebelum jadwal reservasi.`,
      );
    }

    const qris = await createXenditInvoice({
      externalRef,
      amount: amountDue,
      expiresAt,
    });

    const updated = await paymentRepository.upsertQrisPayment({
      bookingId: payment.bookingId,
      amountDue: payment.amountDue,
      externalRef: qris.referenceId,
      depositAmount: payment.depositAmount,
      isDeposit: payment.isDeposit,
      qrisString: qris.qrString,
      qrisImageUrl: qris.qrString, // Invoice URL
      qrisExpiresAt: qris.expiresAt ? new Date(qris.expiresAt) : null,
    });

    return {
      payment: updated,
      qris,
    };
  },

  async getByBookingId(bookingId: string, actor: Actor) {
    const booking = await paymentRepository.findBookingForPayment(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    assertAdminScope(actor, booking.branchId);

    return {
      booking: {
        id: booking.id,
        code: booking.code,
        status: booking.status,
        branchId: booking.branchId,
      },
      payment: booking.payment,
    };
  },

  async handleXenditWebhook(payload: XenditQrisPayload) {
    const externalRef = payload.external_id ?? payload.reference_id;
    if (!externalRef) {
      throw new Error("Missing external reference in webhook payload");
    }

    const paymentStatus = normalizeXenditStatus(payload.status);
    if (!paymentStatus) {
      throw new Error("Unsupported payment status from webhook");
    }

    const paidAt = payload.paid_at ? new Date(payload.paid_at) : undefined;

    const result = await paymentRepository.applyQrisWebhookStatus({
      externalRef,
      paymentStatus,
      paidAt,
    });

    if (!result) {
      throw new Error("Payment reference not found");
    }

    await assignQueueAfterPaidDeposit(result);

    return result;
  },
};
