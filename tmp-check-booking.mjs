import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const booking = await prisma.booking.findFirst({
  where: { code: 'BKG-1775376096830-453885' },
  include: { payment: true },
});

console.log(JSON.stringify({
  code: booking?.code,
  bookingStatus: booking?.status,
  paymentStatus: booking?.payment?.status,
  isDeposit: booking?.payment?.isDeposit,
  amountPaid: booking?.payment?.amountPaid?.toString?.() ?? null,
}, null, 2));

await prisma.$disconnect();
await pool.end();
