import {
  AllocationListStatus,
  AllocationListType,
  calculateMoneyAllocation,
  calculateRebalance,
  type ExclusionReason,
  type FailureReason,
} from '@model-portfolio/shared';
import { prisma } from '../lib/prisma.js';
import { ApiException } from '../middleware/errorHandler.js';
import type { AuthTokenPayload } from '../lib/jwt.js';

const detailInclude = {
  accounts: { include: { account: true, model: true } },
  orderLines: { include: { asset: true, account: true } },
  exclusions: true,
  failures: true,
} as const;

export function serializeAllocationList(
  list: Awaited<ReturnType<typeof getAllocationListOrThrow>>,
) {
  return {
    id: list.id,
    reference: list.reference,
    name: list.name,
    type: list.type,
    status: list.status,
    createdByUserId: list.createdByUserId,
    createdAt: list.createdAt.toISOString(),
    accounts: list.accounts.map((a) => ({
      accountId: a.accountId,
      modelId: a.modelId,
      accountNumber: a.account.accountNumber,
      accountName: a.account.accountName,
      clientName: a.account.clientName,
      modelName: a.model.name,
      allocateAll: a.allocateAll,
      allocationAmount: a.allocationAmount == null ? null : Number(a.allocationAmount),
    })),
    orders: list.orderLines.map((o) => ({
      id: o.id,
      accountId: o.accountId,
      accountName: o.account.accountName,
      assetId: o.assetId,
      assetName: o.asset.name,
      isin: o.asset.isin,
      side: o.side,
      units: o.units == null ? null : Number(o.units),
      value: Number(o.value),
      lastPrice: o.lastPrice == null ? null : Number(o.lastPrice),
      belowMinTrade: o.belowMinTrade,
    })),
    exclusions: list.exclusions,
    failures: list.failures,
    totals: {
      totalAccounts: new Set(list.orderLines.map((o) => o.accountId)).size,
      totalBuyOrders: list.orderLines.filter((o) => o.side === 'BUY').length,
      totalBuyOrdersValue: list.orderLines
        .filter((o) => o.side === 'BUY')
        .reduce((s, o) => s + Number(o.value), 0),
      totalSellOrders: list.orderLines.filter((o) => o.side === 'SELL').length,
      totalSellOrdersValue: list.orderLines
        .filter((o) => o.side === 'SELL')
        .reduce((s, o) => s + Number(o.value), 0),
    },
  };
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listAllocationLists(filters: {
  type?: AllocationListType;
  status?: AllocationListStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const where = { type: filters.type, status: filters.status };

  const [lists, total] = await Promise.all([
    prisma.allocationList.findMany({
      where,
      include: {
        _count: { select: { accounts: true, exclusions: true, failures: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.allocationList.count({ where }),
  ]);

  return {
    items: lists.map((l) => ({
      id: l.id,
      reference: l.reference,
      name: l.name,
      type: l.type,
      status: l.status,
      createdByUserId: l.createdByUserId,
      createdAt: l.createdAt.toISOString(),
      accountCount: l._count.accounts,
      hasExclusions: l._count.exclusions > 0,
      hasFailures: l._count.failures > 0,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getAllocationListOrThrow(id: string) {
  const list = await prisma.allocationList.findUnique({ where: { id }, include: detailInclude });
  if (!list) {
    throw new ApiException(404, 'ALLOCATION_LIST_NOT_FOUND', `No allocation list with id ${id}.`);
  }
  return list;
}

export interface CreateAllocationListInput {
  type: AllocationListType;
  name: string;
  accounts: { accountId: string; allocateAll?: boolean; allocationAmount?: number }[];
}

/** Guide 4.2.2/4.2.3/4.2.4 Step 1: Select Accounts. */
export async function createAllocationList(user: AuthTokenPayload, input: CreateAllocationListInput) {
  const accounts = await prisma.clientAccount.findMany({
    where: { id: { in: input.accounts.map((a) => a.accountId) } },
  });

  const missingModel = accounts.find((a) => !a.linkedModelId);
  if (missingModel) {
    throw new ApiException(
      422,
      'ACCOUNT_NOT_LINKED',
      `Account ${missingModel.accountNumber} is not attached to any model.`,
    );
  }

  const reference = `AL-${Date.now()}`;
  const list = await prisma.allocationList.create({
    data: {
      reference,
      name: input.name,
      type: input.type,
      status: AllocationListStatus.CLIENT_ACCOUNTS_SELECTED,
      createdByUserId: user.sub,
      accounts: {
        create: input.accounts.map((a) => {
          const account = accounts.find((acc) => acc.id === a.accountId)!;
          return {
            accountId: a.accountId,
            modelId: account.linkedModelId!,
            allocateAll: input.type === AllocationListType.MONEY_ALLOCATION ? a.allocateAll ?? false : null,
            allocationAmount:
              input.type === AllocationListType.MONEY_ALLOCATION ? a.allocationAmount ?? null : null,
          };
        }),
      },
    },
    include: detailInclude,
  });

  return serializeAllocationList(list);
}

interface OrderLineDraft {
  accountId: string;
  assetId: string;
  side: 'BUY' | 'SELL';
  units: number | null;
  value: number;
  lastPrice: number | null;
  belowMinTrade: boolean;
}

interface ExclusionDraft {
  accountId?: string;
  assetId?: string;
  reason: ExclusionReason;
  detail: string;
}

interface FailureDraft {
  accountId?: string;
  assetId?: string;
  reason: FailureReason;
  detail: string;
}

/**
 * Guide 4.2.3/4.2.4 Step 2: Generate Orders. Runs the pure calculation
 * engines from packages/shared against each account's model allocation
 * (and, for Rebalance, its current Holdings), then persists OrderLine rows.
 * Orders below the model's minimum trade value are kept (flagged
 * belowMinTrade) rather than dropped, per guide: "it is listed on the
 * detailed confirmation list but will not be placed or executed."
 *
 * Guide 4.2.5/4.2.6 Exclusions/Failures: this implements the subset of the
 * ~20 named reasons that's grounded in data this schema actually has (an
 * account's consent/attachment, an asset's price/tradeable/restricted
 * flags) - see docs/domain-model.md for which reasons are covered and
 * which remain stubbed pending real specs for the rest (CREST status,
 * deal-status workflows, charges setup, etc.). Money Allocation only ever
 * produces BUY orders, so its asset-level issues are recorded as
 * Exclusions (packages/shared's buy-oriented ExclusionReason values);
 * Rebalance produces both BUY and SELL, so its asset-level issues use the
 * richer, dealing-oriented FailureReason values instead.
 */
export async function generateOrders(user: AuthTokenPayload, listId: string) {
  const list = await getAllocationListOrThrow(listId);
  if (list.status !== AllocationListStatus.CLIENT_ACCOUNTS_SELECTED) {
    throw new ApiException(409, 'INVALID_STATUS', 'Orders have already been generated for this list.');
  }
  if (list.accounts.length === 0) {
    throw new ApiException(422, 'NO_ACCOUNTS', 'Attach at least one client account before generating orders.');
  }

  const orderLinesToCreate: OrderLineDraft[] = [];
  const exclusionsToCreate: ExclusionDraft[] = [];
  const failuresToCreate: FailureDraft[] = [];

  // Batch-fetch every distinct Model and every account's Holdings up front
  // instead of per-account inside the loop below - the loop used to issue
  // one Model query and one Holding query per account (an N+1 pattern),
  // which serialises badly as a list's account count grows.
  const modelIds = [...new Set(list.accounts.map((la) => la.modelId))];
  const models = await prisma.model.findMany({
    where: { id: { in: modelIds } },
    include: { assets: { include: { asset: true } } },
  });
  const modelsById = new Map(models.map((m) => [m.id, m]));

  const accountIds = list.accounts.map((la) => la.accountId);
  const allHoldings = await prisma.holding.findMany({ where: { accountId: { in: accountIds } } });
  const holdingsByAccountId = new Map<string, typeof allHoldings>();
  for (const h of allHoldings) {
    const bucket = holdingsByAccountId.get(h.accountId);
    if (bucket) bucket.push(h);
    else holdingsByAccountId.set(h.accountId, [h]);
  }

  for (const listAccount of list.accounts) {
    // Re-check account-level eligibility at generation time - the account
    // could have been detached from its model, or had consent withdrawn,
    // since it was added to this list.
    if (listAccount.account.linkedModelId !== listAccount.modelId) {
      exclusionsToCreate.push({
        accountId: listAccount.accountId,
        reason: 'ACCOUNT_NOT_ATTACHED_TO_MODEL',
        detail: `Account ${listAccount.account.accountNumber} is no longer attached to this model.`,
      });
      continue;
    }
    if (!listAccount.account.hasConsent) {
      exclusionsToCreate.push({
        accountId: listAccount.accountId,
        reason: 'CLIENT_DOCUMENTATION_INCOMPLETE',
        detail: `Account ${listAccount.account.accountNumber}'s client has not given consent.`,
      });
      continue;
    }

    const model = modelsById.get(listAccount.modelId);
    if (!model) continue;
    const minTrade = Number(model.minimumTradeValue);

    if (list.type === AllocationListType.MONEY_ALLOCATION) {
      const investAmount = listAccount.allocateAll
        ? Number(listAccount.account.availableCash)
        : Number(listAccount.allocationAmount ?? 0);

      const orders = calculateMoneyAllocation({
        investAmount,
        modelAllocations: model.assets.map((ma) => ({
          assetId: ma.assetId,
          percentAllocated: Number(ma.percentAllocated),
          isCash: ma.asset.isCash,
        })),
      });

      for (const o of orders) {
        const asset = model.assets.find((ma) => ma.assetId === o.assetId)!.asset;
        if (!asset.isTradeable) {
          exclusionsToCreate.push({
            accountId: listAccount.accountId,
            assetId: asset.id,
            reason: 'ASSET_NOT_TRADEABLE',
            detail: `${asset.name} is not currently tradeable.`,
          });
          continue;
        }
        if (asset.isRestricted) {
          exclusionsToCreate.push({
            accountId: listAccount.accountId,
            assetId: asset.id,
            reason: 'RESTRICTED_ASSET',
            detail: `${asset.name} is a restricted asset and cannot be bought.`,
          });
          continue;
        }
        const price = asset.lastPrice == null ? null : Number(asset.lastPrice);
        if (price == null && !asset.isCash) {
          exclusionsToCreate.push({
            accountId: listAccount.accountId,
            assetId: asset.id,
            reason: 'NO_PRICE_AVAILABLE',
            detail: `No price is available for ${asset.name}.`,
          });
          continue;
        }
        orderLinesToCreate.push({
          accountId: listAccount.accountId,
          assetId: o.assetId,
          side: 'BUY',
          value: o.value,
          units: price ? o.value / price : null,
          lastPrice: price,
          belowMinTrade: o.value < minTrade,
        });
      }
    } else {
      const holdings = holdingsByAccountId.get(listAccount.accountId) ?? [];
      const result = calculateRebalance({
        minimumTradeValue: minTrade,
        holdings: [
          { assetId: 'cash', quantity: Number(listAccount.account.cashAccountBalance), price: null, isCash: true },
          ...holdings.map((h) => {
            const asset = model.assets.find((ma) => ma.assetId === h.assetId)?.asset;
            return {
              assetId: h.assetId,
              quantity: Number(h.quantity),
              price: asset?.lastPrice == null ? null : Number(asset.lastPrice),
            };
          }),
        ],
        modelAllocations: model.assets.map((ma) => ({
          assetId: ma.assetId,
          percentAllocated: Number(ma.percentAllocated),
        })),
      });

      for (const o of result.orders) {
        const asset = model.assets.find((ma) => ma.assetId === o.assetId)?.asset;
        const price = asset?.lastPrice == null ? null : Number(asset.lastPrice);
        if (asset?.isRestricted && o.side === 'SELL') {
          failuresToCreate.push({
            accountId: listAccount.accountId,
            assetId: o.assetId,
            reason: 'RESTRICTED_ASSET_CANNOT_SELL',
            detail: `${asset.name} is restricted and cannot be sold.`,
          });
          continue;
        }
        if (o.side === 'BUY' && model.chargePercent == null) {
          failuresToCreate.push({
            accountId: listAccount.accountId,
            assetId: o.assetId,
            reason: 'CHARGES_NOT_SET_UP',
            detail: `${model.name} has no charge percent configured, so purchases cannot be dealt.`,
          });
          continue;
        }
        if (price == null && !asset?.isCash) {
          failuresToCreate.push({
            accountId: listAccount.accountId,
            assetId: o.assetId,
            reason: 'NO_PRICE_FOR_ASSET',
            detail: `No price is available for ${asset?.name ?? o.assetId}.`,
          });
          continue;
        }
        orderLinesToCreate.push({
          accountId: listAccount.accountId,
          assetId: o.assetId,
          side: o.side,
          value: o.value,
          units: o.units,
          lastPrice: price,
          belowMinTrade: o.value < minTrade,
        });
      }
    }
  }

  if (orderLinesToCreate.length === 0) {
    failuresToCreate.push({
      reason: 'NO_ORDERS_GENERATED',
      detail: 'No orders were generated - accounts may already match their model allocation, or were excluded (see Exclusions/Failures above).',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderLine.deleteMany({ where: { allocationListId: listId } });
    await tx.exclusion.deleteMany({ where: { allocationListId: listId } });
    await tx.failure.deleteMany({ where: { allocationListId: listId } });
    if (orderLinesToCreate.length > 0) {
      await tx.orderLine.createMany({
        data: orderLinesToCreate.map((o) => ({ allocationListId: listId, ...o })),
      });
    }
    if (exclusionsToCreate.length > 0) {
      await tx.exclusion.createMany({
        data: exclusionsToCreate.map((e) => ({ allocationListId: listId, ...e })),
      });
    }
    if (failuresToCreate.length > 0) {
      await tx.failure.createMany({
        data: failuresToCreate.map((f) => ({ allocationListId: listId, ...f })),
      });
    }
    await tx.allocationList.update({
      where: { id: listId },
      data: {
        status:
          orderLinesToCreate.length > 0
            ? AllocationListStatus.POTENTIAL_ORDERS_GENERATED
            : AllocationListStatus.CLIENT_ACCOUNTS_SELECTED,
      },
    });
  });

  return serializeAllocationList(await getAllocationListOrThrow(listId));
}

/** Guide Step 2 -> Step 3: "Confirm Orders" button. */
export async function confirmOrders(_user: AuthTokenPayload, listId: string) {
  const list = await getAllocationListOrThrow(listId);
  if (list.status !== AllocationListStatus.POTENTIAL_ORDERS_GENERATED) {
    throw new ApiException(409, 'INVALID_STATUS', 'Orders must be generated before they can be confirmed.');
  }

  // Guide 4.2.6: an account could have been detached from its model between
  // Step 2 (Generate Orders) and Step 3 (Confirm) - exclude its order lines
  // rather than confirm stale orders against a model it's no longer attached
  // to, and record why.
  const staleAccounts = list.accounts.filter((la) => la.account.linkedModelId !== la.modelId);
  if (staleAccounts.length > 0) {
    const staleAccountIds = new Set(staleAccounts.map((la) => la.accountId));
    const staleOrderLineIds = list.orderLines
      .filter((o) => staleAccountIds.has(o.accountId))
      .map((o) => o.id);

    await prisma.$transaction(async (tx) => {
      if (staleOrderLineIds.length > 0) {
        await tx.orderLine.deleteMany({ where: { id: { in: staleOrderLineIds } } });
      }
      await tx.failure.createMany({
        data: staleAccounts.map((la) => ({
          allocationListId: listId,
          accountId: la.accountId,
          reason: 'ACCOUNT_NO_LONGER_ATTACHED_TO_MODEL',
          detail: `Account ${la.account.accountNumber} is no longer attached to this model and was excluded before confirmation.`,
        })),
      });
    });
  }

  // A real system would hand orderLines off to a downstream dealing/trading
  // system here and await execution results before marking ORDERS_SUBMITTED.
  const updated = await prisma.allocationList.update({
    where: { id: listId },
    data: { status: AllocationListStatus.ORDERS_SUBMITTED },
    include: detailInclude,
  });
  return serializeAllocationList(updated);
}

export async function removeOrderLines(_user: AuthTokenPayload, listId: string, orderLineIds: string[]) {
  const list = await getAllocationListOrThrow(listId);
  if (list.status !== AllocationListStatus.POTENTIAL_ORDERS_GENERATED) {
    throw new ApiException(409, 'INVALID_STATUS', 'Orders can only be removed while awaiting confirmation.');
  }
  await prisma.orderLine.deleteMany({ where: { id: { in: orderLineIds }, allocationListId: listId } });
  return serializeAllocationList(await getAllocationListOrThrow(listId));
}

export async function deleteAllocationList(_user: AuthTokenPayload, listId: string): Promise<void> {
  const list = await getAllocationListOrThrow(listId);
  if (list.status === AllocationListStatus.ORDERS_SUBMITTED) {
    throw new ApiException(409, 'ORDERS_SUBMITTED', 'Submitted orders cannot be deleted.');
  }
  await prisma.allocationList.delete({ where: { id: listId } });
}
