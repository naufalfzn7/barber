import {
  BookingQueueStatus,
  BookingStatus,
  InventoryMovementType,
  Prisma,
  type DayOfWeek,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  getPendingBookingHoldCutoff,
  PENDING_BOOKING_HOLD_MINUTES,
} from "@/server/services/bookingHold";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.UPCOMING,
  BookingStatus.IN_PROGRESS,
];
const BUSINESS_UTC_OFFSET_MINUTES = 7 * 60;
const QUEUE_NO_SHOW_MINUTES = 10;

function activeBookingWhere(now = new Date()): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: { in: ACTIVE_BOOKING_STATUSES } },
      {
        status: BookingStatus.PAYMENT_PENDING,
        createdAt: { gt: getPendingBookingHoldCutoff(now) },
      },
    ],
  };
}

export function getBookingQueueDate(date: Date) {
  const shifted = new Date(
    date.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000,
  );
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      -BUSINESS_UTC_OFFSET_MINUTES / 60,
      0,
      0,
      0,
    ),
  );
}

async function assignQueueTicket(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  const current = await tx.booking.findUnique({ where: { id: bookingId } });
  if (!current) {
    return null;
  }

  if (current.queueNumber && current.queueDate) {
    return current;
  }

  const queueDate = getBookingQueueDate(current.scheduledStart);
  const latest = await tx.booking.findFirst({
    where: {
      branchId: current.branchId,
      queueDate,
      queueNumber: { not: null },
    },
    orderBy: { queueNumber: "desc" },
    select: { queueNumber: true },
  });
  const queueNumber = (latest?.queueNumber ?? 0) + 1;

  return tx.booking.update({
    where: { id: bookingId },
    data: {
      queueDate,
      queueNumber,
      queueStatus: BookingQueueStatus.WAITING,
      queueAssignedAt: new Date(),
    },
  });
}

export const bookingRepository = {
  assignQueueTicket(bookingId: string) {
    return prisma.$transaction(
      async (tx) => assignQueueTicket(tx, bookingId),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  assignMissingQueueTicketsForDay(input: {
    branchId: string;
    dateStart: Date;
    dateEnd: Date;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const candidates = await tx.booking.findMany({
          where: {
            branchId: input.branchId,
            queueNumber: null,
            status: {
              in: [BookingStatus.UPCOMING, BookingStatus.IN_PROGRESS],
            },
            OR: [
              { isWalkIn: true },
              { payment: { status: PaymentStatus.PAID } },
            ],
            scheduledStart: {
              gte: input.dateStart,
              lt: input.dateEnd,
            },
          },
          select: { id: true },
          orderBy: [{ scheduledStart: "asc" }, { createdAt: "asc" }],
        });

        for (const booking of candidates) {
          await assignQueueTicket(tx, booking.id);
        }

        return candidates.length;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

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
    const now = new Date();
    return prisma.booking.findMany({
      where: {
        branchId: input.branchId,
        barbermanId: input.barbermanId,
        ...activeBookingWhere(now),
        scheduledStart: { lt: input.scheduledEnd },
        scheduledEnd: { gt: input.scheduledStart },
      },
      select: { id: true, scheduledStart: true, scheduledEnd: true },
    });
  },

  findActiveBookingsInWindow(input: {
    branchId: string;
    dateStart: Date;
    dateEnd: Date;
    barbermanId?: string;
  }) {
    const now = new Date();
    return prisma.booking.findMany({
      where: {
        branchId: input.branchId,
        ...activeBookingWhere(now),
        scheduledStart: { lt: input.dateEnd },
        scheduledEnd: { gt: input.dateStart },
        ...(input.barbermanId ? { barbermanId: input.barbermanId } : {}),
      },
      select: {
        id: true,
        barbermanId: true,
        scheduledStart: true,
        scheduledEnd: true,
      },
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
            ...activeBookingWhere(),
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
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            bufferMinutes: true,
            price: true,
          },
        },
        barberman: { select: { id: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
        payment: {
          select: {
            id: true,
            status: true,
            amountDue: true,
            isDeposit: true,
            depositAmount: true,
            externalRef: true,
            qrisString: true,
            qrisImageUrl: true,
            qrisExpiresAt: true,
          },
        },
      },
      orderBy: { scheduledStart: "desc" },
    });
  },

  findAdminDailyBookings(branchId: string, dateStart: Date, dateEnd: Date) {
    return prisma.booking.findMany({
      where: {
        branchId,
        OR: [{ isWalkIn: true }, { payment: { status: PaymentStatus.PAID } }],
        scheduledStart: {
          gte: dateStart,
          lt: dateEnd,
        },
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            bufferMinutes: true,
            price: true,
          },
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

  markExpiredCalledQueues(input: {
    branchId: string;
    queueDate: Date;
    changedById?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - QUEUE_NO_SHOW_MINUTES * 60 * 1000);
      const expired = await tx.booking.findMany({
        where: {
          branchId: input.branchId,
          queueDate: input.queueDate,
          status: BookingStatus.UPCOMING,
          queueStatus: BookingQueueStatus.CALLED,
          queueCalledAt: { lte: cutoff },
        },
        select: { id: true, status: true },
      });

      if (expired.length === 0) {
        return 0;
      }

      await tx.booking.updateMany({
        where: { id: { in: expired.map((booking) => booking.id) } },
        data: {
          status: BookingStatus.NO_SHOW,
          queueStatus: BookingQueueStatus.MISSED,
          queueNoShowAt: now,
        },
      });

      await tx.bookingStatusHistory.createMany({
        data: expired.map((booking) => ({
          bookingId: booking.id,
          oldStatus: booking.status,
          newStatus: BookingStatus.NO_SHOW,
          changedById: input.changedById ?? null,
          reason: `Auto no-show after ${QUEUE_NO_SHOW_MINUTES} minutes in queue call`,
        })),
      });

      return expired.length;
    });
  },

  callNextQueueBooking(input: {
    branchId: string;
    queueDate: Date;
    changedById: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const activeCalled = await tx.booking.findFirst({
        where: {
          branchId: input.branchId,
          queueDate: input.queueDate,
          status: BookingStatus.UPCOMING,
          queueStatus: BookingQueueStatus.CALLED,
        },
        orderBy: [{ queueCalledAt: "asc" }, { queueNumber: "asc" }],
        include: {
          service: { select: { id: true, name: true, price: true } },
          barberman: { select: { id: true, name: true } },
          member: { select: { id: true, fullName: true, email: true } },
        },
      });

      if (activeCalled) {
        return activeCalled;
      }

      const next = await tx.booking.findFirst({
        where: {
          branchId: input.branchId,
          queueDate: input.queueDate,
          status: BookingStatus.UPCOMING,
          queueStatus: BookingQueueStatus.WAITING,
        },
        orderBy: [{ scheduledStart: "asc" }, { queueNumber: "asc" }],
        include: {
          service: { select: { id: true, name: true, price: true } },
          barberman: { select: { id: true, name: true } },
          member: { select: { id: true, fullName: true, email: true } },
        },
      });

      if (!next) {
        return null;
      }

      return tx.booking.update({
        where: { id: next.id },
        data: {
          queueStatus: BookingQueueStatus.CALLED,
          queueCalledAt: new Date(),
        },
        include: {
          service: { select: { id: true, name: true, price: true } },
          barberman: { select: { id: true, name: true } },
          member: { select: { id: true, fullName: true, email: true } },
        },
      });
    });
  },

  createWalkInBookingWithHistory(input: {
    code: string;
    branchId: string;
    createdById: string;
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
            barbermanId: null,
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

        return (await assignQueueTicket(tx, booking.id)) ?? booking;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  findBookingById(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            bufferMinutes: true,
            price: true,
          },
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
    barbermanId?: string;
    scheduledEnd?: Date;
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

      if (
        input.newStatus === BookingStatus.IN_PROGRESS &&
        input.barbermanId &&
        input.scheduledEnd
      ) {
        const overlaps = await tx.booking.findFirst({
          where: {
            id: { not: input.bookingId },
            branchId: current.branchId,
            barbermanId: input.barbermanId,
            ...activeBookingWhere(),
            scheduledStart: { lt: input.scheduledEnd },
            scheduledEnd: { gt: input.serviceStartAt ?? new Date() },
          },
          select: { id: true },
        });

        if (overlaps) {
          throw new Error("Barber sedang ada booking di jam tersebut");
        }
      }

      const booking = await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          status: input.newStatus,
          barbermanId: input.barbermanId,
          scheduledEnd: input.scheduledEnd,
          checkInAt: input.checkInAt,
          serviceStartAt: input.serviceStartAt,
          serviceEndAt: input.serviceEndAt,
          completedAt: input.completedAt,
          queueStatus:
            input.newStatus === BookingStatus.IN_PROGRESS
              ? BookingQueueStatus.SERVING
              : input.newStatus === BookingStatus.COMPLETED
                ? BookingQueueStatus.DONE
                : input.newStatus === BookingStatus.NO_SHOW
                  ? BookingQueueStatus.MISSED
                  : undefined,
          queueNoShowAt:
            input.newStatus === BookingStatus.NO_SHOW ? new Date() : undefined,
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

  releaseExpiredPendingBookings(input: {
    scheduledStartBefore: Date;
    createdAtBefore: Date;
    reason?: string;
  }) {
    return prisma.$transaction(
      async (tx) => {
        const stale = await tx.booking.findMany({
          where: {
            status: BookingStatus.PAYMENT_PENDING,
            AND: [
              {
                OR: [
                  { scheduledStart: { lte: input.scheduledStartBefore } },
                  { createdAt: { lte: input.createdAtBefore } },
                ],
              },
              {
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
            ],
          },
          select: { id: true, status: true },
        });

        if (stale.length === 0) {
          return 0;
        }

        const staleIds = stale.map((item) => item.id);
        const canceledAt = new Date();

        const canceled = await tx.booking.updateMany({
          where: {
            id: { in: staleIds },
            status: BookingStatus.PAYMENT_PENDING,
          },
          data: {
            status: BookingStatus.CANCELED,
            canceledAt,
          },
        });

        if (canceled.count === 0) {
          return 0;
        }

        await tx.payment.updateMany({
          where: {
            bookingId: { in: staleIds },
            status: {
              in: [
                PaymentStatus.PENDING,
                PaymentStatus.FAILED,
                PaymentStatus.EXPIRED,
              ],
            },
          },
          data: {
            status: PaymentStatus.EXPIRED,
          },
        });

        await tx.bookingStatusHistory.createMany({
          data: stale.map((booking) => ({
            bookingId: booking.id,
            oldStatus: booking.status,
            newStatus: BookingStatus.CANCELED,
            changedById: null,
            reason: input.reason,
          })),
        });

        return canceled.count;
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
            gte: new Date(
              input.windowStart.getTime() -
                PENDING_BOOKING_HOLD_MINUTES * 60 * 1000,
            ),
            lt: new Date(
              input.windowEnd.getTime() -
                PENDING_BOOKING_HOLD_MINUTES * 60 * 1000,
            ),
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
            createdAt: {
              gte: new Date(
                input.windowStart.getTime() -
                  input.minutesLeft * 60 * 1000,
              ),
            },
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

        return { deleted: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },
};
