import {
  BookingStatus,
  InventoryMovementType,
  Prisma,
  type DayOfWeek,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/server/db/prisma";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.UPCOMING,
  BookingStatus.IN_PROGRESS,
  BookingStatus.PAYMENT_PENDING,
];

export const bookingRepository = {
  listActiveBranches() {
    return prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        timezone: true,
      },
      orderBy: { name: "asc" },
    });
  },

  listBranchServices(branchId: string) {
    return prisma.service.findMany({
      where: {
        branchId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        durationMinutes: true,
        bufferMinutes: true,
        price: true,
      },
      orderBy: { name: "asc" },
    });
  },

  findServiceById(serviceId: string) {
    return prisma.service.findUnique({ where: { id: serviceId } });
  },

  findBranchById(branchId: string) {
    return prisma.branch.findUnique({ where: { id: branchId } });
  },

  findOperatingHour(branchId: string, dayOfWeek: DayOfWeek) {
    return prisma.operatingHour.findUnique({
      where: { branchId_dayOfWeek: { branchId, dayOfWeek } },
    });
  },

  findBarbermen(branchId: string, barbermanId?: string) {
    return prisma.barberman.findMany({
      where: {
        branchId,
        isActive: true,
        ...(barbermanId ? { id: barbermanId } : {}),
      },
      orderBy: { name: "asc" },
    });
  },

  findBarberSchedules(branchId: string, dateStart: Date, dateEnd: Date) {
    return prisma.barberSchedule.findMany({
      where: {
        branchId,
        date: {
          gte: dateStart,
          lt: dateEnd,
        },
      },
    });
  },

  findHolidays(
    branchId: string,
    dateStart: Date,
    dateEnd: Date,
    barbermanId?: string,
  ) {
    return prisma.holiday.findMany({
      where: {
        branchId,
        date: {
          gte: dateStart,
          lt: dateEnd,
        },
        ...(barbermanId
          ? { OR: [{ barbermanId }, { barbermanId: null }] }
          : {}),
      },
    });
  },

  findOverlappingBookings(input: {
    branchId: string;
    barbermanId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
  }) {
    return prisma.booking.findMany({
      where: {
        branchId: input.branchId,
        barbermanId: input.barbermanId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        scheduledStart: { lt: input.scheduledEnd },
        scheduledEnd: { gt: input.scheduledStart },
      },
      select: { id: true, scheduledStart: true, scheduledEnd: true },
    });
  },

  createBookingWithHistory(input: {
    code: string;
    branchId: string;
    memberId: string;
    createdById: string;
    barbermanId: string;
    serviceId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    notes?: string;
    status?: BookingStatus;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const overlaps = await tx.booking.findFirst({
          where: {
            branchId: input.branchId,
            barbermanId: input.barbermanId,
            status: { in: ACTIVE_BOOKING_STATUSES },
            scheduledStart: { lt: input.scheduledEnd },
            scheduledEnd: { gt: input.scheduledStart },
          },
          select: { id: true },
        });

        if (overlaps) {
          throw new Error("Selected slot is no longer available");
        }

        const booking = await tx.booking.create({
          data: {
            code: input.code,
            branchId: input.branchId,
            memberId: input.memberId,
            createdById: input.createdById,
            barbermanId: input.barbermanId,
            serviceId: input.serviceId,
            scheduledStart: input.scheduledStart,
            scheduledEnd: input.scheduledEnd,
            status: input.status || BookingStatus.UPCOMING,
            notes: input.notes,
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            oldStatus: null,
            newStatus: input.status || BookingStatus.UPCOMING,
            changedById: input.createdById,
            reason: "Booking created by member",
          },
        });

        return booking;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  findMemberBookingHistory(memberId: string) {
    return prisma.booking.findMany({
      where: { memberId },
      include: {
        service: {
          select: { id: true, name: true, durationMinutes: true, price: true },
        },
        barberman: { select: { id: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: { scheduledStart: "desc" },
    });
  },

  findAdminDailyBookings(branchId: string, dateStart: Date, dateEnd: Date) {
    return prisma.booking.findMany({
      where: {
        branchId,
        scheduledStart: {
          gte: dateStart,
          lt: dateEnd,
        },
      },
      include: {
        service: {
          select: { id: true, name: true, durationMinutes: true, price: true },
        },
        barberman: { select: { id: true, name: true } },
        member: {
          select: { id: true, fullName: true, email: true, phoneNumber: true },
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
        payment: {
          select: {
            id: true,
            status: true,
            amountDue: true,
            amountPaid: true,
            changeAmount: true,
            isDeposit: true,
            depositAmount: true,
            externalRef: true,
            paidAt: true,
            qrisString: true,
            qrisImageUrl: true,
            qrisExpiresAt: true,
          },
        },
      },
      orderBy: { scheduledStart: "asc" },
    });
  },

  createWalkInBookingWithHistory(input: {
    code: string;
    branchId: string;
    createdById: string;
    barbermanId: string;
    serviceId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    walkInName: string;
    walkInPhone?: string;
    notes?: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.create({
          data: {
            code: input.code,
            branchId: input.branchId,
            memberId: null,
            createdById: input.createdById,
            barbermanId: input.barbermanId,
            serviceId: input.serviceId,
            scheduledStart: input.scheduledStart,
            scheduledEnd: input.scheduledEnd,
            status: BookingStatus.UPCOMING,
            isWalkIn: true,
            walkInName: input.walkInName,
            walkInPhone: input.walkInPhone,
            notes: input.notes,
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            oldStatus: null,
            newStatus: BookingStatus.UPCOMING,
            changedById: input.createdById,
            reason: "Walk-in booking created by admin",
          },
        });

        return booking;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  findBookingById(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          select: { id: true, name: true, durationMinutes: true, price: true },
        },
        barberman: { select: { id: true, name: true } },
        member: {
          select: { id: true, fullName: true, email: true, phoneNumber: true },
        },
        payment: true,
        products: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                sku: true,
                name: true,
                stockQty: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  },

  findActiveInventoryItems(branchId: string) {
    return prisma.inventoryItem.findMany({
      where: {
        branchId,
        isActive: true,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        stockQty: true,
        sellingPrice: true,
      },
      orderBy: { name: "asc" },
    });
  },

  addProductToBooking(input: {
    bookingId: string;
    inventoryItemId: string;
    quantity: number;
    changedById: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: input.bookingId },
          include: {
            service: {
              select: {
                price: true,
              },
            },
          },
        });

        if (!booking) {
          throw new Error("Booking not found");
        }

        const item = await tx.inventoryItem.findFirst({
          where: {
            id: input.inventoryItemId,
            branchId: booking.branchId,
            isActive: true,
          },
        });

        if (!item) {
          throw new Error("Inventory item not found");
        }

        const existing = await tx.bookingProduct.findUnique({
          where: {
            bookingId_inventoryItemId: {
              bookingId: booking.id,
              inventoryItemId: item.id,
            },
          },
        });

        if (item.stockQty < input.quantity) {
          throw new Error("Insufficient stock for selected product");
        }

        const nextStock = item.stockQty - input.quantity;
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { stockQty: nextStock },
        });

        await tx.inventoryMovement.create({
          data: {
            branchId: booking.branchId,
            inventoryItemId: item.id,
            type: InventoryMovementType.OUT,
            quantity: input.quantity,
            beforeQty: item.stockQty,
            afterQty: nextStock,
            note: `Produk dipakai untuk booking ${booking.code}`,
            referenceId: booking.code,
            actedById: input.changedById,
          },
        });

        const unitPrice = existing?.unitPrice ?? item.sellingPrice;
        const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
        const subtotal = unitPrice.mul(new Prisma.Decimal(nextQuantity));

        const bookingProduct = await tx.bookingProduct.upsert({
          where: {
            bookingId_inventoryItemId: {
              bookingId: booking.id,
              inventoryItemId: item.id,
            },
          },
          create: {
            bookingId: booking.id,
            inventoryItemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            unitPrice,
            quantity: nextQuantity,
            subtotal,
          },
          update: {
            itemSku: item.sku,
            itemName: item.name,
            quantity: nextQuantity,
            subtotal,
          },
        });

        const productTotals = await tx.bookingProduct.aggregate({
          where: { bookingId: booking.id },
          _sum: { subtotal: true },
        });

        const totalDue = booking.service.price.add(
          productTotals._sum.subtotal ?? new Prisma.Decimal(0),
        );

        return {
          booking,
          item,
          bookingProduct,
          totalDue,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  removeBookingProduct(input: {
    bookingId: string;
    bookingProductId: string;
    changedById: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: input.bookingId },
          include: {
            service: {
              select: {
                price: true,
              },
            },
          },
        });

        if (!booking) {
          throw new Error("Booking not found");
        }

        const bookingProduct = await tx.bookingProduct.findFirst({
          where: {
            id: input.bookingProductId,
            bookingId: booking.id,
          },
        });

        if (!bookingProduct) {
          throw new Error("Booking product not found");
        }

        const item = await tx.inventoryItem.findFirst({
          where: {
            id: bookingProduct.inventoryItemId,
            branchId: booking.branchId,
          },
        });

        if (!item) {
          throw new Error("Inventory item not found");
        }

        const nextStock = item.stockQty + bookingProduct.quantity;
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { stockQty: nextStock },
        });

        await tx.inventoryMovement.create({
          data: {
            branchId: booking.branchId,
            inventoryItemId: item.id,
            type: InventoryMovementType.IN,
            quantity: bookingProduct.quantity,
            beforeQty: item.stockQty,
            afterQty: nextStock,
            note: `Produk dibatalkan dari booking ${booking.code}`,
            referenceId: booking.code,
            actedById: input.changedById,
          },
        });

        await tx.bookingProduct.delete({ where: { id: bookingProduct.id } });

        const productTotals = await tx.bookingProduct.aggregate({
          where: { bookingId: booking.id },
          _sum: { subtotal: true },
        });

        const totalDue = booking.service.price.add(
          productTotals._sum.subtotal ?? new Prisma.Decimal(0),
        );

        return {
          booking,
          bookingProduct,
          totalDue,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  updateBookingStatusWithHistory(input: {
    bookingId: string;
    changedById: string;
    newStatus: BookingStatus;
    reason?: string;
    checkInAt?: Date;
    serviceStartAt?: Date;
    serviceEndAt?: Date;
    completedAt?: Date;
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
          status: input.newStatus,
          checkInAt: input.checkInAt,
          serviceStartAt: input.serviceStartAt,
          serviceEndAt: input.serviceEndAt,
          completedAt: input.completedAt,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          oldStatus: current.status,
          newStatus: input.newStatus,
          changedById: input.changedById,
          reason: input.reason,
        },
      });

      return booking;
    });
  },

  releaseExpiredPendingBookings(input: { before: Date; reason?: string }) {
    return prisma.$transaction(
      async (tx) => {
        const stale = await tx.booking.findMany({
          where: {
            status: BookingStatus.PAYMENT_PENDING,
            createdAt: { lt: input.before },
            OR: [
              { payment: null },
              {
                payment: {
                  status: {
                    in: [
                      PaymentStatus.PENDING,
                      PaymentStatus.FAILED,
                      PaymentStatus.EXPIRED,
                    ],
                  },
                },
              },
            ],
          },
          select: { id: true },
        });

        if (stale.length === 0) {
          return 0;
        }

        const staleIds = stale.map((item) => item.id);

        await tx.booking.deleteMany({
          where: {
            id: { in: staleIds },
            status: BookingStatus.PAYMENT_PENDING,
          },
        });

        return staleIds.length;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  notifyPendingBookingsExpiringSoon(input: {
    windowStart: Date;
    windowEnd: Date;
    minutesLeft: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const candidates = await tx.booking.findMany({
        where: {
          status: BookingStatus.PAYMENT_PENDING,
          createdAt: {
            gte: input.windowStart,
            lt: input.windowEnd,
          },
          memberId: { not: null },
          OR: [
            { payment: null },
            {
              payment: {
                status: {
                  in: [
                    PaymentStatus.PENDING,
                    PaymentStatus.FAILED,
                    PaymentStatus.EXPIRED,
                  ],
                },
              },
            },
          ],
        },
        select: {
          id: true,
          code: true,
          memberId: true,
          scheduledStart: true,
        },
      });

      let sent = 0;

      for (const booking of candidates) {
        if (!booking.memberId) {
          continue;
        }

        const message = `Pembayaran deposit booking ${booking.code} akan kedaluwarsa dalam ${input.minutesLeft} menit.`;

        const existing = await tx.notification.findFirst({
          where: {
            userId: booking.memberId,
            type: "PAYMENT_UPDATE",
            title: "Deposit payment hampir kedaluwarsa",
            message,
            createdAt: { gte: input.windowStart },
          },
          select: { id: true },
        });

        if (existing) {
          continue;
        }

        await tx.notification.create({
          data: {
            branchId: null,
            userId: booking.memberId,
            type: "PAYMENT_UPDATE",
            title: "Deposit payment hampir kedaluwarsa",
            message,
            metadata: {
              bookingId: booking.id,
              bookingCode: booking.code,
              scheduledStart: booking.scheduledStart.toISOString(),
            },
          },
        });

        sent += 1;
      }

      return sent;
    });
  },

  cancelPendingBookingByMember(input: {
    bookingId: string;
    memberId: string;
    changedById: string;
    reason?: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: input.bookingId },
          include: {
            payment: {
              select: {
                status: true,
              },
            },
          },
        });

        if (!current || current.memberId !== input.memberId) {
          return null;
        }

        if (current.status !== BookingStatus.PAYMENT_PENDING) {
          throw new Error("Booking is not in payment pending status");
        }

        if (current.payment?.status === PaymentStatus.PAID) {
          throw new Error(
            "Booking cannot be canceled after payment is completed",
          );
        }

        const deletedCount = await tx.booking.deleteMany({
          where: {
            id: input.bookingId,
            memberId: input.memberId,
            status: BookingStatus.PAYMENT_PENDING,
          },
        });

        if (deletedCount.count === 0) {
          throw new Error(
            "Booking status changed. Please refresh and try again",
          );
        }

        return null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },
};
