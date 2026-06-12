import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundRequestStatus,
} from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export const refundRepository = {
  findBookingForMemberRefund(input: { bookingId: string; memberId: string }) {
    return prisma.booking.findFirst({
      where: {
        id: input.bookingId,
        memberId: input.memberId,
      },
      include: {
        payment: true,
        refundRequest: true,
        member: { select: { phoneNumber: true } },
      },
    });
  },

  createRefundRequest(input: {
    bookingId: string;
    memberId: string;
    branchId: string;
    amount: Prisma.Decimal;
    reason: string;
    contactPhone?: string | null;
  }) {
    return prisma.bookingRefundRequest.create({
      data: {
        bookingId: input.bookingId,
        memberId: input.memberId,
        branchId: input.branchId,
        amount: input.amount,
        reason: input.reason,
        contactPhone: input.contactPhone ?? null,
      },
    });
  },

  findPendingRequestForAdmin(input: { bookingId: string }) {
    return prisma.bookingRefundRequest.findUnique({
      where: { bookingId: input.bookingId },
      include: {
        booking: {
          include: {
            payment: true,
            member: {
              select: { id: true, fullName: true, email: true, phoneNumber: true },
            },
          },
        },
      },
    });
  },

  approveRefund(input: {
    bookingId: string;
    reviewedById: string;
    refundMethod: PaymentMethod;
    adminNote?: string | null;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const request = await tx.bookingRefundRequest.findUnique({
          where: { bookingId: input.bookingId },
          include: { booking: { include: { payment: true } } },
        });

        if (!request) {
          throw new Error("Pengajuan pengembalian tidak ditemukan");
        }

        if (request.status !== RefundRequestStatus.PENDING) {
          throw new Error("Pengajuan pengembalian sudah diproses");
        }

        if (request.booking.status !== BookingStatus.UPCOMING) {
          throw new Error("Reservasi tidak bisa dikembalikan pada status ini");
        }

        if (request.booking.payment?.status !== PaymentStatus.PAID) {
          throw new Error("Pembayaran reservasi belum tercatat lunas");
        }

        const now = new Date();
        const refundRequest = await tx.bookingRefundRequest.update({
          where: { id: request.id },
          data: {
            status: RefundRequestStatus.APPROVED,
            refundMethod: input.refundMethod,
            reviewedAt: now,
            reviewedById: input.reviewedById,
            adminNote: input.adminNote ?? null,
          },
        });

        const booking = await tx.booking.update({
          where: { id: request.bookingId },
          data: {
            status: BookingStatus.CANCELED,
            canceledAt: now,
          },
        });

        await tx.payment.update({
          where: { bookingId: request.bookingId },
          data: { status: PaymentStatus.REFUNDED },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            oldStatus: request.booking.status,
            newStatus: BookingStatus.CANCELED,
            changedById: input.reviewedById,
            reason: `Refund approved via ${input.refundMethod}`,
          },
        });

        return { refundRequest, booking };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  rejectRefund(input: {
    bookingId: string;
    reviewedById: string;
    rejectionReason: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const request = await tx.bookingRefundRequest.findUnique({
          where: { bookingId: input.bookingId },
        });

        if (!request) {
          throw new Error("Pengajuan pengembalian tidak ditemukan");
        }

        if (request.status !== RefundRequestStatus.PENDING) {
          throw new Error("Pengajuan pengembalian sudah diproses");
        }

        const refundRequest = await tx.bookingRefundRequest.update({
          where: { id: request.id },
          data: {
            status: RefundRequestStatus.REJECTED,
            reviewedAt: new Date(),
            reviewedById: input.reviewedById,
            rejectionReason: input.rejectionReason,
          },
        });

        return { refundRequest };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },
};
