import { Router } from 'express';
import { z } from 'zod';
import { Permission, SharingScope, SharingKind } from '@model-portfolio/shared';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler, ApiException } from '../middleware/errorHandler.js';
import { assertCanEditModel } from '../services/models.service.js';
import { isDescendantFirm, hasSignedContract, getDescendantFirms, getContractedThirdPartyFirms } from '../services/firms.service.js';
import { prisma } from '../lib/prisma.js';

/**
 * Model sharing (guide 4.1.5): Firm / Enterprise / Third Party permissions.
 * Mounted at /api/models/:modelId/sharing - mergeParams so :modelId from the
 * parent path is visible here.
 *
 * Fully implemented: reads, grant create/revoke, and the Enterprise
 * hierarchy-walk / Third-Party contract restrictions (packages/shared's
 * SharingScope enum, enforced via services/firms.service.ts).
 */
export const sharingRouter = Router({ mergeParams: true });

sharingRouter.use(requireAuth, requirePermission(Permission.MODEL_MANAGEMENT_ACCESS));

const scopeQuerySchema = z.object({ scope: z.nativeEnum(SharingScope).optional() });

sharingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { modelId } = req.params as { modelId: string };
    const { scope } = scopeQuerySchema.parse(req.query);

    const grants = await prisma.sharingGrant.findMany({
      where: { modelId, scope },
      include: { granteeUser: true, granteeFirm: true },
    });

    res.json(
      grants.map((g) => ({
        id: g.id,
        modelId: g.modelId,
        scope: g.scope,
        kind: g.kind,
        granteeUserId: g.granteeUserId,
        granteeUserName: g.granteeUser?.displayName ?? null,
        granteeFirmId: g.granteeFirmId,
        granteeFirmName: g.granteeFirm?.name ?? null,
        canAttachAccounts: g.canAttachAccounts,
        canAllocateMoney: g.canAllocateMoney,
        canRebalance: g.canRebalance,
        canEditModel: g.canEditModel,
        allowOnwardShare: g.allowOnwardShare,
      })),
    );
  }),
);

const grantSchema = z.object({
  scope: z.nativeEnum(SharingScope),
  kind: z.nativeEnum(SharingKind).default(SharingKind.BESPOKE),
  granteeUserId: z.string().uuid().optional(),
  granteeFirmId: z.string().uuid().optional(),
  canAttachAccounts: z.boolean().default(false),
  canAllocateMoney: z.boolean().default(false),
  canRebalance: z.boolean().default(false),
  canEditModel: z.boolean().default(false),
  allowOnwardShare: z.boolean().default(false),
});

/**
 * Guide 4.1.5: Enterprise grants may only target a firm below the model
 * owner's firm in the org chart; Third Party grants may only target a firm
 * the model owner's firm has a signed contract with.
 */
sharingRouter.post(
  '/',
  requirePermission(Permission.SHARE_MY_FIRM),
  asyncHandler(async (req, res) => {
    const { modelId } = req.params as { modelId: string };
    await assertCanEditModel(req.user!, modelId);
    const input = grantSchema.parse(req.body);

    if (input.scope === SharingScope.THIRD_PARTY && input.canEditModel) {
      throw new ApiException(
        422,
        'INVALID_GRANT',
        'Third-party grants can never include canEditModel (guide 4.1.5.3).',
      );
    }
    if (
      (input.scope === SharingScope.ENTERPRISE || input.scope === SharingScope.THIRD_PARTY) &&
      !input.granteeFirmId
    ) {
      throw new ApiException(422, 'INVALID_GRANT', 'Enterprise/Third-Party grants require granteeFirmId.');
    }
    if (input.scope === SharingScope.FIRM && input.kind === SharingKind.BESPOKE && !input.granteeUserId) {
      throw new ApiException(422, 'INVALID_GRANT', 'Bespoke firm grants require granteeUserId.');
    }

    const model = await prisma.model.findUnique({ where: { id: modelId }, select: { ownerFirmId: true } });
    if (!model) {
      throw new ApiException(404, 'MODEL_NOT_FOUND', `No model with id ${modelId}.`);
    }

    if (input.scope === SharingScope.ENTERPRISE && input.granteeFirmId) {
      const isDescendant = await isDescendantFirm(input.granteeFirmId, model.ownerFirmId);
      if (!isDescendant) {
        throw new ApiException(
          422,
          'INVALID_GRANT',
          'Enterprise grants may only target a firm below yours in the org chart (guide 4.1.5).',
        );
      }
    }
    if (input.scope === SharingScope.THIRD_PARTY && input.granteeFirmId) {
      const contracted = await hasSignedContract(model.ownerFirmId, input.granteeFirmId);
      if (!contracted) {
        throw new ApiException(
          422,
          'INVALID_GRANT',
          'Third-Party grants may only target a firm with a signed contract (guide 4.1.5).',
        );
      }
    }

    const grant = await prisma.sharingGrant.create({ data: { modelId, ...input } });
    res.status(201).json(grant);
  }),
);

/**
 * Guide 4.1.5: which firms/users a grant could actually target for the
 * given scope, so the frontend can offer a picker instead of a raw UUID
 * field the caller has to guess and get rejected on.
 */
const eligibleGranteesQuerySchema = z.object({ scope: z.nativeEnum(SharingScope) });

sharingRouter.get(
  '/eligible-grantees',
  asyncHandler(async (req, res) => {
    const { modelId } = req.params as { modelId: string };
    const { scope } = eligibleGranteesQuerySchema.parse(req.query);

    const model = await prisma.model.findUnique({ where: { id: modelId }, select: { ownerFirmId: true } });
    if (!model) {
      throw new ApiException(404, 'MODEL_NOT_FOUND', `No model with id ${modelId}.`);
    }

    if (scope === SharingScope.FIRM) {
      const users = await prisma.user.findMany({
        where: { firmId: model.ownerFirmId },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
      });
      res.json(users.map((u) => ({ id: u.id, name: u.displayName })));
    } else if (scope === SharingScope.ENTERPRISE) {
      res.json(await getDescendantFirms(model.ownerFirmId));
    } else {
      res.json(await getContractedThirdPartyFirms(model.ownerFirmId));
    }
  }),
);

sharingRouter.delete(
  '/:grantId',
  requirePermission(Permission.SHARE_MY_FIRM),
  asyncHandler(async (req, res) => {
    const { modelId, grantId } = req.params as { modelId: string; grantId: string };
    await assertCanEditModel(req.user!, modelId);
    await prisma.sharingGrant.delete({ where: { id: grantId } });
    res.status(204).send();
  }),
);
