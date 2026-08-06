-- CreateEnum
CREATE TYPE "MachineOwnership" AS ENUM ('OWNED', 'RENTED');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'IDLE', 'UNDER_MAINTENANCE', 'OFFSITE');

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "ownership" "MachineOwnership" NOT NULL DEFAULT 'OWNED',
    "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerLabel" TEXT,
    "registration" TEXT,
    "dailyRate" DECIMAL(12,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Machine_siteId_isActive_idx" ON "Machine"("siteId", "isActive");

-- CreateIndex
CREATE INDEX "Machine_ownership_status_idx" ON "Machine"("ownership", "status");

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
