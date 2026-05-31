import { NextResponse, type NextRequest } from "next/server";
import {
  getAccessTokenFromRequest,
  verifyAccessToken,
} from "@/server/core/auth";
import { prisma } from "@/server/db/prisma";
import { bookingRepository } from "@/server/repositories/bookingRepository";
import { env } from "@/server/core/env";

// Validation regex for callback URL
const XENDIT_CALLBACK_URL_REGEX =
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,63}\b([-a-zA-Z0-9()@:%_+.~#?&\/=]*)$/;

const DEFAULT_DEPOSIT_PERCENTAGE = 25;
const DEPOSIT_PAYMENT_DEADLINE_OFFSET_MINUTES = 60;
const MIN_XENDIT_INVOICE_DURATION_SECONDS = 60;
const EXPIRED_DEPOSIT_CANCEL_REASON =
  "Auto canceled because deposit was not paid 1 hour before reservation";

function parseDepositPercentage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DEPOSIT_PERCENTAGE;
  }

  return Math.min(100, Math.max(0, Math.trunc(parsed)));
}

async function createXenditInvoice(input: {
  externalRef: string;
  amount: number;
  expiresAt: Date;
}) {
  const callbackUrl =
    env.xenditCallbackUrl?.trim() ||
    `${env.appUrl}/api/payments/webhook/xendit`;

  if (!XENDIT_CALLBACK_URL_REGEX.test(callbackUrl)) {
    throw new Error(
      "Invalid XENDIT callback URL. Check XENDIT_CALLBACK_URL environment variable.",
    );
  }

  if (!env.xenditSecretKey) {
    throw new Error("Xendit API key not configured");
  }

  const basic = Buffer.from(`${env.xenditSecretKey}:`).toString("base64");
  const invoiceDuration = Math.floor(
    (input.expiresAt.getTime() - Date.now()) / 1000,
  );

  if (invoiceDuration < MIN_XENDIT_INVOICE_DURATION_SECONDS) {
    throw new Error(
      "Batas pembayaran deposit sudah lewat. Pembayaran harus dilakukan paling lambat 1 jam sebelum jadwal reservasi.",
    );
  }

  const response = await fetch("https://api.xendit.co/v2/invoices", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: input.externalRef,
      amount: Math.round(input.amount),
      description: `Payment for deposit ${input.externalRef}`,
      invoice_duration: invoiceDuration,
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
    qrString: body.invoice_url ?? null, // Use qrString to pass checkout URL to DB/Frontend
    qrImageUrl: body.invoice_url ?? null,
    status: body.status ?? "PENDING",
    expiresAt: input.expiresAt.toISOString(),
  };
}

function getDepositPaymentDeadline(scheduledStart: Date) {
  return new Date(
    scheduledStart.getTime() -
      DEPOSIT_PAYMENT_DEADLINE_OFFSET_MINUTES * 60 * 1000,
  );
}

function hasUsableDepositInvoice(input: {
  qrisString?: string | null;
  qrisImageUrl?: string | null;
  qrisExpiresAt?: Date | string | null;
  deadline: Date;
}) {
  if (!input.qrisString || !input.qrisImageUrl || !input.qrisExpiresAt) {
    return false;
  }

  const expiresAt =
    input.qrisExpiresAt instanceof Date
      ? input.qrisExpiresAt
      : new Date(input.qrisExpiresAt);

  return (
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() > Date.now() &&
    expiresAt.getTime() <= input.deadline.getTime()
  );
}

export async function POST(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Only MEMBER can create deposit payment
  if (payload.role !== "MEMBER") {
    return NextResponse.json(
      { message: "Forbidden - only members" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { message: "bookingId is required" },
        { status: 400 },
      );
    }

    // Get booking with payment
    const booking = await bookingRepository.findBookingById(bookingId);
    if (!booking) {
      return NextResponse.json(
        { message: "Booking not found" },
        { status: 404 },
      );
    }

    // Verify member owns booking
    if (booking.memberId !== payload.sub) {
      return NextResponse.json(
        { message: "Unauthorized - not your booking" },
        { status: 403 },
      );
    }

    // Check booking is in PAYMENT_PENDING status
    if (booking.status !== "PAYMENT_PENDING") {
      return NextResponse.json(
        { message: "Booking is not ready for deposit payment" },
        { status: 400 },
      );
    }

    const paymentDeadline = getDepositPaymentDeadline(booking.scheduledStart);
    if (paymentDeadline.getTime() <= Date.now()) {
      await bookingRepository.releaseExpiredPendingBookings({
        before: new Date(
          Date.now() + DEPOSIT_PAYMENT_DEADLINE_OFFSET_MINUTES * 60 * 1000,
        ),
        reason: EXPIRED_DEPOSIT_CANCEL_REASON,
      });

      return NextResponse.json(
        {
          message:
            "Batas pembayaran deposit sudah lewat. Pembayaran harus dilakukan paling lambat 1 jam sebelum jadwal reservasi.",
        },
        { status: 400 },
      );
    }

    // Return existing payment if already exists (idempotency)
    if (booking.payment) {
      if (
        !hasUsableDepositInvoice({
          qrisString: booking.payment.qrisString,
          qrisImageUrl: booking.payment.qrisImageUrl,
          qrisExpiresAt: booking.payment.qrisExpiresAt,
          deadline: paymentDeadline,
        })
      ) {
        const legacyQris = await createXenditInvoice({
          externalRef: `DEPOSIT-${booking.code}-${Date.now()}`,
          amount: Number(booking.payment.amountDue),
          expiresAt: paymentDeadline,
        });

        const refreshedPayment = await prisma.payment.update({
          where: { bookingId },
          data: {
            externalRef: legacyQris.referenceId,
            qrisString: legacyQris.qrString,
            qrisImageUrl: legacyQris.qrImageUrl,
            qrisExpiresAt: legacyQris.expiresAt
              ? new Date(legacyQris.expiresAt)
              : null,
          },
        });

        return NextResponse.json(
          {
            method: "QRIS",
            bookingId: booking.id,
            payment: refreshedPayment,
            qris: {
              referenceId: refreshedPayment.externalRef,
              qrString: refreshedPayment.qrisString,
              qrImageUrl: refreshedPayment.qrisImageUrl,
              status: refreshedPayment.status,
              expiresAt: refreshedPayment.qrisExpiresAt,
            },
            message: "Payment already exists for this booking",
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          method: "QRIS",
          bookingId: booking.id,
          payment: booking.payment,
          qris: {
            referenceId: booking.payment.externalRef,
            qrString: booking.payment.qrisString,
            qrImageUrl: booking.payment.qrisImageUrl,
            status: booking.payment.status,
            expiresAt: booking.payment.qrisExpiresAt,
          },
          message: "Payment already exists for this booking",
        },
        { status: 200 },
      );
    }

    // Get deposit percentage from system settings
    const depositSetting = await prisma.systemSetting.findUnique({
      where: { key: "DEPOSIT_PERCENTAGE" },
    });

    const depositPercentage = depositSetting
      ? parseDepositPercentage(depositSetting.value)
      : DEFAULT_DEPOSIT_PERCENTAGE;
    const depositAmount = Math.round(
      (Number(booking.service.price) * depositPercentage) / 100,
    );

    // Generate external reference for Xendit
    const externalRef = `DEPOSIT-${booking.code}-${Date.now()}`;

    // Create Invoice via Xendit
    const qris = await createXenditInvoice({
      externalRef,
      amount: depositAmount,
      expiresAt: paymentDeadline,
    });

    const qrisImageUrl = qris.qrImageUrl;

    // Upsert payment record (handles race conditions with concurrent requests)
    const payment = await prisma.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        method: "QRIS",
        status: "PENDING",
        amountDue: depositAmount,
        isDeposit: true,
        depositAmount: depositAmount,
        externalRef: qris.referenceId,
        qrisString: qris.qrString,
        qrisImageUrl,
        qrisExpiresAt: qris.expiresAt ? new Date(qris.expiresAt) : null,
      },
      update: {
        method: "QRIS",
        status: "PENDING",
        amountDue: depositAmount,
        isDeposit: true,
        depositAmount: depositAmount,
        externalRef: qris.referenceId,
        qrisString: qris.qrString,
        qrisImageUrl,
        qrisExpiresAt: qris.expiresAt ? new Date(qris.expiresAt) : null,
      },
    });

    return NextResponse.json(
      {
        method: "QRIS",
        bookingId: booking.id,
        payment,
        qris,
        depositPercentage,
        depositAmount,
        totalAmount: Number(booking.service.price),
        message: "QRIS deposit payment initialized",
      },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create deposit payment";
    console.error("Deposit payment error:", message);
    return NextResponse.json({ message }, { status: 400 });
  }
}
