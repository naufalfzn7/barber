-- CreateTable
CREATE TABLE "GeneratedPassword" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedPassword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPassword_userId_key" ON "GeneratedPassword"("userId");

-- CreateIndex
CREATE INDEX "GeneratedPassword_createdById_idx" ON "GeneratedPassword"("createdById");

-- CreateIndex
CREATE INDEX "GeneratedPassword_updatedById_idx" ON "GeneratedPassword"("updatedById");

-- CreateIndex
CREATE INDEX "GeneratedPassword_updatedAt_idx" ON "GeneratedPassword"("updatedAt");

-- AddForeignKey
ALTER TABLE "GeneratedPassword" ADD CONSTRAINT "GeneratedPassword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPassword" ADD CONSTRAINT "GeneratedPassword_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPassword" ADD CONSTRAINT "GeneratedPassword_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
