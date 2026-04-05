import { DayOfWeek } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export const schedulingRepository = {
  listOperatingHours(branchId: string) {
    return prisma.operatingHour.findMany({
      where: { branchId },
      orderBy: { dayOfWeek: "asc" },
    });
  },

  upsertOperatingHour(input: {
    branchId: string;
    dayOfWeek: DayOfWeek;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }) {
    return prisma.operatingHour.upsert({
      where: {
        branchId_dayOfWeek: {
          branchId: input.branchId,
          dayOfWeek: input.dayOfWeek,
        },
      },
      create: {
        branchId: input.branchId,
        dayOfWeek: input.dayOfWeek,
        openTime: input.openTime,
        closeTime: input.closeTime,
        isClosed: input.isClosed,
      },
      update: {
        openTime: input.openTime,
        closeTime: input.closeTime,
        isClosed: input.isClosed,
      },
    });
  },

  listBarberSchedules(branchId: string, date?: Date) {
    return prisma.barberSchedule.findMany({
      where: {
        branchId,
        ...(date
          ? {
              date: {
                gte: new Date(
                  date.getFullYear(),
                  date.getMonth(),
                  date.getDate(),
                ),
                lt: new Date(
                  date.getFullYear(),
                  date.getMonth(),
                  date.getDate() + 1,
                ),
              },
            }
          : {}),
      },
      include: {
        barberman: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
  },

  replaceBarberSchedule(input: {
    branchId: string;
    barbermanId: string;
    date: Date;
    startTime: string;
    endTime: string;
    isDayOff: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.barberSchedule.deleteMany({
        where: {
          branchId: input.branchId,
          barbermanId: input.barbermanId,
          date: input.date,
        },
      });

      if (input.isDayOff) {
        return null;
      }

      return tx.barberSchedule.create({
        data: {
          branchId: input.branchId,
          barbermanId: input.barbermanId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          isDayOff: false,
        },
      });
    });
  },

  listHolidays(branchId: string) {
    return prisma.holiday.findMany({
      where: { branchId },
      include: {
        barberman: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  },

  createHoliday(input: {
    branchId: string;
    barbermanId?: string | null;
    date: Date;
    isFullDay: boolean;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
  }) {
    return prisma.holiday.create({
      data: {
        branchId: input.branchId,
        barbermanId: input.barbermanId ?? null,
        date: input.date,
        isFullDay: input.isFullDay,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        reason: input.reason ?? null,
      },
    });
  },

  deleteHoliday(holidayId: string, branchId: string) {
    return prisma.holiday.deleteMany({
      where: { id: holidayId, branchId },
    });
  },
};
