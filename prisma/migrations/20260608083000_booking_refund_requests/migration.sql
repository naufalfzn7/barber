-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "BookingRefundRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "contactPhone" TEXT,
    "refundMethod" "PaymentMethod",
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "adminNote" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingRefundRequest_bookingId_key" ON "BookingRefundRequest"("bookingId");

-- CreateIndex
CREATE INDEX "BookingRefundRequest_branchId_status_requestedAt_idx" ON "BookingRefundRequest"("branchId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "BookingRefundRequest_memberId_requestedAt_idx" ON "BookingRefundRequest"("memberId", "requestedAt");

-- CreateIndex
CREATE INDEX "BookingRefundRequest_reviewedById_idx" ON "BookingRefundRequest"("reviewedById");

-- AddForeignKey
ALTER TABLE "BookingRefundRequest" ADD CONSTRAINT "BookingRefundRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRefundRequest" ADD CONSTRAINT "BookingRefundRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRefundRequest" ADD CONSTRAINT "BookingRefundRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRefundRequest" ADD CONSTRAINT "BookingRefundRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
