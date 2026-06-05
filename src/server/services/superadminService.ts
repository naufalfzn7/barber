import bcrypt from "bcryptjs";
import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { userRepository } from "@/server/repositories/userRepository";
import { formatIndonesianDate } from "@/lib/dateFormat";

type BranchSummary = {
  branchId: string;
  branchCode: string;
  branchName: string;
  timezone: string;
  isActive: boolean;
  adminCount: number;
  barberCount: number;
  serviceCount: number;
  totalBookings: number;
  completedBookings: number;
  revenue: number;
  qrisRevenue: number;
  cashRevenue: number;
  topService: string;
  lowStockCount: number;
  openedSince: string;
};

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getStartOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getReportWindow(rangeInput?: string) {
  const normalized = (rangeInput ?? "today").trim().toLowerCase();
  const now = new Date();
  const todayStart = getStartOfDay(now);

  if (normalized === "week") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return {
      start,
      end: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
      rangeKey: "week" as const,
      rangeLabel: "7 hari terakhir",
    };
  }

  if (normalized === "month") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 29);
    return {
      start,
      end: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
      rangeKey: "month" as const,
      rangeLabel: "30 hari terakhir",
    };
  }

  if (normalized === "today" || normalized === "") {
    return {
      start: todayStart,
      end: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
      rangeKey: "today" as const,
      rangeLabel: "Hari ini",
    };
  }

  const customDate = new Date(rangeInput ?? "");
  if (Number.isNaN(customDate.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  const start = getStartOfDay(customDate);
  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
    rangeKey: "custom" as const,
    rangeLabel: `Tanggal ${formatIndonesianDate(start)}`,
  };
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function inferCategory(name: string, code: string) {
  const value = `${name} ${code}`.toLowerCase();
  if (value.includes("beard") || value.includes("shave")) {
    return "beard";
  }
  if (
    value.includes("color") ||
    value.includes("treat") ||
    value.includes("spa") ||
    value.includes("scalp")
  ) {
    return "treatment";
  }
  if (value.includes("package") || value.includes("bundle")) {
    return "package";
  }
  return "haircut";
}

function toNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) {
    return 0;
  }
  return Number(value.toString());
}

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "MB-";
  for (let index = 0; index < 8; index += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function loadBranchSummaries(rangeInput?: string) {
  const { start, end, rangeKey, rangeLabel } = getReportWindow(rangeInput);

  const [branches, lowStockItems] = await Promise.all([
    prisma.branch.findMany({
      include: {
        users: {
          where: { role: "ADMIN" },
          select: { id: true },
        },
        barbermen: {
          select: { id: true, isActive: true },
        },
        services: {
          select: { id: true, isActive: true, name: true, code: true },
        },
        bookings: {
          where: {
            scheduledStart: {
              gte: start,
              lt: end,
            },
          },
          include: {
            service: {
              select: { id: true, name: true },
            },
            payment: {
              select: {
                method: true,
                status: true,
                amountPaid: true,
                amountDue: true,
              },
            },
          },
          orderBy: { scheduledStart: "asc" },
        },
        inventoryItems: {
          where: { isActive: true },
          select: { id: true, stockQty: true, minStockQty: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryItem.findMany({
      where: {
        isActive: true,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    }),
  ]);

  const summary = {
    revenue: 0,
    bookings: 0,
    completed: 0,
    qris: 0,
    cash: 0,
    activeBranches: 0,
    lowStockAlerts: 0,
  };

  const branchSummaries: BranchSummary[] = branches.map((branch) => {
    const dayBookings = branch.bookings;
    const revenueBookings = dayBookings.filter(
      (booking) => booking.payment?.status === PaymentStatus.PAID,
    );
    const revenue = revenueBookings.reduce(
      (sum, booking) =>
        sum +
        toNumber(booking.payment?.amountPaid ?? booking.payment?.amountDue),
      0,
    );
    const qrisRevenue = revenueBookings
      .filter((booking) => booking.payment?.method === PaymentMethod.QRIS)
      .reduce(
        (sum, booking) =>
          sum +
          toNumber(booking.payment?.amountPaid ?? booking.payment?.amountDue),
        0,
      );
    const cashRevenue = revenueBookings
      .filter((booking) => booking.payment?.method === PaymentMethod.CASH)
      .reduce(
        (sum, booking) =>
          sum +
          toNumber(booking.payment?.amountPaid ?? booking.payment?.amountDue),
        0,
      );

    const serviceCountMap = new Map<string, number>();
    for (const booking of dayBookings) {
      if (
        booking.status === BookingStatus.COMPLETED ||
        booking.payment?.status === PaymentStatus.PAID
      ) {
        const current = serviceCountMap.get(booking.service.name) ?? 0;
        serviceCountMap.set(booking.service.name, current + 1);
      }
    }

    const topService =
      Array.from(serviceCountMap.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0] ?? "-";

    const branchLowStockCount = branch.inventoryItems.filter(
      (item) => item.stockQty <= item.minStockQty,
    ).length;

    summary.revenue += revenue;
    summary.bookings += dayBookings.length;
    summary.completed += dayBookings.filter(
      (booking) => booking.status === BookingStatus.COMPLETED,
    ).length;
    summary.qris += qrisRevenue;
    summary.cash += cashRevenue;
    summary.lowStockAlerts += branchLowStockCount;
    if (branch.isActive) {
      summary.activeBranches += 1;
    }

    return {
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
      timezone: branch.timezone,
      isActive: branch.isActive,
      adminCount: branch.users.length,
      barberCount: branch.barbermen.filter((barberman) => barberman.isActive)
        .length,
      serviceCount: branch.services.filter((service) => service.isActive)
        .length,
      totalBookings: dayBookings.length,
      completedBookings: dayBookings.filter(
        (booking) => booking.status === BookingStatus.COMPLETED,
      ).length,
      revenue,
      qrisRevenue,
      cashRevenue,
      topService,
      lowStockCount: branchLowStockCount,
      openedSince: formatDateKey(branch.createdAt),
    };
  });

  const alerts = lowStockItems
    .filter((item) => item.stockQty <= item.minStockQty)
    .map((item) => ({
      id: item.id,
      branchId: item.branchId,
      branchName: item.branch.name,
      productName: item.name,
      currentStock: item.stockQty,
      minStock: item.minStockQty,
    }));

  return {
    date: formatDateKey(start),
    rangeKey,
    rangeLabel,
    summary,
    branches: branchSummaries,
    alerts,
  };
}

async function loadMonthlyRevenue(branchId?: string) {
  const end = new Date();
  end.setDate(1);
  end.setHours(0, 0, 0, 0);
  end.setMonth(end.getMonth() + 1);

  const start = new Date(end);
  start.setMonth(start.getMonth() - 6);

  const payments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.PAID,
      paidAt: {
        gte: start,
        lt: end,
      },
      ...(branchId ? { booking: { branchId } } : {}),
    },
    include: {
      booking: {
        select: {
          branchId: true,
          branch: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { paidAt: "asc" },
  });

  const monthMap = new Map<
    string,
    {
      month: string;
      total: number;
      branches: Map<
        string,
        { branchId: string; branchName: string; total: number }
      >;
    }
  >();

  for (const payment of payments) {
    if (!payment.paidAt) {
      continue;
    }

    const monthKey = `${payment.paidAt.getFullYear()}-${String(
      payment.paidAt.getMonth() + 1,
    ).padStart(2, "0")}`;

    const current = monthMap.get(monthKey) ?? {
      month: getMonthLabel(payment.paidAt),
      total: 0,
      branches: new Map(),
    };

    const amount = toNumber(payment.amountPaid ?? payment.amountDue);
    current.total += amount;

    const branchIdValue = payment.booking.branchId;
    const branchName = payment.booking.branch.name;
    const branchCurrent = current.branches.get(branchIdValue) ?? {
      branchId: branchIdValue,
      branchName,
      total: 0,
    };

    branchCurrent.total += amount;
    current.branches.set(branchIdValue, branchCurrent);
    monthMap.set(monthKey, current);
  }

  return Array.from(monthMap.values()).map((item) => ({
    month: item.month,
    total: item.total,
    branches: Array.from(item.branches.values()).sort((a, b) =>
      a.branchName.localeCompare(b.branchName),
    ),
  }));
}

export const superadminService = {
  async overview(date?: string) {
    const branchData = await loadBranchSummaries(date);
    const monthlyRevenue = await loadMonthlyRevenue();

    return {
      ...branchData,
      monthlyRevenue,
    };
  },

  async branches(date?: string) {
    return loadBranchSummaries(date);
  },

  async admins(branchId?: string) {
    const admins = await userRepository.findAdmins(branchId);

    return admins.map((admin) => ({
      id: admin.id,
      fullName: admin.fullName,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      role: admin.role,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      generatedPassword: admin.generatedPassword,
      branchId: admin.branchId,
      branchName: admin.branch?.name ?? "-",
      branchCode: admin.branch?.code ?? "-",
      timezone: admin.branch?.timezone ?? "Asia/Jakarta",
      jobTitle: admin.adminProfile?.jobTitle ?? null,
    }));
  },

  async createAdmin(input: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    branchId: string;
    jobTitle?: string;
    actorId?: string;
  }) {
    const exists = await userRepository.findByEmail(input.email.toLowerCase());
    if (exists) {
      throw new Error("Email already in use");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await userRepository.createAdmin({
      fullName: input.fullName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      passwordHash,
      branchId: input.branchId,
      jobTitle: input.jobTitle,
    });
    await userRepository.saveGeneratedPassword({
      userId: user.id,
      password: temporaryPassword,
      actorId: input.actorId,
    });

    return {
      user,
      temporaryPassword,
    };
  },

  async updateAdmin(input: {
    adminId: string;
    fullName?: string;
    email?: string;
    phoneNumber?: string | null;
    branchId?: string | null;
    isActive?: boolean;
    jobTitle?: string | null;
  }) {
    const admin = await userRepository.findAdminById(input.adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    const updated = await userRepository.updateAdmin({
      adminId: admin.id,
      fullName: input.fullName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      branchId: input.branchId,
      isActive: input.isActive,
      jobTitle: input.jobTitle,
    });

    return updated;
  },

  async resetAdminPassword(adminId: string, actorId?: string) {
    const admin = await userRepository.findAdminById(adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await userRepository.updatePassword(admin.id, passwordHash, true);
    await userRepository.saveGeneratedPassword({
      userId: admin.id,
      password: temporaryPassword,
      actorId,
    });

    return { temporaryPassword };
  },

  async updateAdminGeneratedPassword(input: {
    adminId: string;
    password: string;
    actorId?: string;
  }) {
    const admin = await userRepository.findAdminById(input.adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    if (input.password.length < 6) {
      throw new Error("Password minimal 6 karakter");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    await userRepository.updatePassword(admin.id, passwordHash, true);
    await userRepository.saveGeneratedPassword({
      userId: admin.id,
      password: input.password,
      actorId: input.actorId,
    });

    return { temporaryPassword: input.password };
  },

  async deleteAdminGeneratedPassword(adminId: string) {
    const admin = await userRepository.findAdminById(adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    await userRepository.deleteGeneratedPassword(admin.id);
    return { message: "Generated password deleted" };
  },

  async barbermen(branchId?: string) {
    const barbermen = await prisma.barberman.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: {
          select: { id: true, code: true, name: true },
        },
        bookings: {
          where: {
            status: BookingStatus.COMPLETED,
          },
          include: {
            service: {
              select: { name: true },
            },
          },
          orderBy: { scheduledStart: "desc" },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return barbermen.map((barberman) => {
      const specialization = Array.from(
        new Set(barberman.bookings.map((booking) => booking.service.name)),
      ).slice(0, 3);

      return {
        id: barberman.id,
        name: barberman.name,
        code: barberman.code,
        phoneNumber: barberman.phoneNumber,
        isActive: barberman.isActive,
        defaultDuration: barberman.defaultDuration,
        createdAt: barberman.createdAt,
        updatedAt: barberman.updatedAt,
        branchId: barberman.branchId,
        branchName: barberman.branch.name,
        branchCode: barberman.branch.code,
        specialization,
        totalServices: barberman.bookings.length,
        avgServicesPerMonth: barberman.bookings.length,
      };
    });
  },

  async createBarberman(input: {
    branchId: string;
    name: string;
    phoneNumber?: string;
    defaultDuration?: number;
  }) {
    const code = `BBR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return prisma.barberman.create({
      data: {
        branchId: input.branchId,
        code,
        name: input.name,
        phoneNumber: input.phoneNumber,
        defaultDuration: input.defaultDuration ?? 60,
        isActive: true,
      },
    });
  },

  async updateBarberman(input: {
    barbermanId: string;
    branchId?: string;
    name?: string;
    phoneNumber?: string | null;
    defaultDuration?: number;
    isActive?: boolean;
  }) {
    return prisma.barberman.update({
      where: { id: input.barbermanId },
      data: {
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phoneNumber !== undefined
          ? { phoneNumber: input.phoneNumber }
          : {}),
        ...(input.defaultDuration !== undefined
          ? { defaultDuration: input.defaultDuration }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  },

  async services(branchId?: string) {
    const services = await prisma.service.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: {
          select: { id: true, code: true, name: true },
        },
        bookings: {
          where: {
            status: BookingStatus.COMPLETED,
          },
          select: { id: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return services.map((service) => ({
      id: service.id,
      code: service.code,
      name: service.name,
      branchId: service.branchId,
      branchName: service.branch.name,
      branchCode: service.branch.code,
      price: service.price,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      category: inferCategory(service.name, service.code),
      description: `${service.durationMinutes} menit + ${service.bufferMinutes} menit buffer`,
      usageCount: service.bookings.length,
    }));
  },

  async createService(input: {
    branchId: string;
    name: string;
    price: number;
    durationMinutes: number;
    bufferMinutes?: number;
  }) {
    const code = `SRV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return prisma.service.create({
      data: {
        branchId: input.branchId,
        code,
        name: input.name,
        price: new Prisma.Decimal(input.price.toFixed(2)),
        durationMinutes: input.durationMinutes,
        bufferMinutes: input.bufferMinutes ?? 10,
        isActive: true,
      },
    });
  },

  async updateService(input: {
    serviceId: string;
    name?: string;
    price?: number;
    durationMinutes?: number;
    bufferMinutes?: number;
    isActive?: boolean;
  }) {
    return prisma.service.update({
      where: { id: input.serviceId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.price !== undefined
          ? { price: new Prisma.Decimal(input.price.toFixed(2)) }
          : {}),
        ...(input.durationMinutes !== undefined
          ? { durationMinutes: input.durationMinutes }
          : {}),
        ...(input.bufferMinutes !== undefined
          ? { bufferMinutes: input.bufferMinutes }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  },

  async createBranch(input: { code: string; name: string; timezone?: string }) {
    const codeExists = await prisma.branch.findUnique({
      where: { code: input.code },
    });
    if (codeExists) {
      throw new Error("Branch code already exists");
    }

    return prisma.branch.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        timezone: input.timezone ?? "Asia/Jakarta",
        isActive: true,
      },
    });
  },

  async updateBranch(input: {
    branchId: string;
    name?: string;
    timezone?: string;
    isActive?: boolean;
  }) {
    const branch = await prisma.branch.findUnique({
      where: { id: input.branchId },
    });
    if (!branch) {
      throw new Error("Branch not found");
    }

    return prisma.branch.update({
      where: { id: input.branchId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  },

  async deleteBranch(branchId: string) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        users: true,
        barbermen: true,
        services: true,
        bookings: true,
      },
    });

    if (!branch) {
      throw new Error("Branch not found");
    }

    if (branch.users.length > 0) {
      throw new Error("Cannot delete branch with associated users");
    }

    if (branch.barbermen.length > 0) {
      throw new Error("Cannot delete branch with associated barbermen");
    }

    if (branch.services.length > 0) {
      throw new Error("Cannot delete branch with associated services");
    }

    if (branch.bookings.length > 0) {
      throw new Error("Cannot delete branch with associated bookings");
    }

    return prisma.branch.delete({
      where: { id: branchId },
    });
  },

  async deleteAdmin(adminId: string) {
    const admin = await userRepository.findAdminById(adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    return userRepository.deleteAdmin(adminId);
  },

  async deleteBarberman(barbermanId: string) {
    const barberman = await prisma.barberman.findUnique({
      where: { id: barbermanId },
      include: {
        bookings: true,
      },
    });

    if (!barberman) {
      throw new Error("Barberman not found");
    }

    if (barberman.bookings.length > 0) {
      throw new Error("Cannot delete barberman with existing bookings");
    }

    return prisma.barberman.delete({
      where: { id: barbermanId },
    });
  },

  async reports(branchId?: string, range?: string) {
    const [overview, monthlyRevenue] = await Promise.all([
      loadBranchSummaries(range),
      loadMonthlyRevenue(branchId),
    ]);

    return {
      summary: overview.summary,
      rangeKey: overview.rangeKey,
      rangeLabel: overview.rangeLabel,
      periodStart: overview.date,
      today: overview.branches,
      alerts: overview.alerts,
      monthlyRevenue,
    };
  },
};
