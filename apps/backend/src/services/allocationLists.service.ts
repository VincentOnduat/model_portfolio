import {
  AllocationListStatus,
  AllocationListType,
  calculateMoneyAllocation,
  calculateRebalance,
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

export async function listAllocationLists(filters: {
  type?: AllocationListType;
  status?: AllocationListStatus;
}) {
  const lists = await prisma.allocationList.findMany({
    where: filters,
    include: {
      _count: { select: { accounts: true, exclusions: true, failures: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return lists.map((l) => ({
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
  }));
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

/**
 * Guide 4.2.3/4.2.4 Step 2: Generate Orders. Runs the pure calculation
 * engines from packages/shared against each account's model allocation
 * (and, for Rebalance, its current Holdings), then persists OrderLine rows.
 * Orders below the model's minimum trade value are kept (flagged
 * belowMinTrade) rather than dropped, per guide: "it is listed on the
 * detailed confirmation list but will not be placed or executed."
 */
export async function generateOrders(user: AuthTokenPayload, listId: string) {
  const list = await getAllocationListOrThrow(listId);
  if (list.status !== AllocationListStatus.CLIENT_ACCOUNTS_SELECTED) {
    throw new ApiException(409, 'INVALID_STATUS', 'Orders have already been generated for this list.');
  }
  if (list.accounts.length === 0) {
    throw new ApiException(422, 'NO_ACCOUNTS', 'Attach at least one client account before generating orders.');
  }

  const orderLinesToCreate: {
    accountId: string;
    assetId: string;
    side: 'BUY' | 'SELL';
    units: number | null;
    value: number;
    lastPrice: number | null;
    belowMinTrade: boolean;
  }[] = [];

  for (const listAccount of list.accounts) {
    const model = await prisma.model.findUnique({
      where: { id: listAccount.modelId },
      include: { assets: { include: { asset: true } } },
    });
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
        const price = asset.lastPrice == null ? null : Number(asset.lastPrice);
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
      const holdings = await prisma.holding.findMany({ where: { accountId: listAccount.accountId } });
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
        orderLinesToCreate.push({
          accountId: listAccount.accountId,
          assetId: o.assetId,
          side: o.side,
          value: o.value,
          units: o.units,
          lastPrice: asset?.lastPrice == null ? null : Number(asset.lastPrice),
          belowMinTrade: o.value < minTrade,
        });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderLine.deleteMany({ where: { allocationListId: listId } });
    if (orderLinesToCreate.length > 0) {
      await tx.orderLine.createMany({
        data: orderLinesToCreate.map((o) => ({ allocationListId: listId, ...o })),
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

  if (orderLinesToCreate.length === 0) {
    throw new ApiException(
      422,
      'NO_ORDERS_GENERATED',
      'No orders were generated - accounts may already match their model allocation.',
    );
  }

  return serializeAllocationList(await getAllocationListOrThrow(listId));
}

/** Guide Step 2 -> Step 3: "Confirm Orders" button. */
export async function confirmOrders(_user: AuthTokenPayload, listId: string) {
  const list = await getAllocationListOrThrow(listId);
  if (list.status !== AllocationListStatus.POTENTIAL_ORDERS_GENERATED) {
    throw new ApiException(409, 'INVALID_STATUS', 'Orders must be generated before they can be confirmed.');
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
