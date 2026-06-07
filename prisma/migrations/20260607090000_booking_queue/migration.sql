-- CreateEnum
CREATE TYPE "BookingQueueStatus" AS ENUM ('WAITING', 'CALLED', 'SERVING', 'DONE', 'MISSED');

-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "queueDate" TIMESTAMP(3),
ADD COLUMN "queueNumber" INTEGER,
ADD COLUMN "queueStatus" "BookingQueueStatus",
ADD COLUMN "queueAssignedAt" TIMESTAMP(3),
ADD COLUMN "queueCalledAt" TIMESTAMP(3),
ADD COLUMN "queueNoShowAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_branchId_queueDate_queueStatus_scheduledStart_idx" ON "Booking"("branchId", "queueDate", "queueStatus", "scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_branchId_queueDate_queueNumber_key" ON "Booking"("branchId", "queueDate", "queueNumber");
