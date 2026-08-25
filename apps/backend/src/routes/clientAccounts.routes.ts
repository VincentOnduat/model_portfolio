import { Router } from 'express';
import { z } from 'zod';
import { Permission } from '@model-portfolio/shared';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

/**
 * Client Accounts (guide 4.1.4). Listing/searching is implemented for real
 * since Model Management's "Assets/Client Accounts" tabs need it; attach and
 * detach are stubbed pending the full Money Allocation/Rebalance module
 * (tracked alongside allocationLists.routes.ts).
 */
export const clientAccountsRouter = Router();

clientAccountsRouter.use(requireAuth, requirePermission(Permission.MODEL_MANAGEMENT_ACCESS));

const listQuerySchema = z.object({
  search: z.string().optional(),
  unattachedOnly: z.coerce.boolean().optional(),
  modelId: z.string().uuid().optional(),
});

clientAccountsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, unattachedOnly, modelId } = listQuerySchema.parse(req.query);

    const accounts = await prisma.clientAccount.findMany({
      where: {
        ...(unattachedOnly ? { linkedModelId: null } : {}),
        ...(modelId ? { linkedModelId: modelId } : {}),
        ...(search && search.length >= 3
          ? {
              OR: [
                { accountNumber: { contains: search, mode: 'insensitive' } },
                { accountName: { contains: search, mode: 'insensitive' } },
                { clientName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { adviserUser: true, linkedModel: { select: { id: true, name: true } } },
      orderBy: { accountName: 'asc' },
      take: 200,
    });

    res.json(
      accounts.map((a) => ({
        id: a.id,
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        clientName: a.clientName,
        clientNumber: a.clientNumber,
        adviserName: a.adviserUser.displayName,
        linkedModelId: a.linkedModelId,
        linkedModelName: a.linkedModel?.name ?? null,
        dateLinked: a.dateLinked?.toISOString() ?? null,
        availableCash: Number(a.availableCash),
        cashAccountBalance: Number(a.cashAccountBalance),
        lastRebalanceDate: a.lastRebalanceDate?.toISOString() ?? null,
      })),
    );
  }),
);

const attachSchema = z.object({
  modelId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()).min(1),
});

// TODO(#future): implement client-consent and account-type-suitability checks
// described in guide 4.1.4 ("client account can be attached only to one
// model"; a client with no consent, or an account type unsuited to the
// model, must be shown greyed-out and rejected here).
clientAccountsRouter.post(
  '/attach',
  requirePermission(Permission.ADD_EDIT_CLIENT_ACCOUNTS),
  asyncHandler(async (req, res) => {
    const { modelId, accountIds } = attachSchema.parse(req.body);
    await prisma.clientAccount.updateMany({
      where: { id: { in: accountIds }, linkedModelId: null },
      data: { linkedModelId: modelId, dateLinked: new Date() },
    });
    res.status(200).json({ attached: accountIds.length });
  }),
);

const detachSchema = z.object({ accountIds: z.array(z.string().uuid()).min(1) });

clientAccountsRouter.post(
  '/detach',
  requirePermission(Permission.ADD_EDIT_CLIENT_ACCOUNTS),
  asyncHandler(async (req, res) => {
    const { accountIds } = detachSchema.parse(req.body);
    await prisma.clientAccount.updateMany({
      where: { id: { in: accountIds } },
      data: { linkedModelId: null, dateLinked: null },
    });
    res.status(200).json({ detached: accountIds.length });
  }),
);
