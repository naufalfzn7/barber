import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvFile(resolve(process.cwd(), ".env"));
loadDotEnvFile(resolve(process.cwd(), ".env.local"));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const reference = process.argv[2];

if (!reference) {
  console.error("Usage: node scripts/mark-qris-paid.mjs <QRIS_REFERENCE>");
  process.exit(1);
}

try {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { externalRef: reference },
      include: {
        booking: true,
      },
    });

    if (!payment) {
      throw new Error("Payment reference not found");
    }

    if (payment.method !== PaymentMethod.QRIS) {
      throw new Error("Payment method is not QRIS");
    }

    const now = new Date();

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: now,
        amountPaid: payment.isDeposit
          ? payment.amountDue
          : payment.depositAmount
            ? payment.amountDue.add(payment.depositAmount)
            : payment.amountDue,
        changeAmount: new Prisma.Decimal(0),
      },
    });

    let updatedBooking = payment.booking;
    const targetStatus = payment.isDeposit
      ? BookingStatus.UPCOMING
      : BookingStatus.COMPLETED;

    if (payment.booking.status !== targetStatus) {
      updatedBooking = await tx.booking.update({
        where: { id: payment.booking.id },
        data: payment.isDeposit
          ? {
              status: BookingStatus.UPCOMING,
            }
          : {
              status: BookingStatus.COMPLETED,
              serviceEndAt: payment.booking.serviceEndAt ?? now,
              completedAt: payment.booking.completedAt ?? now,
            },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: payment.booking.id,
          oldStatus: payment.booking.status,
          newStatus: targetStatus,
          changedById: null,
          reason: payment.isDeposit
            ? "Deposit payment confirmed via terminal QRIS helper"
            : "Payment completed via terminal QRIS helper",
        },
      });
    }

    return { payment: updatedPayment, booking: updatedBooking };
  });

  console.log("Pembayaran QRIS selesai.");
  console.log(`Reference: ${reference}`);
  console.log(`Payment ID: ${result.payment.id}`);
  console.log(`Booking status: ${result.booking.status}`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Failed to mark QRIS as paid",
  );
  process.exit(1);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
