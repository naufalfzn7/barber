import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export const paymentRepository = {
  findBookingForPayment(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          select: { id: true, name: true, price: true },
        },
        products: {
          select: {
            id: true,
            subtotal: true,
          },
        },
        payment: true,
      },
    });
  },

  findPaymentByBookingId(bookingId: string) {
    return prisma.payment.findUnique({ where: { bookingId } });
  },

  findPaymentByExternalRef(externalRef: string) {
    return prisma.payment.findFirst({ where: { externalRef } });
  },

  findPaymentWithBooking(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            service: {
              select: { id: true, name: true, price: true },
            },
            products: {
              select: {
                id: true,
                subtotal: true,
              },
            },
          },
        },
      },
    });
  },

  findReceiptByBookingId(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        barberman: {
          select: {
            id: true,
            name: true,
          },
        },
        member: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
        products: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
          },
          orderBy: { createdAt: "asc" },
        },
        payment: true,
      },
    });
  },

  setBookingPaymentPending(input: {
    bookingId: string;
    changedById: string;
    reason: string;
    serviceEndAt?: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({
        where: { id: input.bookingId },
      });
      if (!current) {
        return null;
      }

      const booking = await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          status: BookingStatus.PAYMENT_PENDING,
          serviceEndAt: input.serviceEndAt,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          oldStatus: current.status,
          newStatus: BookingStatus.PAYMENT_PENDING,
          changedById: input.changedById,
          reason: input.reason,
        },
      });

      return booking;
    });
  },

  upsertQrisPayment(input: {
    bookingId: string;
    amountDue: Prisma.Decimal;
    externalRef: string;
    depositAmount?: Prisma.Decimal | null;
    isDeposit?: boolean;
    qrisString?: string | null;
    qrisImageUrl?: string | null;
    qrisExpiresAt?: Date | null;
  }) {
    return prisma.payment.upsert({
      where: { bookingId: input.bookingId },
      create: {
        bookingId: input.bookingId,
        method: PaymentMethod.QRIS,
        status: PaymentStatus.PENDING,
        amountDue: input.amountDue,
        externalRef: input.externalRef,
        depositAmount: input.depositAmount ?? null,
        isDeposit: input.isDeposit ?? false,
        qrisString: input.qrisString ?? null,
        qrisImageUrl: input.qrisImageUrl ?? null,
        qrisExpiresAt: input.qrisExpiresAt ?? null,
      },
      update: {
        method: PaymentMethod.QRIS,
        status: PaymentStatus.PENDING,
        externalRef: input.externalRef,
        amountDue: input.amountDue,
        amountPaid: null,
        changeAmount: null,
        paidAt: null,
        processedById: null,
        depositAmount: input.depositAmount ?? null,
        isDeposit: input.isDeposit ?? false,
        qrisString: input.qrisString ?? null,
        qrisImageUrl: input.qrisImageUrl ?? null,
        qrisExpiresAt: input.qrisExpiresAt ?? null,
      },
    });
  },

  completeCashPayment(input: {
    bookingId: string;
    changedById: string;
    totalDue: Prisma.Decimal;
    cashReceived: Prisma.Decimal;
    remainingDue: Prisma.Decimal;
    changeAmount: Prisma.Decimal;
    depositAmount?: Prisma.Decimal | null;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const currentBooking = await tx.booking.findUnique({
          where: { id: input.bookingId },
        });

        if (!currentBooking) {
          return null;
        }

        const payment = await tx.payment.upsert({
          where: { bookingId: input.bookingId },
          create: {
            bookingId: input.bookingId,
            method: PaymentMethod.CASH,
            status: PaymentStatus.PAID,
            amountDue: input.totalDue,
            amountPaid: input.totalDue,
            changeAmount: input.changeAmount,
            paidAt: new Date(),
            processedById: input.changedById,
            depositAmount: input.depositAmount ?? null,
            isDeposit: false,
          },
          update: {
            method: PaymentMethod.CASH,
            status: PaymentStatus.PAID,
            amountDue: input.totalDue,
            amountPaid: input.totalDue,
            changeAmount: input.changeAmount,
            paidAt: new Date(),
            processedById: input.changedById,
            depositAmount: input.depositAmount ?? null,
            isDeposit: false,
          },
        });

        const booking = await tx.booking.update({
          where: { id: input.bookingId },
          data: {
            status: BookingStatus.COMPLETED,
            serviceEndAt: currentBooking.serviceEndAt ?? new Date(),
            completedAt: new Date(),
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            oldStatus: currentBooking.status,
            newStatus: BookingStatus.COMPLETED,
            changedById: input.changedById,
            reason: "Payment completed via cash",
          },
        });

        return { booking, payment };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  applyQrisWebhookStatus(input: {
    externalRef: string;
    paymentStatus: PaymentStatus;
    paidAt?: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { externalRef: input.externalRef },
      });

      if (!payment) {
        return null;
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: input.paymentStatus,
          paidAt: input.paidAt,
          amountPaid:
            input.paymentStatus === PaymentStatus.PAID
              ? payment.isDeposit
                ? payment.amountDue
                : payment.depositAmount
                  ? payment.amountDue.add(payment.depositAmount)
                  : payment.amountDue
              : payment.amountPaid,
          changeAmount:
            input.paymentStatus === PaymentStatus.PAID
              ? new Prisma.Decimal(0)
              : payment.changeAmount,
        },
      });

      const booking = await tx.booking.findUnique({
        where: { id: payment.bookingId },
      });

      if (!booking) {
        return { payment: updatedPayment, booking: null };
      }

      let updatedBooking = booking;

      if (input.paymentStatus === PaymentStatus.PAID) {
        // Determine target status based on payment type
        const targetStatus = updatedPayment.isDeposit
          ? BookingStatus.UPCOMING // Deposit payment → ready for service
          : BookingStatus.COMPLETED; // Full payment → service complete

        if (booking.status !== targetStatus) {
          updatedBooking = await tx.booking.update({
            where: { id: booking.id },
            data: updatedPayment.isDeposit
              ? {
                  status: BookingStatus.UPCOMING,
                }
              : {
                  status: BookingStatus.COMPLETED,
                  serviceEndAt: booking.serviceEndAt ?? new Date(),
                  completedAt: booking.completedAt ?? new Date(),
                },
          });

          await tx.bookingStatusHistory.create({
            data: {
              bookingId: booking.id,
              oldStatus: booking.status,
              newStatus: targetStatus,
              changedById: null,
              reason: updatedPayment.isDeposit
                ? "Deposit payment confirmed via QRIS webhook"
                : "Payment completed via QRIS webhook",
            },
          });
        }
      }

      return { payment: updatedPayment, booking: updatedBooking };
    });
  },
};
