import { DayOfWeek, type BookingStatus } from "@prisma/client";
import { bookingRepository } from "@/server/repositories/bookingRepository";

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
  barbermanId?: string;
  walkInName: string;
  walkInPhone?: string;
  notes?: string;
};

type UpdateBookingStatusInput = {
  bookingId: string;
  changedById: string;
  branchId: string;
  newStatus: "IN_PROGRESS" | "COMPLETED" | "NO_SHOW";
  reason?: string;
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

const DEPOSIT_PAYMENT_DEADLINE_OFFSET_MINUTES = 60;
const PAYMENT_EXPIRY_REMINDER_MINUTES = 2;

function getPendingExpiresAt(scheduledStart: Date) {
  return new Date(
    scheduledStart.getTime() -
      DEPOSIT_PAYMENT_DEADLINE_OFFSET_MINUTES * 60 * 1000,
  );
}

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
    const cutoff = new Date(
      now.getTime() + DEPOSIT_PAYMENT_DEADLINE_OFFSET_MINUTES * 60 * 1000,
    );
    const canceled = await bookingRepository.releaseExpiredPendingBookings({
      before: cutoff,
      reason:
        "Auto canceled because deposit was not paid 1 hour before reservation",
    });

    await bookingRepository.notifyPendingBookingsExpiringSoon({
      windowStart: new Date(
        now.getTime() +
          (DEPOSIT_PAYMENT_DEADLINE_OFFSET_MINUTES +
            PAYMENT_EXPIRY_REMINDER_MINUTES) *
            60 *
            1000,
      ),
      windowEnd: new Date(
        now.getTime() +
          (DEPOSIT_PAYMENT_DEADLINE_OFFSET_MINUTES +
            PAYMENT_EXPIRY_REMINDER_MINUTES +
            1) *
            60 *
            1000,
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

    if (!operatingHour || operatingHour.isClosed) {
      return { date: input.date, slots: [] };
    }

    const barbermen = await bookingRepository.findBarbermen(
      input.branchId,
      input.barbermanId,
    );
    if (!barbermen.length) {
      return { date: input.date, slots: [] };
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
    }> = [];

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

      const availableBarberIds: string[] = [];
      const unavailableReasons: string[] = [];

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

        if (!overlaps) {
          availableBarberIds.push(barberman.id);
        } else {
          unavailableReasons.push(`${barberman.name} - Sudah dipesan`);
        }
      }

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        availableBarberIds,
        isAvailable: availableBarberIds.length > 0,
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
            ? (booking.payment?.qrisExpiresAt ??
              getPendingExpiresAt(booking.scheduledStart))
            : null,
        scheduledStart: booking.scheduledStart,
        scheduledEnd: booking.scheduledEnd,
        service: booking.service,
        barberman: booking.barberman,
        branch: booking.branch,
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

    return {
      date: `${dayWindow.parts.year}-${String(dayWindow.parts.month).padStart(2, "0")}-${String(dayWindow.parts.day).padStart(2, "0")}`,
      summary,
      bookings: bookings.map((booking) => ({
        id: booking.id,
        code: booking.code,
        status: booking.status,
        scheduledStart: booking.scheduledStart,
        scheduledEnd: booking.scheduledEnd,
        isWalkIn: booking.isWalkIn,
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
        barberman: booking.barberman,
        member: booking.member,
      })),
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

    return bookingRepository.createWalkInBookingWithHistory({
      code: bookingCode(),
      branchId: input.branchId,
      createdById: input.createdById,
      barbermanId: selectedBarberId,
      serviceId: input.serviceId,
      scheduledStart,
      scheduledEnd,
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
    const updated = await bookingRepository.updateBookingStatusWithHistory({
      bookingId: input.bookingId,
      changedById: input.changedById,
      newStatus: input.newStatus,
      reason: input.reason,
      checkInAt:
        input.newStatus === "IN_PROGRESS"
          ? now
          : (booking.checkInAt ?? undefined),
      serviceStartAt:
        input.newStatus === "IN_PROGRESS"
          ? now
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
