import { BookingStatus, PaymentMethod, PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { refundRepository } from "@/server/repositories/refundRepository";
import {
  getRefundRequestDeadline,
  getRefundRequestDeadlineHours,
  isBeforeRefundRequestDeadline,
} from "@/server/services/refundSettings";

type Actor = {
  userId: string;
  role: UserRole;
  branchId?: string | null;
};

function assertAdminScope(actor: Actor, bookingBranchId: string) {
  if (actor.role === "ADMIN" && actor.branchId !== bookingBranchId) {
    throw new Error("Forbidden for other branch");
  }
}

function toNumberDecimal(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function cleanText(value: string, fieldName: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} wajib diisi`);
  }

  return trimmed;
}

export const refundService = {
  async requestByMember(input: {
    bookingId: string;
    memberId: string;
    reason: string;
    contactPhone?: string | null;
  }) {
    const reason = cleanText(input.reason, "Alasan pengembalian");
    const booking = await refundRepository.findBookingForMemberRefund({
      bookingId: input.bookingId,
      memberId: input.memberId,
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.isWalkIn) {
      throw new Error("Pengembalian hanya tersedia untuk reservasi member");
    }

    if (booking.status !== BookingStatus.UPCOMING) {
      throw new Error("Pengembalian hanya bisa diajukan untuk reservasi aktif");
    }

    if (booking.payment?.status !== PaymentStatus.PAID) {
      throw new Error("Pengembalian hanya bisa diajukan setelah pembayaran berhasil");
    }

    if (!booking.payment.amountPaid || booking.payment.amountPaid.lte(0)) {
      throw new Error("Nominal pembayaran tidak valid untuk pengembalian");
    }

    if (booking.refundRequest) {
      throw new Error("Pengajuan pengembalian untuk reservasi ini sudah ada");
    }

    const deadlineHours = await getRefundRequestDeadlineHours();
    if (
      !isBeforeRefundRequestDeadline({
        scheduledStart: booking.scheduledStart,
        deadlineHours,
      })
    ) {
      throw new Error(
        `Batas pengajuan pengembalian sudah lewat. Pengajuan hanya bisa dilakukan sebelum ${deadlineHours} jam dari jadwal reservasi.`,
      );
    }

    const contactPhone =
      input.contactPhone?.trim() || booking.member?.phoneNumber || null;

    const refundRequest = await refundRepository.createRefundRequest({
      bookingId: booking.id,
      memberId: input.memberId,
      branchId: booking.branchId,
      amount: booking.payment.amountPaid,
      reason,
      contactPhone,
    });

    return {
      refundRequest: {
        ...refundRequest,
        amount: toNumberDecimal(refundRequest.amount),
        deadline: getRefundRequestDeadline({
          scheduledStart: booking.scheduledStart,
          deadlineHours,
        }),
      },
    };
  },

  async approve(input: {
    bookingId: string;
    actor: Actor;
    refundMethod: "CASH" | "QRIS";
    adminNote?: string | null;
  }) {
    const request = await refundRepository.findPendingRequestForAdmin({
      bookingId: input.bookingId,
    });
    if (!request) {
      throw new Error("Pengajuan pengembalian tidak ditemukan");
    }

    assertAdminScope(input.actor, request.branchId);

    const result = await refundRepository.approveRefund({
      bookingId: input.bookingId,
      reviewedById: input.actor.userId,
      refundMethod:
        input.refundMethod === "CASH" ? PaymentMethod.CASH : PaymentMethod.QRIS,
      adminNote: input.adminNote?.trim() || null,
    });

    return result;
  },

  async reject(input: {
    bookingId: string;
    actor: Actor;
    rejectionReason: string;
  }) {
    const request = await refundRepository.findPendingRequestForAdmin({
      bookingId: input.bookingId,
    });
    if (!request) {
      throw new Error("Pengajuan pengembalian tidak ditemukan");
    }

    assertAdminScope(input.actor, request.branchId);

    return refundRepository.rejectRefund({
      bookingId: input.bookingId,
      reviewedById: input.actor.userId,
      rejectionReason: cleanText(input.rejectionReason, "Alasan penolakan"),
    });
  },
};
