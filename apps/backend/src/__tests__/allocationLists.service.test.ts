import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Role, AllocationListType } from '@model-portfolio/shared';
import { prisma } from '../lib/prisma.js';
import { confirmOrders, createAllocationList, generateOrders } from '../services/allocationLists.service.js';
import type { AuthTokenPayload } from '../lib/jwt.js';

// Exercises the Exclusions/Failures generation logic (guide 4.2.5/4.2.6)
// added to generateOrders - against a real Postgres instance (see
// vitest.config.ts), with a small, self-contained set of fixtures cleaned
// up afterwards so repeated local runs don't pollute the seeded demo data.

let firmId: string;
let userId: string;
let user: AuthTokenPayload;
let tradeableAssetId: string;
let notTradeableAssetId: string;
let restrictedAssetId: string;
let modelId: string;
let eligibleAccountId: string;
let noConsentAccountId: string;
let allOrdersExcludedModelId: string;
let rebalanceModelId: string;
let overweightRestrictedAccountId: string;
let detachDuringConfirmAccountId: string;

beforeAll(async () => {
  const firm = await prisma.firm.create({ data: { name: 'Test Firm - allocationLists.service.test' } });
  firmId = firm.id;

  const testUser = await prisma.user.create({
    data: {
      email: 'allocationlists-test@example.test',
      passwordHash: 'unused',
      displayName: 'Test User',
      role: Role.ADVISER_MODEL_OWNER,
      firmId,
    },
  });
  userId = testUser.id;
  user = { sub: userId, role: Role.ADVISER_MODEL_OWNER, firmId };

  const tradeableAsset = await prisma.asset.create({
    data: { name: 'Test Tradeable Fund', isin: 'TEST0000001', type: 'Fund', sector: 'EQUITY', lastPrice: 10 },
  });
  tradeableAssetId = tradeableAsset.id;

  const notTradeableAsset = await prisma.asset.create({
    data: {
      name: 'Test Suspended Fund',
      isin: 'TEST0000002',
      type: 'Fund',
      sector: 'EQUITY',
      lastPrice: 10,
      isTradeable: false,
    },
  });
  notTradeableAssetId = notTradeableAsset.id;

  const model = await prisma.model.create({
    data: {
      reference: 'TEST-EXCL-01',
      name: 'Test Exclusions Model',
      status: 'LIVE',
      minimumTradeValue: 10,
      ownerFirmId: firmId,
      ownerUserId: userId,
      createdByUserId: userId,
      updatedByUserId: userId,
      assets: {
        create: [
          { assetId: tradeableAssetId, percentAllocated: 50 },
          { assetId: notTradeableAssetId, percentAllocated: 50 },
        ],
      },
    },
  });
  modelId = model.id;

  const eligibleAccount = await prisma.clientAccount.create({
    data: {
      accountNumber: 'TEST-ACC-0001',
      accountName: 'Test Account',
      clientName: 'Test Client',
      clientNumber: 'TEST-CL-0001',
      adviserUserId: userId,
      adviserFirmId: firmId,
      linkedModelId: modelId,
      availableCash: 1000,
    },
  });
  eligibleAccountId = eligibleAccount.id;

  const noConsentAccount = await prisma.clientAccount.create({
    data: {
      accountNumber: 'TEST-ACC-0002',
      accountName: 'Test No-Consent Account',
      clientName: 'Test Client 2',
      clientNumber: 'TEST-CL-0002',
      adviserUserId: userId,
      adviserFirmId: firmId,
      linkedModelId: modelId,
      availableCash: 1000,
      hasConsent: false,
    },
  });
  noConsentAccountId = noConsentAccount.id;

  const allExcludedModel = await prisma.model.create({
    data: {
      reference: 'TEST-EXCL-02',
      name: 'Test All-Excluded Model',
      status: 'LIVE',
      minimumTradeValue: 10,
      ownerFirmId: firmId,
      ownerUserId: userId,
      createdByUserId: userId,
      updatedByUserId: userId,
      assets: { create: [{ assetId: notTradeableAssetId, percentAllocated: 100 }] },
    },
  });
  allOrdersExcludedModelId = allExcludedModel.id;

  const restrictedAsset = await prisma.asset.create({
    data: {
      name: 'Test Restricted Fund',
      isin: 'TEST0000003',
      type: 'Fund',
      sector: 'EQUITY',
      lastPrice: 20,
      isRestricted: true,
    },
  });
  restrictedAssetId = restrictedAsset.id;

  const rebalanceModel = await prisma.model.create({
    data: {
      reference: 'TEST-EXCL-03',
      name: 'Test Rebalance Restricted Model',
      status: 'LIVE',
      minimumTradeValue: 10,
      ownerFirmId: firmId,
      ownerUserId: userId,
      createdByUserId: userId,
      updatedByUserId: userId,
      assets: {
        create: [
          { assetId: tradeableAssetId, percentAllocated: 50 },
          { assetId: restrictedAssetId, percentAllocated: 50 },
        ],
      },
    },
  });
  rebalanceModelId = rebalanceModel.id;

  const overweightRestrictedAccount = await prisma.clientAccount.create({
    data: {
      accountNumber: 'TEST-ACC-0003',
      accountName: 'Test Overweight-Restricted Account',
      clientName: 'Test Client 3',
      clientNumber: 'TEST-CL-0003',
      adviserUserId: userId,
      adviserFirmId: firmId,
      linkedModelId: rebalanceModelId,
      // Holds only the restricted asset (target 50%), so Rebalance must SELL
      // it down - which should fail rather than silently execute. Also holds
      // a zero quantity of the tradeable asset purely so the engine sees a
      // price for it (calculateRebalance only receives a price for assets
      // present in the account's holdings, even at zero quantity) and raises
      // the corresponding BUY leg instead of treating it as priceless.
      holdings: {
        create: [
          { assetId: restrictedAssetId, quantity: 100 },
          { assetId: tradeableAssetId, quantity: 0 },
        ],
      },
    },
  });
  overweightRestrictedAccountId = overweightRestrictedAccount.id;

  const detachDuringConfirmAccount = await prisma.clientAccount.create({
    data: {
      accountNumber: 'TEST-ACC-0004',
      accountName: 'Test Detach-During-Confirm Account',
      clientName: 'Test Client 4',
      clientNumber: 'TEST-CL-0004',
      adviserUserId: userId,
      adviserFirmId: firmId,
      linkedModelId: modelId,
      availableCash: 500,
    },
  });
  detachDuringConfirmAccountId = detachDuringConfirmAccount.id;
});

afterAll(async () => {
  await prisma.orderLine.deleteMany({ where: { account: { adviserFirmId: firmId } } });
  await prisma.exclusion.deleteMany({ where: { account: { adviserFirmId: firmId } } });
  await prisma.failure.deleteMany({ where: { account: { adviserFirmId: firmId } } });
  await prisma.allocationListAccount.deleteMany({ where: { account: { adviserFirmId: firmId } } });
  await prisma.allocationList.deleteMany({ where: { createdByUserId: userId } });
  await prisma.holding.deleteMany({ where: { account: { adviserFirmId: firmId } } });
  await prisma.clientAccount.deleteMany({ where: { adviserFirmId: firmId } });
  await prisma.modelAsset.deleteMany({
    where: { modelId: { in: [modelId, allOrdersExcludedModelId, rebalanceModelId] } },
  });
  await prisma.model.deleteMany({ where: { ownerFirmId: firmId } });
  await prisma.asset.deleteMany({ where: { id: { in: [tradeableAssetId, notTradeableAssetId, restrictedAssetId] } } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.firm.delete({ where: { id: firmId } });
});

describe('generateOrders - Exclusions/Failures (guide 4.2.5/4.2.6)', () => {
  it('excludes a non-tradeable asset but still generates orders for the tradeable one', async () => {
    const list = await createAllocationList(user, {
      type: AllocationListType.MONEY_ALLOCATION,
      name: 'Test list - not tradeable',
      accounts: [{ accountId: eligibleAccountId, allocateAll: true }],
    });

    const result = await generateOrders(user, list.id);

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].assetId).toBe(tradeableAssetId);

    expect(result.exclusions).toHaveLength(1);
    expect(result.exclusions[0].reason).toBe('ASSET_NOT_TRADEABLE');
    expect(result.exclusions[0].assetId).toBe(notTradeableAssetId);
  });

  it('excludes an entire account with no client consent', async () => {
    const list = await createAllocationList(user, {
      type: AllocationListType.MONEY_ALLOCATION,
      name: 'Test list - no consent',
      accounts: [{ accountId: noConsentAccountId, allocateAll: true }],
    });

    const result = await generateOrders(user, list.id);

    expect(result.orders.filter((o) => o.accountId === noConsentAccountId)).toHaveLength(0);
    expect(result.exclusions.some((e) => e.reason === 'CLIENT_DOCUMENTATION_INCOMPLETE')).toBe(true);
  });

  it('records a NO_ORDERS_GENERATED failure (and still succeeds) when every asset is excluded', async () => {
    // Re-link the eligible account to the all-excluded model for this one list.
    await prisma.clientAccount.update({
      where: { id: eligibleAccountId },
      data: { linkedModelId: allOrdersExcludedModelId },
    });

    const list = await createAllocationList(user, {
      type: AllocationListType.MONEY_ALLOCATION,
      name: 'Test list - all excluded',
      accounts: [{ accountId: eligibleAccountId, allocateAll: true }],
    });

    const result = await generateOrders(user, list.id);

    expect(result.orders).toHaveLength(0);
    expect(result.failures.some((f) => f.reason === 'NO_ORDERS_GENERATED')).toBe(true);

    // Restore for any later test in this file that might rely on the original link.
    await prisma.clientAccount.update({ where: { id: eligibleAccountId }, data: { linkedModelId: modelId } });
  });

  it('fails a Rebalance sell order on a restricted asset instead of executing it', async () => {
    const list = await createAllocationList(user, {
      type: AllocationListType.REBALANCE,
      name: 'Test list - restricted sell',
      accounts: [{ accountId: overweightRestrictedAccountId }],
    });

    const result = await generateOrders(user, list.id);

    expect(result.orders.some((o) => o.assetId === restrictedAssetId)).toBe(false);
    const failure = result.failures.find((f) => f.reason === 'RESTRICTED_ASSET_CANNOT_SELL');
    expect(failure).toBeDefined();
    expect(failure?.assetId).toBe(restrictedAssetId);
  });

  it('fails a Rebalance buy order when the model has no charge percent configured', async () => {
    // rebalanceModelId's fixture never sets chargePercent, so its BUY leg
    // (funded by selling down the overweight restricted holding) should be
    // recorded as a Failure rather than an order line.
    const list = await createAllocationList(user, {
      type: AllocationListType.REBALANCE,
      name: 'Test list - charges not set up',
      accounts: [{ accountId: overweightRestrictedAccountId }],
    });

    const result = await generateOrders(user, list.id);

    expect(result.orders.some((o) => o.assetId === tradeableAssetId)).toBe(false);
    const failure = result.failures.find((f) => f.reason === 'CHARGES_NOT_SET_UP');
    expect(failure).toBeDefined();
    expect(failure?.assetId).toBe(tradeableAssetId);
  });

  it('excludes stale order lines and records ACCOUNT_NO_LONGER_ATTACHED_TO_MODEL if an account is detached before confirmation', async () => {
    const list = await createAllocationList(user, {
      type: AllocationListType.MONEY_ALLOCATION,
      name: 'Test list - detached before confirm',
      accounts: [{ accountId: detachDuringConfirmAccountId, allocateAll: true }],
    });

    const generated = await generateOrders(user, list.id);
    expect(generated.orders.length).toBeGreaterThan(0);
    expect(generated.status).toBe('POTENTIAL_ORDERS_GENERATED');

    await prisma.clientAccount.update({
      where: { id: detachDuringConfirmAccountId },
      data: { linkedModelId: null },
    });

    const confirmed = await confirmOrders(user, list.id);

    expect(confirmed.status).toBe('ORDERS_SUBMITTED');
    expect(confirmed.orders.some((o) => o.accountId === detachDuringConfirmAccountId)).toBe(false);
    const failure = confirmed.failures.find((f) => f.reason === 'ACCOUNT_NO_LONGER_ATTACHED_TO_MODEL');
    expect(failure).toBeDefined();
    expect(failure?.accountId).toBe(detachDuringConfirmAccountId);
  });
});
