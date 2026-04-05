ALTER TABLE "Payment"
ADD COLUMN "qrisString" TEXT,
ADD COLUMN "qrisImageUrl" TEXT,
ADD COLUMN "qrisExpiresAt" TIMESTAMP(3);
