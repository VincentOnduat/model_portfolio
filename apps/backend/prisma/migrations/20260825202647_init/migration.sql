-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'ADVISER_MODEL_OWNER', 'ADVISER_STANDARD', 'THIRD_PARTY_MODEL_OWNER', 'THIRD_PARTY_STANDARD');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('DRAFT', 'LIVE');

-- CreateEnum
CREATE TYPE "ModelLockState" AS ENUM ('LOCKED', 'UNLOCKED');

-- CreateEnum
CREATE TYPE "ModelAim" AS ENUM ('BALANCE', 'GROWTH', 'BALANCED_AND_GROWTH', 'INCOME_AND_GROWTH', 'INCOME', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "ModelRisk" AS ENUM ('HIGH', 'LOW', 'LOW_MEDIUM', 'MEDIUM', 'MEDIUM_HIGH', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "AssetSector" AS ENUM ('EQUITY', 'BOND', 'WARRANT', 'FUND', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "SharingScope" AS ENUM ('FIRM', 'ENTERPRISE', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "SharingKind" AS ENUM ('DEFAULT', 'BESPOKE');

-- CreateEnum
CREATE TYPE "AllocationListType" AS ENUM ('MONEY_ALLOCATION', 'REBALANCE');

-- CreateEnum
CREATE TYPE "AllocationListStatus" AS ENUM ('CLIENT_ACCOUNTS_SELECTED', 'GENERATING_ORDERS', 'POTENTIAL_ORDERS_GENERATED', 'SENDING_ORDERS', 'ORDERS_SUBMITTED');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "ExclusionReason" AS ENUM ('ASSET_NOT_TRADEABLE', 'RESTRICTED_ASSET', 'NO_PRICE_AVAILABLE', 'BELOW_MINIMUM_TRADE_VALUE', 'ACCOUNT_NOT_ATTACHED_TO_MODEL', 'CLIENT_DOCUMENTATION_INCOMPLETE');

-- CreateEnum
CREATE TYPE "FailureReason" AS ENUM ('ASSET_CANNOT_BE_TRADED', 'NO_PURCHASE_ALLOWED', 'RESTRICTED_ASSET_CANNOT_SELL', 'NO_PRICE_FOR_ASSET', 'UNEXECUTED_OR_UNSETTLED_TRANSACTIONS', 'NO_HOLDING_OR_CASH_AVAILABLE', 'ACCOUNT_CLOSED', 'CLIENT_DOCUMENTATION_NOT_COMPLETE', 'DEAL_STATUS_DISABLED', 'ACCOUNT_WRAPPER_RESTRICTION', 'INCOMPLETE_SETUP', 'ASSET_NOT_FOUND', 'ASSET_START_DATE_IN_FUTURE', 'CHARGES_NOT_SET_UP', 'UNABLE_TO_GENERATE_ORDERS', 'ACCOUNT_NO_LONGER_ATTACHED_TO_MODEL', 'NO_ORDERS_GENERATED');

-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isThirdParty" BOOLEAN NOT NULL DEFAULT false,
    "parentFirmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "firmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sector" "AssetSector" NOT NULL,
    "isCash" BOOLEAN NOT NULL DEFAULT false,
    "lastPrice" DECIMAL(18,6),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'DRAFT',
    "lockState" "ModelLockState" NOT NULL DEFAULT 'UNLOCKED',
    "lockedByUserId" TEXT,
    "minimumTradeValue" DECIMAL(18,2) NOT NULL,
    "chargePercent" DECIMAL(5,2),
    "vatIncluded" BOOLEAN,
    "aim" "ModelAim" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "risk" "ModelRisk" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "ownerFirmId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelAsset" (
    "modelId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "percentAllocated" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "ModelAsset_pkey" PRIMARY KEY ("modelId","assetId")
);

-- CreateTable
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientNumber" TEXT NOT NULL,
    "adviserUserId" TEXT NOT NULL,
    "adviserFirmId" TEXT NOT NULL,
    "linkedModelId" TEXT,
    "dateLinked" TIMESTAMP(3),
    "availableCash" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cashAccountBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lastRebalanceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharingGrant" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "scope" "SharingScope" NOT NULL,
    "kind" "SharingKind" NOT NULL DEFAULT 'BESPOKE',
    "granteeUserId" TEXT,
    "granteeFirmId" TEXT,
    "canAttachAccounts" BOOLEAN NOT NULL DEFAULT false,
    "canAllocateMoney" BOOLEAN NOT NULL DEFAULT false,
    "canRebalance" BOOLEAN NOT NULL DEFAULT false,
    "canEditModel" BOOLEAN NOT NULL DEFAULT false,
    "allowOnwardShare" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharingGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationList" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AllocationListType" NOT NULL,
    "status" "AllocationListStatus" NOT NULL DEFAULT 'CLIENT_ACCOUNTS_SELECTED',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationListAccount" (
    "allocationListId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "allocateAll" BOOLEAN,
    "allocationAmount" DECIMAL(18,2),

    CONSTRAINT "AllocationListAccount_pkey" PRIMARY KEY ("allocationListId","accountId")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "allocationListId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "units" DECIMAL(18,6),
    "value" DECIMAL(18,2) NOT NULL,
    "lastPrice" DECIMAL(18,6),
    "belowMinTrade" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exclusion" (
    "id" TEXT NOT NULL,
    "allocationListId" TEXT NOT NULL,
    "accountId" TEXT,
    "assetId" TEXT,
    "reason" "ExclusionReason" NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Failure" (
    "id" TEXT NOT NULL,
    "allocationListId" TEXT NOT NULL,
    "accountId" TEXT,
    "assetId" TEXT,
    "reason" "FailureReason" NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Failure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Firm_parentFirmId_idx" ON "Firm"("parentFirmId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_firmId_idx" ON "User"("firmId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_isin_key" ON "Asset"("isin");

-- CreateIndex
CREATE INDEX "Asset_sector_idx" ON "Asset"("sector");

-- CreateIndex
CREATE UNIQUE INDEX "Model_reference_key" ON "Model"("reference");

-- CreateIndex
CREATE INDEX "Model_ownerFirmId_idx" ON "Model"("ownerFirmId");

-- CreateIndex
CREATE INDEX "Model_status_idx" ON "Model"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccount_accountNumber_key" ON "ClientAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "ClientAccount_linkedModelId_idx" ON "ClientAccount"("linkedModelId");

-- CreateIndex
CREATE INDEX "ClientAccount_adviserFirmId_idx" ON "ClientAccount"("adviserFirmId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_assetId_key" ON "Holding"("accountId", "assetId");

-- CreateIndex
CREATE INDEX "SharingGrant_modelId_idx" ON "SharingGrant"("modelId");

-- CreateIndex
CREATE INDEX "SharingGrant_granteeUserId_idx" ON "SharingGrant"("granteeUserId");

-- CreateIndex
CREATE INDEX "SharingGrant_granteeFirmId_idx" ON "SharingGrant"("granteeFirmId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationList_reference_key" ON "AllocationList"("reference");

-- CreateIndex
CREATE INDEX "AllocationList_status_idx" ON "AllocationList"("status");

-- CreateIndex
CREATE INDEX "AllocationList_type_idx" ON "AllocationList"("type");

-- CreateIndex
CREATE INDEX "OrderLine_allocationListId_idx" ON "OrderLine"("allocationListId");

-- CreateIndex
CREATE INDEX "OrderLine_accountId_idx" ON "OrderLine"("accountId");

-- CreateIndex
CREATE INDEX "Exclusion_allocationListId_idx" ON "Exclusion"("allocationListId");

-- CreateIndex
CREATE INDEX "Failure_allocationListId_idx" ON "Failure"("allocationListId");

-- AddForeignKey
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_parentFirmId_fkey" FOREIGN KEY ("parentFirmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_ownerFirmId_fkey" FOREIGN KEY ("ownerFirmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelAsset" ADD CONSTRAINT "ModelAsset_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelAsset" ADD CONSTRAINT "ModelAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_adviserUserId_fkey" FOREIGN KEY ("adviserUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_adviserFirmId_fkey" FOREIGN KEY ("adviserFirmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_linkedModelId_fkey" FOREIGN KEY ("linkedModelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingGrant" ADD CONSTRAINT "SharingGrant_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingGrant" ADD CONSTRAINT "SharingGrant_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingGrant" ADD CONSTRAINT "SharingGrant_granteeFirmId_fkey" FOREIGN KEY ("granteeFirmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationList" ADD CONSTRAINT "AllocationList_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationListAccount" ADD CONSTRAINT "AllocationListAccount_allocationListId_fkey" FOREIGN KEY ("allocationListId") REFERENCES "AllocationList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationListAccount" ADD CONSTRAINT "AllocationListAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationListAccount" ADD CONSTRAINT "AllocationListAccount_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_allocationListId_fkey" FOREIGN KEY ("allocationListId") REFERENCES "AllocationList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exclusion" ADD CONSTRAINT "Exclusion_allocationListId_fkey" FOREIGN KEY ("allocationListId") REFERENCES "AllocationList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exclusion" ADD CONSTRAINT "Exclusion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exclusion" ADD CONSTRAINT "Exclusion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_allocationListId_fkey" FOREIGN KEY ("allocationListId") REFERENCES "AllocationList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failure" ADD CONSTRAINT "Failure_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
