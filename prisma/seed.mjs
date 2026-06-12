import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL in environment for seeding.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  const defaultPasswordHash = await bcrypt.hash("Monarch123!", 10);

  const branch = await prisma.branch.upsert({
    where: { code: "SKA" },
    update: {},
    create: {
      code: "SKA",
      name: "Monarch Barber Surakarta",
      timezone: "Asia/Jakarta",
      isActive: true,
    },
  });

  const superAdminUser = await prisma.user.upsert({
    where: { email: "owner@monarchbarber.id" },
    update: {
      passwordHash: defaultPasswordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      mustChangePassword: true,
    },
    create: {
      email: "owner@monarchbarber.id",
      passwordHash: defaultPasswordHash,
      fullName: "Monarch Owner",
      role: "SUPER_ADMIN",
      isActive: true,
      mustChangePassword: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin.ska@monarchbarber.id" },
    update: {
      branchId: branch.id,
      passwordHash: defaultPasswordHash,
      role: "ADMIN",
      isActive: true,
      mustChangePassword: true,
    },
    create: {
      email: "admin.ska@monarchbarber.id",
      passwordHash: defaultPasswordHash,
      fullName: "Admin Surakarta",
      role: "ADMIN",
      isActive: true,
      mustChangePassword: true,
      branchId: branch.id,
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { email: "member.demo@monarchbarber.id" },
    update: {
      passwordHash: defaultPasswordHash,
      role: "MEMBER",
      isActive: true,
      mustChangePassword: true,
    },
    create: {
      email: "member.demo@monarchbarber.id",
      passwordHash: defaultPasswordHash,
      fullName: "Member Demo",
      role: "MEMBER",
      isActive: true,
      mustChangePassword: true,
    },
  });

  await prisma.adminProfile.upsert({
    where: { userId: superAdminUser.id },
    update: {},
    create: {
      userId: superAdminUser.id,
      jobTitle: "Owner",
    },
  });

  await prisma.adminProfile.upsert({
    where: { userId: adminUser.id },
    update: { branchId: branch.id },
    create: {
      userId: adminUser.id,
      branchId: branch.id,
      jobTitle: "Cashier Admin",
    },
  });

  await prisma.memberProfile.upsert({
    where: { userId: memberUser.id },
    update: { defaultBranchId: branch.id },
    create: {
      userId: memberUser.id,
      memberCode: "MBR-0001",
      defaultBranchId: branch.id,
    },
  });

  const barberman = await prisma.barberman.upsert({
    where: {
      branchId_code: {
        branchId: branch.id,
        code: "BRB-ANDI",
      },
    },
    update: {},
    create: {
      branchId: branch.id,
      code: "BRB-ANDI",
      name: "Andi Pratama",
      phoneNumber: "081200000001",
      defaultDuration: 60,
      isActive: true,
    },
  });

  const service = await prisma.service.upsert({
    where: {
      branchId_code: {
        branchId: branch.id,
        code: "SRV-SIGNATURE-CUT",
      },
    },
    update: {},
    create: {
      branchId: branch.id,
      code: "SRV-SIGNATURE-CUT",
      name: "Signature Cut",
      price: "65000",
      durationMinutes: 45,
      bufferMinutes: 10,
      isActive: true,
    },
  });

  await prisma.inventoryItem.upsert({
    where: {
      branchId_sku: {
        branchId: branch.id,
        sku: "SKA-PRD-STRONG-POMADE-100",
      },
    },
    update: {},
    create: {
      branchId: branch.id,
      sku: "SKA-PRD-STRONG-POMADE-100",
      name: "Monarch Strong Pomade 100gr",
      sellingPrice: "95000",
      stockQty: 28,
      minStockQty: 8,
      isActive: true,
    },
  });

  const weekdays = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];

  await Promise.all(
    weekdays.map((dayOfWeek) =>
      prisma.operatingHour.upsert({
        where: {
          branchId_dayOfWeek: {
            branchId: branch.id,
            dayOfWeek,
          },
        },
        update: {},
        create: {
          branchId: branch.id,
          dayOfWeek,
          openTime: "09:00",
          closeTime: "21:00",
          isClosed: false,
        },
      }),
    ),
  );

  await prisma.operatingHour.upsert({
    where: {
      branchId_dayOfWeek: {
        branchId: branch.id,
        dayOfWeek: "SUNDAY",
      },
    },
    update: {},
    create: {
      branchId: branch.id,
      dayOfWeek: "SUNDAY",
      openTime: "09:00",
      closeTime: "17:00",
      isClosed: false,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.barberSchedule.upsert({
    where: {
      barbermanId_date_startTime: {
        barbermanId: barberman.id,
        date: today,
        startTime: "09:00",
      },
    },
    update: {},
    create: {
      branchId: branch.id,
      barbermanId: barberman.id,
      date: today,
      startTime: "09:00",
      endTime: "18:00",
      isDayOff: false,
    },
  });

  const bookingStart = new Date();
  bookingStart.setDate(bookingStart.getDate() + 1);
  bookingStart.setHours(10, 0, 0, 0);

  const bookingEnd = new Date(bookingStart);
  bookingEnd.setHours(11, 10, 0, 0);

  const booking = await prisma.booking.upsert({
    where: { code: "BKG-DEMO-0001" },
    update: {},
    create: {
      code: "BKG-DEMO-0001",
      branchId: branch.id,
      memberId: memberUser.id,
      createdById: adminUser.id,
      barbermanId: barberman.id,
      serviceId: service.id,
      status: "UPCOMING",
      scheduledStart: bookingStart,
      scheduledEnd: bookingEnd,
      notes: "Seed booking for integration testing",
      isWalkIn: false,
    },
  });

  await prisma.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      oldStatus: null,
      newStatus: "UPCOMING",
      changedById: adminUser.id,
      reason: "Initial seeded state",
    },
  });

  await prisma.payment.upsert({
    where: { bookingId: booking.id },
    update: {},
    create: {
      bookingId: booking.id,
      method: "QRIS",
      status: "PENDING",
      amountDue: "65000",
      processedById: adminUser.id,
    },
  });

  await prisma.revenueDaily.upsert({
    where: {
      branchId_date: {
        branchId: branch.id,
        date: today,
      },
    },
    update: {},
    create: {
      branchId: branch.id,
      date: today,
      totalRevenue: "0",
      cashRevenue: "0",
      qrisRevenue: "0",
      totalBookings: 1,
      completedBookings: 0,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    console.log("Seed completed successfully.");
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
