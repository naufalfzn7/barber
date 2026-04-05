import { DayOfWeek, type UserRole } from "@prisma/client";
import { bookingRepository } from "@/server/repositories/bookingRepository";
import { schedulingRepository } from "@/server/repositories/schedulingRepository";

type Actor = {
  userId: string;
  role: UserRole;
  branchId?: string | null;
};

function assertSuperAdmin(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
}

function assertBranchExists(branchId: string) {
  return bookingRepository.findBranchById(branchId);
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error("Invalid time format. Use HH:MM");
  }

  const [hour, minute] = trimmed.split(":").map(Number);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Invalid time format. Use HH:MM");
  }

  return trimmed;
}

function normalizeDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function normalizeDayOfWeek(value: string): DayOfWeek {
  const upper = value.toUpperCase();
  if (!Object.values(DayOfWeek).includes(upper as DayOfWeek)) {
    throw new Error("Invalid dayOfWeek value");
  }
  return upper as DayOfWeek;
}

export const schedulingService = {
  async getOperatingHours(branchId: string, actor: Actor) {
    assertSuperAdmin(actor);
    const branch = await assertBranchExists(branchId);
    if (!branch || !branch.isActive) {
      throw new Error("Branch not found or inactive");
    }

    return schedulingRepository.listOperatingHours(branchId);
  },

  async saveOperatingHours(
    branchId: string,
    hours: Array<{
      dayOfWeek: string;
      openTime: string;
      closeTime: string;
      isClosed?: boolean;
    }>,
    actor: Actor,
  ) {
    assertSuperAdmin(actor);
    const branch = await assertBranchExists(branchId);
    if (!branch || !branch.isActive) {
      throw new Error("Branch not found or inactive");
    }

    if (!hours.length) {
      throw new Error("hours cannot be empty");
    }

    const results = [] as Awaited<
      ReturnType<typeof schedulingRepository.upsertOperatingHour>
    >[];

    for (const item of hours) {
      const dayOfWeek = normalizeDayOfWeek(item.dayOfWeek);
      const openTime = normalizeTime(item.openTime);
      const closeTime = normalizeTime(item.closeTime);

      if (!item.isClosed && openTime >= closeTime) {
        throw new Error(
          `openTime must be earlier than closeTime for ${dayOfWeek}`,
        );
      }

      results.push(
        await schedulingRepository.upsertOperatingHour({
          branchId,
          dayOfWeek,
          openTime,
          closeTime,
          isClosed: Boolean(item.isClosed),
        }),
      );
    }

    return results;
  },

  async getBarberSchedules(branchId: string, actor: Actor, date?: string) {
    assertSuperAdmin(actor);
    const branch = await assertBranchExists(branchId);
    if (!branch || !branch.isActive) {
      throw new Error("Branch not found or inactive");
    }

    const parsedDate = date ? normalizeDate(date) : undefined;
    return schedulingRepository.listBarberSchedules(branchId, parsedDate);
  },

  async saveBarberSchedule(
    input: {
      branchId: string;
      barbermanId: string;
      date: string;
      startTime?: string;
      endTime?: string;
      isDayOff?: boolean;
    },
    actor: Actor,
  ) {
    assertSuperAdmin(actor);

    const branch = await assertBranchExists(input.branchId);
    if (!branch || !branch.isActive) {
      throw new Error("Branch not found or inactive");
    }

    const barbermen = await bookingRepository.findBarbermen(
      input.branchId,
      input.barbermanId,
    );

    if (!barbermen.length) {
      throw new Error("Barberman not found or inactive");
    }

    const date = normalizeDate(input.date);
    const isDayOff = Boolean(input.isDayOff);

    if (!isDayOff) {
      if (!input.startTime || !input.endTime) {
        throw new Error("startTime and endTime are required");
      }

      const startTime = normalizeTime(input.startTime);
      const endTime = normalizeTime(input.endTime);

      if (startTime >= endTime) {
        throw new Error("startTime must be earlier than endTime");
      }

      return schedulingRepository.replaceBarberSchedule({
        branchId: input.branchId,
        barbermanId: input.barbermanId,
        date,
        startTime,
        endTime,
        isDayOff: false,
      });
    }

    return schedulingRepository.replaceBarberSchedule({
      branchId: input.branchId,
      barbermanId: input.barbermanId,
      date,
      startTime: "00:00",
      endTime: "00:00",
      isDayOff: true,
    });
  },

  async getHolidays(branchId: string, actor: Actor) {
    assertSuperAdmin(actor);
    const branch = await assertBranchExists(branchId);
    if (!branch || !branch.isActive) {
      throw new Error("Branch not found or inactive");
    }

    return schedulingRepository.listHolidays(branchId);
  },

  async createHoliday(
    input: {
      branchId: string;
      date: string;
      barbermanId?: string | null;
      isFullDay?: boolean;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    },
    actor: Actor,
  ) {
    assertSuperAdmin(actor);

    const branch = await assertBranchExists(input.branchId);
    if (!branch || !branch.isActive) {
      throw new Error("Branch not found or inactive");
    }

    const date = normalizeDate(input.date);
    const isFullDay = input.isFullDay !== false;
    const barbermanId = input.barbermanId?.trim() || null;

    if (barbermanId) {
      const barbermen = await bookingRepository.findBarbermen(
        input.branchId,
        barbermanId,
      );
      if (!barbermen.length) {
        throw new Error("Barberman not found or inactive");
      }
    }

    const startTime =
      input.startTime !== undefined && input.startTime !== null
        ? normalizeTime(input.startTime)
        : null;
    const endTime =
      input.endTime !== undefined && input.endTime !== null
        ? normalizeTime(input.endTime)
        : null;

    if (!isFullDay && (!startTime || !endTime || startTime >= endTime)) {
      throw new Error(
        "startTime and endTime are required when isFullDay is false",
      );
    }

    return schedulingRepository.createHoliday({
      branchId: input.branchId,
      barbermanId,
      date,
      isFullDay,
      startTime,
      endTime,
      reason: input.reason?.trim() || null,
    });
  },

  async deleteHoliday(holidayId: string, branchId: string, actor: Actor) {
    assertSuperAdmin(actor);
    const branch = await assertBranchExists(branchId);
    if (!branch || !branch.isActive) {
      throw new Error("Branch not found or inactive");
    }

    const result = await schedulingRepository.deleteHoliday(
      holidayId,
      branchId,
    );
    if (result.count === 0) {
      throw new Error("Holiday not found");
    }

    return { deleted: true };
  },
};
