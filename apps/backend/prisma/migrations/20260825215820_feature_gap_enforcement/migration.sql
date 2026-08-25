-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ISA', 'GIA', 'SIPP', 'OTHER');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "isRestricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTradeable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ClientAccount" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "hasConsent" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "eligibleAccountTypes" "AccountType"[] DEFAULT ARRAY[]::"AccountType"[];

-- CreateTable
CREATE TABLE "FirmContract" (
    "id" TEXT NOT NULL,
    "ownerFirmId" TEXT NOT NULL,
    "thirdPartyFirmId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmContract_ownerFirmId_thirdPartyFirmId_key" ON "FirmContract"("ownerFirmId", "thirdPartyFirmId");

-- AddForeignKey
ALTER TABLE "FirmContract" ADD CONSTRAINT "FirmContract_ownerFirmId_fkey" FOREIGN KEY ("ownerFirmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmContract" ADD CONSTRAINT "FirmContract_thirdPartyFirmId_fkey" FOREIGN KEY ("thirdPartyFirmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
