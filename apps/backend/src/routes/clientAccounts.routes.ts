import { Router } from 'express';
import { z } from 'zod';
import { Permission, isAccountEligibleForModel } from '@model-portfolio/shared';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler, ApiException } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

/**
 * Client Accounts (guide 4.1.4). Listing/searching/attach/detach are fully
 * implemented, including the client-consent and account-type/model
 * suitability gate (`isAccountEligibleForModel`, packages/shared) that
 * greys out ineligible accounts before they can be attached.
 */
export const clientAccountsRouter = Router();

clientAccountsRouter.use(requireAuth, requirePermission(Permission.MODEL_MANAGEMENT_ACCESS));

const listQuerySchema = z.object({
  search: z.string().optional(),
  unattachedOnly: z.coerce.boolean().optional(),
  /** Filters to accounts currently attached to this model (used for the "attached" list). */
  modelId: z.string().uuid().optional(),
  /**
   * Computes eligibility against this model without filtering by attachment -
   * used for the "available" list, which needs eligibility info alongside
   * unattachedOnly. Deliberately a separate param from `modelId`: combining
   * `unattachedOnly` (linkedModelId: null) with `modelId` (linkedModelId: X)
   * as the same filter would be self-contradictory.
   */
  eligibilityModelId: z.string().uuid().optional(),
});

clientAccountsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, unattachedOnly, modelId, eligibilityModelId } = listQuerySchema.parse(req.query);

    const eligibilityTargetId = eligibilityModelId ?? modelId;
    const model = eligibilityTargetId
      ? await prisma.model.findUnique({ where: { id: eligibilityTargetId }, select: { eligibleAccountTypes: true } })
      : null;

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
      accounts.map((a) => {
        const eligibility = model
          ? isAccountEligibleForModel(
              { hasConsent: a.hasConsent, accountType: a.accountType },
              { eligibleAccountTypes: model.eligibleAccountTypes },
            )
          : null;
        return {
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
          accountType: a.accountType,
          hasConsent: a.hasConsent,
          ...(eligibility ? { eligible: eligibility.eligible, ineligibleReason: eligibility.reason } : {}),
        };
      }),
    );
  }),
);

const attachSchema = z.object({
  modelId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()).min(1),
});

/**
 * Guide 4.1.4: attaching enforces client-consent and account-type/model
 * suitability (`isAccountEligibleForModel`, packages/shared - the same
 * function the frontend uses to grey out rows before this round-trip).
 * Ineligible accounts are rejected with a 422 naming each one and why,
 * rather than silently no-op'd.
 */
clientAccountsRouter.post(
  '/attach',
  requirePermission(Permission.ADD_EDIT_CLIENT_ACCOUNTS),
  asyncHandler(async (req, res) => {
    const { modelId, accountIds } = attachSchema.parse(req.body);

    const model = await prisma.model.findUnique({
      where: { id: modelId },
      select: { eligibleAccountTypes: true },
    });
    if (!model) {
      throw new ApiException(404, 'MODEL_NOT_FOUND', `No model with id ${modelId}.`);
    }

    const accounts = await prisma.clientAccount.findMany({ where: { id: { in: accountIds } } });

    const ineligible: { accountId: string; accountNumber: string; reason: string }[] = [];
    for (const account of accounts) {
      if (account.linkedModelId != null) {
        ineligible.push({
          accountId: account.id,
          accountNumber: account.accountNumber,
          reason: 'Already attached to a model.',
        });
        continue;
      }
      const eligibility = isAccountEligibleForModel(
        { hasConsent: account.hasConsent, accountType: account.accountType },
        { eligibleAccountTypes: model.eligibleAccountTypes },
      );
      if (!eligibility.eligible) {
        ineligible.push({
          accountId: account.id,
          accountNumber: account.accountNumber,
          reason: eligibility.reason ?? 'Not eligible.',
        });
      }
    }

    if (ineligible.length > 0) {
      throw new ApiException(
        422,
        'ACCOUNTS_NOT_ELIGIBLE',
        'One or more accounts cannot be attached to this model.',
        ineligible,
      );
    }

    await prisma.clientAccount.updateMany({
      where: { id: { in: accountIds } },
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
