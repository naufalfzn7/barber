import { BookingQueueStatus, DayOfWeek, type BookingStatus } from "@prisma/client";
import { bookingRepository } from "@/server/repositories/bookingRepository";
import {
  getEarlierDeadline,
  getPendingBookingHoldCutoff,
  getPendingBookingHoldExpiresAt,
  PENDING_BOOKING_HOLD_MINUTES,
} from "@/server/services/bookingHold";
import {
  formatDepositDeadlineLabel,
  getDepositPaymentDeadline,
  getDepositPaymentDeadlineHours,
  getExpiredPendingBookingCutoff,
  isBeforeDepositPaymentDeadline,
} from "@/server/services/depositSettings";
import {
  getRefundRequestDeadline,
  getRefundRequestDeadlineHours,
  isBeforeRefundRequestDeadline,
} from "@/server/services/refundSettings";

const SLOT_STEP_MINUTES = 15;
const BUSINESS_TIME_ZONE = "Asia/Jakarta";
const BUSINESS_UTC_OFFSET_MINUTES = 7 * 60;

type SlotAvailabilityInput = {
  branchId: string;
  serviceId: string;
  date: string;
  barbermanId?: string;
};

type CreateBookingInput = {
  memberId: string;
  branchId: string;
  serviceId: string;
  scheduledStart: string;
  barbermanId?: string;
  notes?: string;
};

type CreateWalkInBookingInput = {
  createdById: string;
  branchId: string;
  serviceId: string;
  scheduledStart: string;
  walkInName: string;
  walkInPhone?: string;
  notes?: string;
};

type UpdateBookingStatusInput = {
  bookingId: string;
  changedById: string;
  branchId: string;
  newStatus: "IN_PROGRESS" | "COMPLETED" | "NO_SHOW";
  barbermanId?: string;
  reason?: string;
};

type StartAvailabilityInput = {
  bookingId: string;
  branchId: string;
};

type AddBookingProductInput = {
  bookingId: string;
  branchId: string;
  inventoryItemId: string;
  quantity: number;
  changedById: string;
};

type RemoveBookingProductInput = {
  bookingId: string;
  branchId: string;
  bookingProductId: string;
  changedById: string;
};

type CancelPendingBookingInput = {
  bookingId: string;
  memberId: string;
};

function parseTimeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateParts(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    probe.getUTCFullYear() !== parts.year ||
    probe.getUTCMonth() !== parts.month - 1 ||
    probe.getUTCDate() !== parts.day
  ) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parts;
}

function toBusinessDateAtMinutes(parts: DateParts, minutes: number): Date {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      0,
      minutes - BUSINESS_UTC_OFFSET_MINUTES,
    ),
  );
}

function getBusinessDateParts(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
  };
}

function getBusinessMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return Number(value.hour) * 60 + Number(value.minute);
}

function addDays(parts: DateParts, days: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function compareDateParts(a: DateParts, b: DateParts) {
  if (a.year !== b.year) {
    return a.year - b.year;
  }

  if (a.month !== b.month) {
    return a.month - b.month;
  }

  return a.day - b.day;
}

function dayOfWeekFromDateParts(parts: DateParts): DayOfWeek {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayMap: DayOfWeek[] = [
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];
  return dayMap[date.getUTCDay()];
}

function getBusinessDayWindow(date: Date) {
  const parts = getBusinessDateParts(date);
  return {
    parts,
    start: toBusinessDateAtMinutes(parts, 0),
    end: toBusinessDateAtMinutes(addDays(parts, 1), 0),
  };
}

function getBusinessDayWindowFromInput(value: string) {
  const parts = parseDateParts(value);
  return {
    parts,
    start: toBusinessDateAtMinutes(parts, 0),
    end: toBusinessDateAtMinutes(addDays(parts, 1), 0),
  };
}

function bookingCode(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `BKG-${Date.now()}-${suffix}`;
}

function toNumberDecimal(value: { toString(): string }): number {
  return Number(value.toString());
}

function calculateTotalDue(input: {
  servicePrice: { toString(): string };
  products: Array<{ subtotal: { toString(): string } }>;
}) {
  const productsTotal = input.products.reduce(
    (sum, product) => sum + toNumberDecimal(product.subtotal),
    0,
  );
  return toNumberDecimal(input.servicePrice) + productsTotal;
}

function formatQueueNumber(queueNumber: number | null) {
  if (!queueNumber) {
    return null;
  }

  return `A${String(queueNumber).padStart(3, "0")}`;
}

const PAYMENT_EXPIRY_REMINDER_MINUTES = 2;

function parseHolidayTimeWindow(holiday: {
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
}) {
  if (holiday.isFullDay) {
    return null;
  }

  if (!holiday.startTime || !holiday.endTime) {
    return null;
  }

  return {
    startMinutes: parseTimeToMinutes(holiday.startTime),
    endMinutes: parseTimeToMinutes(holiday.endTime),
  };
}

function holidayBlocksSlot(
  holiday: {
    barbermanId: string | null;
    isFullDay: boolean;
    startTime: string | null;
    endTime: string | null;
  },
  barbermanId: string,
  slotStartMinutes: number,
  slotEndMinutes: number,
) {
  if (holiday.barbermanId !== null && holiday.barbermanId !== barbermanId) {
    return false;
  }

  const window = parseHolidayTimeWindow(holiday);
  if (!window) {
    return true;
  }

  return (
    slotStartMinutes < window.endMinutes && slotEndMinutes > window.startMinutes
  );
}

function scheduleAllowsSlot(input: {
  schedule?: { startTime: string; endTime: string; isDayOff: boolean } | null;
  defaultOpenMinutes: number;
  defaultCloseMinutes: number;
  slotStartMinutes: number;
  slotEndMinutes: number;
}) {
  if (input.schedule?.isDayOff) {
    return false;
  }

  const scheduleOpen = input.schedule
    ? parseTimeToMinutes(input.schedule.startTime)
    : input.defaultOpenMinutes;
  const scheduleClose = input.schedule
    ? parseTimeToMinutes(input.schedule.endTime)
    : input.defaultCloseMinutes;

  return (
    input.slotStartMinutes >= scheduleOpen &&
    input.slotEndMinutes <= scheduleClose
  );
}

export const bookingService = {
  async runPaymentPendingMaintenance() {
    const now = new Date();
    const deadlineHours = await getDepositPaymentDeadlineHours();
    const cutoff = getExpiredPendingBookingCutoff({ now, deadlineHours });
    const canceled = await bookingRepository.releaseExpiredPendingBookings({
      scheduledStartBefore: cutoff,
      createdAtBefore: getPendingBookingHoldCutoff(now),
      reason: `Auto canceled because deposit was not paid within ${PENDING_BOOKING_HOLD_MINUTES} minutes`,
    });

    await bookingRepository.notifyPendingBookingsExpiringSoon({
      windowStart: new Date(
        now.getTime() + PAYMENT_EXPIRY_REMINDER_MINUTES * 60 * 1000,
      ),
      windowEnd: new Date(
        now.getTime() +
          (PAYMENT_EXPIRY_REMINDER_MINUTES + 1) * 60 * 1000,
      ),
      minutesLeft: PAYMENT_EXPIRY_REMINDER_MINUTES,
    });

    return canceled;
  },

  async cleanupExpiredPaymentPendingBookings() {
    return bookingService.runPaymentPendingMaintenance();
  },

  async getBookingCatalog(input?: { branchId?: string }) {
    let branches: Array<{
      id: string;
      code: string;
      name: string;
      timezone: string;
    }> = [];

    if (input?.branchId) {
      const branch = await bookingRepository.findBranchById(input.branchId);
      if (branch && branch.isActive) {
        branches = [
          {
            id: branch.id,
            code: branch.code,
            name: branch.name,
            timezone: branch.timezone,
          },
        ];
      }
    } else {
      branches = await bookingRepository.listActiveBranches();
    }

    const withDetails = await Promise.all(
      branches.map(async (branch) => {
        const [services, barbermen] = await Promise.all([
          bookingRepository.listBranchServices(branch.id),
          bookingRepository.findBarbermen(branch.id),
        ]);

        return {
          id: branch.id,
          code: branch.code,
          name: branch.name,
          timezone: branch.timezone,
          services: services.map((service) => ({
            id: service.id,
            code: service.code,
            name: service.name,
            durationMinutes: service.durationMinutes,
            bufferMinutes: service.bufferMinutes,
            price: toNumberDecimal(service.price),
          })),
          barbermen: barbermen.map((barber) => ({
            id: barber.id,
            code: barber.code,
            name: barber.name,
          })),
        };
      }),
    );

    withDetails.sort((a, b) => {
      const aOperational = a.services.length > 0 && a.barbermen.length > 0;
      const bOperational = b.services.length > 0 && b.barbermen.length > 0;

      if (aOperational !== bOperational) {
        return aOperational ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });

    return { branches: withDetails };
  },

  async getAvailableSlots(input: SlotAvailabilityInput) {
    await bookingService.cleanupExpiredPaymentPendingBookings();

    const dayWindow = getBusinessDayWindowFromInput(input.date);

    const service = await bookingRepository.findServiceById(input.serviceId);
    if (!service || !service.isActive) {
      throw new Error("Service not found or inactive");
    }

    if (service.branchId !== input.branchId) {
      throw new Error("Service does not belong to selected branch");
    }

    const branch = await bookingRepository.findBranchById(input.branchId);
    if (!branch || !branch.isActive) {
      throw new Error("Branch not found or inactive");
    }

    const dayOfWeek = dayOfWeekFromDateParts(dayWindow.parts);
    const operatingHour = await bookingRepository.findOperatingHour(
      input.branchId,
      dayOfWeek,
    );

    if (!operatingHour) {
      return {
        date: input.date,
        slots: [],
        message: "Jam operasional cabang belum diatur untuk tanggal ini",
      };
    }

    if (operatingHour.isClosed) {
      return {
        date: input.date,
        slots: [],
        message: "Cabang tutup pada tanggal yang dipilih",
      };
    }

    const barbermen = await bookingRepository.findBarbermen(
      input.branchId,
      input.barbermanId,
    );
    if (!barbermen.length) {
      return {
        date: input.date,
        slots: [],
        message: "Tidak ada barberman aktif untuk pilihan ini",
      };
    }

    const holidays = await bookingRepository.findHolidays(
      input.branchId,
      dayWindow.start,
      dayWindow.end,
      input.barbermanId,
    );

    const [schedules, activeBookings] = await Promise.all([
      bookingRepository.findBarberSchedules(
        input.branchId,
        dayWindow.start,
        dayWindow.end,
      ),
      bookingRepository.findActiveBookingsInWindow({
        branchId: input.branchId,
        dateStart: dayWindow.start,
        dateEnd: dayWindow.end,
        barbermanId: input.barbermanId,
      }),
    ]);

    const serviceTotalMinutes = service.durationMinutes + service.bufferMinutes;
    const defaultOpenMinutes = parseTimeToMinutes(operatingHour.openTime);
    const defaultCloseMinutes = parseTimeToMinutes(operatingHour.closeTime);

    const slots: Array<{
      start: string;
      end: string;
      availableBarberIds: string[];
      isAvailable: boolean;
      unavailableReason?: string;
    }> = [];
    const deadlineHours = await getDepositPaymentDeadlineHours();
    const now = new Date();
    const isPastDate =
      compareDateParts(dayWindow.parts, getBusinessDateParts(now)) < 0;
    const deadlineLabel = formatDepositDeadlineLabel(deadlineHours);

    for (
      let cursor = defaultOpenMinutes;
      cursor + serviceTotalMinutes <= defaultCloseMinutes;
      cursor += SLOT_STEP_MINUTES
    ) {
      const slotStart = toBusinessDateAtMinutes(dayWindow.parts, cursor);
      const slotEnd = toBusinessDateAtMinutes(
        dayWindow.parts,
        cursor + serviceTotalMinutes,
      );
      const canStillPayDeposit = isBeforeDepositPaymentDeadline({
        scheduledStart: slotStart,
        deadlineHours,
        now,
      });

      const availableBarberIds: string[] = [];
      const unavailableReasons: string[] = [];
      const canAcceptBooking = !isPastDate && canStillPayDeposit;

      for (const barberman of barbermen) {
        const blockedByHoliday = holidays.some((holiday) =>
          holidayBlocksSlot(
            holiday,
            barberman.id,
            cursor,
            cursor + serviceTotalMinutes,
          ),
        );

        if (blockedByHoliday) {
          unavailableReasons.push(`${barberman.name} - Hari libur`);
          continue;
        }

        const barberSchedule = schedules.find(
          (schedule) => schedule.barbermanId === barberman.id,
        );

        if (
          !scheduleAllowsSlot({
            schedule: barberSchedule,
            defaultOpenMinutes,
            defaultCloseMinutes,
            slotStartMinutes: cursor,
            slotEndMinutes: cursor + serviceTotalMinutes,
          })
        ) {
          unavailableReasons.push(`${barberman.name} - Diluar jam kerja`);
          continue;
        }

        const overlaps = activeBookings.some(
          (booking) =>
            booking.barbermanId === barberman.id &&
            booking.scheduledStart < slotEnd &&
            booking.scheduledEnd > slotStart,
        );

        if (!overlaps && canAcceptBooking) {
          availableBarberIds.push(barberman.id);
        } else {
          if (overlaps) {
            unavailableReasons.push(`${barberman.name} - Sudah dipesan`);
          }
        }
      }

      const fallbackUnavailableReason = isPastDate
        ? "Reservasi tidak tersedia untuk tanggal yang sudah lewat"
        : `Batas pembayaran deposit ${deadlineLabel} sebelum reservasi sudah lewat`;
      const unavailableReason =
        unavailableReasons.find((reason) => reason.includes("Sudah dipesan")) ??
        unavailableReasons[0] ??
        fallbackUnavailableReason;

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        availableBarberIds,
        isAvailable: availableBarberIds.length > 0,
        unavailableReason:
          availableBarberIds.length > 0 ? undefined : unavailableReason,
      });
    }

    return { date: input.date, slots };
  },

  async createBooking(input: CreateBookingInput) {
    await bookingService.cleanupExpiredPaymentPendingBookings();

    const scheduledStart = new Date(input.scheduledStart);
    if (Number.isNaN(scheduledStart.getTime())) {
      throw new Error("Invalid scheduledStart format");
    }
    if (
      compareDateParts(
        getBusinessDateParts(scheduledStart),
        getBusinessDateParts(new Date()),
      ) < 0
    ) {
      throw new Error(
        "Reservasi tidak tersedia untuk tanggal yang sudah lewat. Pilih tanggal hari ini atau setelahnya.",
      );
    }
    const deadlineHours = await getDepositPaymentDeadlineHours();
    if (
      !isBeforeDepositPaymentDeadline({
        scheduledStart,
        deadlineHours,
      })
    ) {
      throw new Error(
        `Batas pembayaran deposit sudah lewat. Pilih slot minimal ${formatDepositDeadlineLabel(deadlineHours)} dari sekarang.`,
      );
    }

    const service = await bookingRepository.findServiceById(input.serviceId);
    if (!service || !service.isActive) {
      throw new Error("Service not found or inactive");
    }

    if (service.branchId !== input.branchId) {
      throw new Error("Service does not belong to selected branch");
    }

    const serviceTotalMinutes = service.durationMinutes + service.bufferMinutes;
    const scheduledEnd = new Date(
      scheduledStart.getTime() + serviceTotalMinutes * 60 * 1000,
    );

    const barbermen = await bookingRepository.findBarbermen(
      input.branchId,
      input.barbermanId,
    );
    if (!barbermen.length) {
      throw new Error("No active barberman available");
    }

    const dayWindow = getBusinessDayWindow(scheduledStart);
    const dayOfWeek = dayOfWeekFromDateParts(dayWindow.parts);
    const operatingHour = await bookingRepository.findOperatingHour(
      input.branchId,
      dayOfWeek,
    );
    if (!operatingHour || operatingHour.isClosed) {
      throw new Error("Selected slot is not available");
    }

    const holidays = await bookingRepository.findHolidays(
      input.branchId,
      dayWindow.start,
      dayWindow.end,
      input.barbermanId,
    );
    const schedules = await bookingRepository.findBarberSchedules(
      input.branchId,
      dayWindow.start,
      dayWindow.end,
    );

    const slotStartMinutes = getBusinessMinutes(scheduledStart);
    const slotEndMinutes =
      slotStartMinutes + service.durationMinutes + service.bufferMinutes;
    const defaultOpenMinutes = parseTimeToMinutes(operatingHour.openTime);
    const defaultCloseMinutes = parseTimeToMinutes(operatingHour.closeTime);

    let selectedBarberId: string | null = null;

    for (const barber of barbermen) {
      const blockedByHoliday = holidays.some((holiday) =>
        holidayBlocksSlot(holiday, barber.id, slotStartMinutes, slotEndMinutes),
      );

      if (blockedByHoliday) {
        continue;
      }

      const barberSchedule = schedules.find(
        (schedule) => schedule.barbermanId === barber.id,
      );

      if (
        !scheduleAllowsSlot({
          schedule: barberSchedule,
          defaultOpenMinutes,
          defaultCloseMinutes,
          slotStartMinutes,
          slotEndMinutes,
        })
      ) {
        continue;
      }

      const overlaps = await bookingRepository.findOverlappingBookings({
        branchId: input.branchId,
        barbermanId: barber.id,
        scheduledStart,
        scheduledEnd,
      });

      if (overlaps.length === 0) {
        selectedBarberId = barber.id;
        break;
      }
    }

    if (!selectedBarberId) {
      throw new Error("Selected slot is no longer available");
    }

    const booking = await bookingRepository.createBookingWithHistory({
      code: bookingCode(),
      branchId: input.branchId,
      memberId: input.memberId,
      createdById: input.memberId,
      barbermanId: selectedBarberId,
      serviceId: input.serviceId,
      scheduledStart,
      scheduledEnd,
      notes: input.notes,
      status: "PAYMENT_PENDING",
    });

    return booking;
  },

  async memberHistory(memberId: string) {
    await bookingService.cleanupExpiredPaymentPendingBookings();

    const bookings = await bookingRepository.findMemberBookingHistory(memberId);
    const deadlineHours = await getDepositPaymentDeadlineHours();
    const refundDeadlineHours = await getRefundRequestDeadlineHours();

    return bookings.map((booking) => {
      const now = new Date();
      let phase: "Upcoming" | "Berlangsung" | "Selesai";

      if (
        booking.status === "COMPLETED" ||
        booking.status === "CANCELED" ||
        booking.status === "NO_SHOW"
      ) {
        phase = "Selesai";
      } else if (
        booking.status === "IN_PROGRESS" ||
        (booking.scheduledStart <= now && booking.scheduledEnd >= now)
      ) {
        phase = "Berlangsung";
      } else {
        phase = "Upcoming";
      }

      return {
        id: booking.id,
        code: booking.code,
        status: booking.status as BookingStatus,
        phase,
        createdAt: booking.createdAt,
        pendingExpiresAt:
          booking.status === "PAYMENT_PENDING"
            ? getEarlierDeadline(
                booking.payment?.qrisExpiresAt ??
                  getPendingBookingHoldExpiresAt(booking.createdAt),
                getEarlierDeadline(
                  getPendingBookingHoldExpiresAt(booking.createdAt),
                  getDepositPaymentDeadline({
                    scheduledStart: booking.scheduledStart,
                    deadlineHours,
                  }),
                ),
              )
            : null,
        scheduledStart: booking.scheduledStart,
        scheduledEnd: booking.scheduledEnd,
        service: booking.service,
        barberman: booking.barberman,
        branch: booking.branch,
        queue: booking.queueNumber
          ? {
              number: booking.queueNumber,
              label: formatQueueNumber(booking.queueNumber),
              status: booking.queueStatus,
              assignedAt: booking.queueAssignedAt,
              calledAt: booking.queueCalledAt,
            }
          : null,
        payment: booking.payment
          ? {
              id: booking.payment.id,
              status: booking.payment.status,
              amountDue: toNumberDecimal(booking.payment.amountDue),
              isDeposit: booking.payment.isDeposit,
              depositAmount: booking.payment.depositAmount
                ? toNumberDecimal(booking.payment.depositAmount)
                : null,
              externalRef: booking.payment.externalRef,
              qrisString: booking.payment.qrisString,
              qrisImageUrl: booking.payment.qrisImageUrl,
              qrisExpiresAt: booking.payment.qrisExpiresAt,
            }
          : null,
        refund: booking.refundRequest
          ? {
              id: booking.refundRequest.id,
              status: booking.refundRequest.status,
              amount: toNumberDecimal(booking.refundRequest.amount),
              reason: booking.refundRequest.reason,
              contactPhone: booking.refundRequest.contactPhone,
              refundMethod: booking.refundRequest.refundMethod,
              requestedAt: booking.refundRequest.requestedAt,
              reviewedAt: booking.refundRequest.reviewedAt,
              adminNote: booking.refundRequest.adminNote,
              rejectionReason: booking.refundRequest.rejectionReason,
            }
          : null,
        refundEligibility: {
          canRequest:
            !booking.isWalkIn &&
            booking.status === "UPCOMING" &&
            booking.payment?.status === "PAID" &&
            !booking.refundRequest &&
            isBeforeRefundRequestDeadline({
              scheduledStart: booking.scheduledStart,
              deadlineHours: refundDeadlineHours,
              now,
            }),
          deadlineHours: refundDeadlineHours,
          deadline: getRefundRequestDeadline({
            scheduledStart: booking.scheduledStart,
            deadlineHours: refundDeadlineHours,
          }),
        },
      };
    });
  },

  async cancelPendingBookingByMember(input: CancelPendingBookingInput) {
    const canceled = await bookingRepository.cancelPendingBookingByMember({
      bookingId: input.bookingId,
      memberId: input.memberId,
      changedById: input.memberId,
      reason: "Booking canceled by member before deposit payment",
    });

    if (canceled === null) {
      throw new Error("Booking not found");
    }

    return { deleted: true };
  },

  async adminDailyDashboard(input: { branchId: string; date?: string }) {
    await bookingService.cleanupExpiredPaymentPendingBookings();

    const dayWindow = input.date
      ? getBusinessDayWindowFromInput(input.date)
      : getBusinessDayWindow(new Date());

    await bookingRepository.assignMissingQueueTicketsForDay({
      branchId: input.branchId,
      dateStart: dayWindow.start,
      dateEnd: dayWindow.end,
    });

    await bookingRepository.markExpiredCalledQueues({
      branchId: input.branchId,
      queueDate: dayWindow.start,
    });

    const allBookings = await bookingRepository.findAdminDailyBookings(
      input.branchId,
      dayWindow.start,
      dayWindow.end,
    );

    // Admin reservation list should only show bookings that have progressed past DP pending.
    const bookings = allBookings.filter(
      (booking) => booking.status !== "PAYMENT_PENDING",
    );

    const summary = {
      total: bookings.length,
      upcoming: bookings.filter((booking) => booking.status === "UPCOMING")
        .length,
      inProgress: bookings.filter((booking) => booking.status === "IN_PROGRESS")
        .length,
      completed: bookings.filter((booking) => booking.status === "COMPLETED")
        .length,
      canceled: bookings.filter((booking) => booking.status === "CANCELED")
        .length,
      noShow: bookings.filter((booking) => booking.status === "NO_SHOW").length,
      paymentPending: allBookings.filter(
        (booking) => booking.status === "PAYMENT_PENDING",
      ).length,
    };
    const queueItems = bookings.filter((booking) => booking.queueNumber);
    const queueSummary = {
      waiting: queueItems.filter(
        (booking) => booking.queueStatus === BookingQueueStatus.WAITING,
      ).length,
      called: queueItems.filter(
        (booking) => booking.queueStatus === BookingQueueStatus.CALLED,
      ).length,
      serving: queueItems.filter(
        (booking) => booking.queueStatus === BookingQueueStatus.SERVING,
      ).length,
      done: queueItems.filter(
        (booking) => booking.queueStatus === BookingQueueStatus.DONE,
      ).length,
      missed: queueItems.filter(
        (booking) => booking.queueStatus === BookingQueueStatus.MISSED,
      ).length,
    };

    return {
      date: `${dayWindow.parts.year}-${String(dayWindow.parts.month).padStart(2, "0")}-${String(dayWindow.parts.day).padStart(2, "0")}`,
      summary,
      queueSummary,
      bookings: bookings.map((booking) => ({
        id: booking.id,
        code: booking.code,
        status: booking.status,
        scheduledStart: booking.scheduledStart,
        scheduledEnd: booking.scheduledEnd,
        isWalkIn: booking.isWalkIn,
        queue: booking.queueNumber
          ? {
              number: booking.queueNumber,
              label: formatQueueNumber(booking.queueNumber),
              status: booking.queueStatus,
              assignedAt: booking.queueAssignedAt,
              calledAt: booking.queueCalledAt,
              noShowAt: booking.queueNoShowAt,
            }
          : null,
        walkInName: booking.walkInName,
        walkInPhone: booking.walkInPhone,
        service: booking.service,
        products: booking.products.map((product) => ({
          id: product.id,
          itemName: product.itemName,
          quantity: product.quantity,
          unitPrice: toNumberDecimal(product.unitPrice),
          subtotal: toNumberDecimal(product.subtotal),
        })),
        totalDue: calculateTotalDue({
          servicePrice: booking.service.price,
          products: booking.products,
        }),
        remainingDue: Math.max(
          calculateTotalDue({
            servicePrice: booking.service.price,
            products: booking.products,
          }) -
            (booking.payment?.status === "PAID"
              ? toNumberDecimal(booking.payment.amountPaid ?? 0)
              : 0),
          0,
        ),
        payment: booking.payment
          ? {
              id: booking.payment.id,
              status: booking.payment.status,
              amountDue: toNumberDecimal(booking.payment.amountDue),
              amountPaid: booking.payment.amountPaid
                ? toNumberDecimal(booking.payment.amountPaid)
                : null,
              changeAmount: booking.payment.changeAmount
                ? toNumberDecimal(booking.payment.changeAmount)
                : null,
              isDeposit: booking.payment.isDeposit,
              depositAmount: booking.payment.depositAmount
                ? toNumberDecimal(booking.payment.depositAmount)
                : null,
              externalRef: booking.payment.externalRef,
              paidAt: booking.payment.paidAt,
              qrisString: booking.payment.qrisString,
              qrisImageUrl: booking.payment.qrisImageUrl,
              qrisExpiresAt: booking.payment.qrisExpiresAt,
            }
          : null,
        refund: booking.refundRequest
          ? {
              id: booking.refundRequest.id,
              status: booking.refundRequest.status,
              amount: toNumberDecimal(booking.refundRequest.amount),
              reason: booking.refundRequest.reason,
              contactPhone: booking.refundRequest.contactPhone,
              refundMethod: booking.refundRequest.refundMethod,
              requestedAt: booking.refundRequest.requestedAt,
              reviewedAt: booking.refundRequest.reviewedAt,
              adminNote: booking.refundRequest.adminNote,
              rejectionReason: booking.refundRequest.rejectionReason,
            }
          : null,
        barberman: booking.barberman,
        member: booking.member,
      })),
    };
  },

  async callNextQueue(input: {
    branchId: string;
    date?: string;
    changedById: string;
  }) {
    const dayWindow = input.date
      ? getBusinessDayWindowFromInput(input.date)
      : getBusinessDayWindow(new Date());

    await bookingRepository.markExpiredCalledQueues({
      branchId: input.branchId,
      queueDate: dayWindow.start,
      changedById: input.changedById,
    });

    const booking = await bookingRepository.callNextQueueBooking({
      branchId: input.branchId,
      queueDate: dayWindow.start,
      changedById: input.changedById,
    });

    if (!booking) {
      return { booking: null };
    }

    return {
      booking: {
        id: booking.id,
        code: booking.code,
        queue: {
          number: booking.queueNumber,
          label: formatQueueNumber(booking.queueNumber),
          status: booking.queueStatus,
          calledAt: booking.queueCalledAt,
        },
        customerName:
          booking.walkInName ?? booking.member?.fullName ?? "Pelanggan",
        scheduledStart: booking.scheduledStart,
        service: booking.service,
        barberman: booking.barberman,
      },
    };
  },

  async listReservationProducts(branchId: string) {
    const items = await bookingRepository.findActiveInventoryItems(branchId);
    return items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      stockQty: item.stockQty,
      sellingPrice: toNumberDecimal(item.sellingPrice),
    }));
  },

  async getWalkInStartAvailability(input: StartAvailabilityInput) {
    const booking = await bookingRepository.findBookingById(input.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.branchId !== input.branchId) {
      throw new Error("Booking is outside your branch scope");
    }

    if (!booking.isWalkIn || booking.status !== "UPCOMING") {
      throw new Error("Availability is only available for waiting walk-in");
    }

    const serviceStart = booking.scheduledStart;
    const serviceTotalMinutes =
      booking.service.durationMinutes + (booking.service.bufferMinutes ?? 0);
    const serviceEnd = new Date(
      serviceStart.getTime() + serviceTotalMinutes * 60 * 1000,
    );
    const dayWindow = getBusinessDayWindow(serviceStart);
    const slotStartMinutes = getBusinessMinutes(serviceStart);
    const slotEndMinutes = slotStartMinutes + serviceTotalMinutes;
    const dayOfWeek = dayOfWeekFromDateParts(dayWindow.parts);

    const [branch, operatingHour, barbermen, holidays, schedules] =
      await Promise.all([
        bookingRepository.findBranchById(input.branchId),
        bookingRepository.findOperatingHour(input.branchId, dayOfWeek),
        bookingRepository.findBarbermen(input.branchId),
        bookingRepository.findHolidays(
          input.branchId,
          dayWindow.start,
          dayWindow.end,
        ),
        bookingRepository.findBarberSchedules(
          input.branchId,
          dayWindow.start,
          dayWindow.end,
        ),
      ]);

    if (!branch || !branch.isActive || !operatingHour || operatingHour.isClosed) {
      return {
        serviceStart,
        serviceEnd,
        barbermen: barbermen.map((barber) => ({
          id: barber.id,
          name: barber.name,
          isAvailable: false,
          reason: "Cabang tutup atau tidak aktif",
        })),
      };
    }

    const defaultOpenMinutes = parseTimeToMinutes(operatingHour.openTime);
    const defaultCloseMinutes = parseTimeToMinutes(operatingHour.closeTime);

    const barberAvailability = await Promise.all(
      barbermen.map(async (barber) => {
        const blockedByHoliday = holidays.some((holiday) =>
          holidayBlocksSlot(
            holiday,
            barber.id,
            slotStartMinutes,
            slotEndMinutes,
          ),
        );

        if (blockedByHoliday) {
          return {
            id: barber.id,
            name: barber.name,
            isAvailable: false,
            reason: "Hari libur",
          };
        }

        const barberSchedule = schedules.find(
          (schedule) => schedule.barbermanId === barber.id,
        );

        if (
          !scheduleAllowsSlot({
            schedule: barberSchedule,
            defaultOpenMinutes,
            defaultCloseMinutes,
            slotStartMinutes,
            slotEndMinutes,
          })
        ) {
          return {
            id: barber.id,
            name: barber.name,
            isAvailable: false,
            reason: "Diluar jam kerja",
          };
        }

        const overlaps = await bookingRepository.findOverlappingBookings({
          branchId: input.branchId,
          barbermanId: barber.id,
          scheduledStart: serviceStart,
          scheduledEnd: serviceEnd,
        });

        const blocks = overlaps.some((item) => item.id !== input.bookingId);

        return {
          id: barber.id,
          name: barber.name,
          isAvailable: !blocks,
          reason: blocks ? "Ada booking aktif di jam ini" : null,
        };
      }),
    );

    return {
      serviceStart,
      serviceEnd,
      barbermen: barberAvailability,
    };
  },

  async addBookingProduct(input: AddBookingProductInput) {
    if (!input.inventoryItemId) {
      throw new Error("inventoryItemId is required");
    }

    const quantity = Math.trunc(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("quantity must be greater than 0");
    }

    const booking = await bookingRepository.findBookingById(input.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.branchId !== input.branchId) {
      throw new Error("Booking is outside your branch scope");
    }

    if (booking.status !== "UPCOMING" && booking.status !== "IN_PROGRESS") {
      throw new Error("Products can only be changed for UPCOMING/IN_PROGRESS");
    }

    if (booking.isWalkIn && !booking.barbermanId) {
      throw new Error("Produk hanya bisa ditambahkan setelah walk-in dimulai");
    }

    const result = await bookingRepository.addProductToBooking({
      bookingId: input.bookingId,
      inventoryItemId: input.inventoryItemId,
      quantity,
      changedById: input.changedById,
    });

    return {
      bookingProduct: {
        id: result.bookingProduct.id,
        itemName: result.bookingProduct.itemName,
        quantity: result.bookingProduct.quantity,
        unitPrice: toNumberDecimal(result.bookingProduct.unitPrice),
        subtotal: toNumberDecimal(result.bookingProduct.subtotal),
      },
      totalDue: toNumberDecimal(result.totalDue),
    };
  },

  async removeBookingProduct(input: RemoveBookingProductInput) {
    if (!input.bookingProductId) {
      throw new Error("bookingProductId is required");
    }

    const booking = await bookingRepository.findBookingById(input.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.branchId !== input.branchId) {
      throw new Error("Booking is outside your branch scope");
    }

    if (booking.status !== "UPCOMING" && booking.status !== "IN_PROGRESS") {
      throw new Error("Products can only be changed for UPCOMING/IN_PROGRESS");
    }

    if (booking.isWalkIn && !booking.barbermanId) {
      throw new Error("Produk hanya bisa diubah setelah walk-in dimulai");
    }

    const result = await bookingRepository.removeBookingProduct({
      bookingId: input.bookingId,
      bookingProductId: input.bookingProductId,
      changedById: input.changedById,
    });

    return {
      removed: {
        id: result.bookingProduct.id,
        itemName: result.bookingProduct.itemName,
        quantity: result.bookingProduct.quantity,
      },
      totalDue: toNumberDecimal(result.totalDue),
    };
  },

  async createWalkInBooking(input: CreateWalkInBookingInput) {
    if (!input.walkInName.trim()) {
      throw new Error("walkInName is required");
    }

    const scheduledStart = new Date(input.scheduledStart);
    if (Number.isNaN(scheduledStart.getTime())) {
      throw new Error("Invalid scheduledStart format");
    }

    const service = await bookingRepository.findServiceById(input.serviceId);
    if (!service || !service.isActive) {
      throw new Error("Service not found or inactive");
    }

    if (service.branchId !== input.branchId) {
      throw new Error("Service does not belong to selected branch");
    }

    const dayWindow = getBusinessDayWindow(scheduledStart);
    const dayOfWeek = dayOfWeekFromDateParts(dayWindow.parts);
    const operatingHour = await bookingRepository.findOperatingHour(
      input.branchId,
      dayOfWeek,
    );
    if (!operatingHour || operatingHour.isClosed) {
      throw new Error("Selected slot is not available");
    }

    const slotStartMinutes = getBusinessMinutes(scheduledStart);
    const serviceTotalMinutes = service.durationMinutes + service.bufferMinutes;
    const slotEndMinutes = slotStartMinutes + serviceTotalMinutes;
    const defaultOpenMinutes = parseTimeToMinutes(operatingHour.openTime);
    const defaultCloseMinutes = parseTimeToMinutes(operatingHour.closeTime);

    if (
      slotStartMinutes < defaultOpenMinutes ||
      slotEndMinutes > defaultCloseMinutes
    ) {
      throw new Error("Selected slot is not available");
    }

    const [barbermen, holidays, schedules] = await Promise.all([
      bookingRepository.findBarbermen(input.branchId),
      bookingRepository.findHolidays(
        input.branchId,
        dayWindow.start,
        dayWindow.end,
      ),
      bookingRepository.findBarberSchedules(
        input.branchId,
        dayWindow.start,
        dayWindow.end,
      ),
    ]);

    const hasAvailableBarber = barbermen.some((barber) => {
      const blockedByHoliday = holidays.some((holiday) =>
        holidayBlocksSlot(holiday, barber.id, slotStartMinutes, slotEndMinutes),
      );

      if (blockedByHoliday) {
        return false;
      }

      const barberSchedule = schedules.find(
        (schedule) => schedule.barbermanId === barber.id,
      );

      return scheduleAllowsSlot({
        schedule: barberSchedule,
        defaultOpenMinutes,
        defaultCloseMinutes,
        slotStartMinutes,
        slotEndMinutes,
      });
    });

    if (!hasAvailableBarber) {
      throw new Error("Semua barber diluar jam kerja pada jam walk-in ini");
    }

    return bookingRepository.createWalkInBookingWithHistory({
      code: bookingCode(),
      branchId: input.branchId,
      createdById: input.createdById,
      serviceId: input.serviceId,
      scheduledStart,
      scheduledEnd: scheduledStart,
      walkInName: input.walkInName.trim(),
      walkInPhone: input.walkInPhone,
      notes: input.notes,
    });
  },

  async updateBookingStatus(input: UpdateBookingStatusInput) {
    const booking = await bookingRepository.findBookingById(input.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.branchId !== input.branchId) {
      throw new Error("Booking is outside your branch scope");
    }

    const allowedTransition: Record<string, string> = {
      UPCOMING: "IN_PROGRESS",
      IN_PROGRESS: "COMPLETED",
    };

    const expectedNext = allowedTransition[booking.status];
    const isNoShowFromUpcoming =
      booking.status === "UPCOMING" && input.newStatus === "NO_SHOW";
    if (
      !isNoShowFromUpcoming &&
      (!expectedNext || expectedNext !== input.newStatus)
    ) {
      throw new Error("Invalid booking status transition");
    }

    const now = new Date();
    let barbermanId: string | undefined;
    let scheduledEnd: Date | undefined;
    let serviceStartAt = now;

    if (input.newStatus === "IN_PROGRESS") {
      if (booking.isWalkIn && !booking.barbermanId) {
        if (!input.barbermanId) {
          throw new Error("Pilih barber terlebih dahulu");
        }

        const availability = await bookingService.getWalkInStartAvailability({
          bookingId: input.bookingId,
          branchId: input.branchId,
        });
        const selectedBarber = availability.barbermen.find(
          (barber) => barber.id === input.barbermanId,
        );

        if (!selectedBarber) {
          throw new Error("Barber tidak tersedia untuk cabang ini");
        }

        if (!selectedBarber.isAvailable) {
          throw new Error(
            selectedBarber.reason
              ? `Barber tidak tersedia: ${selectedBarber.reason}`
              : "Barber tidak tersedia",
          );
        }

        barbermanId = input.barbermanId;
        serviceStartAt = availability.serviceStart;
        scheduledEnd = availability.serviceEnd;
      } else if (!booking.barbermanId) {
        throw new Error("Booking belum memiliki barber");
      }
    }

    const updated = await bookingRepository.updateBookingStatusWithHistory({
      bookingId: input.bookingId,
      changedById: input.changedById,
      newStatus: input.newStatus,
      reason: input.reason,
      barbermanId,
      scheduledEnd,
      checkInAt:
        input.newStatus === "IN_PROGRESS"
          ? serviceStartAt
          : (booking.checkInAt ?? undefined),
      serviceStartAt:
        input.newStatus === "IN_PROGRESS"
          ? serviceStartAt
          : (booking.serviceStartAt ?? undefined),
      serviceEndAt:
        input.newStatus === "COMPLETED"
          ? now
          : (booking.serviceEndAt ?? undefined),
      completedAt:
        input.newStatus === "COMPLETED"
          ? now
          : (booking.completedAt ?? undefined),
    });

    if (!updated) {
      throw new Error("Booking not found");
    }

    return updated;
  },
};
