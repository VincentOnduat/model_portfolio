import { Router } from 'express';
import { z } from 'zod';
import { Permission, SharingScope, SharingKind } from '@model-portfolio/shared';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler, ApiException } from '../middleware/errorHandler.js';
import { assertCanEditModel } from '../services/models.service.js';
import { prisma } from '../lib/prisma.js';

/**
 * Model sharing (guide 4.1.5): Firm / Enterprise / Third Party permissions.
 * Mounted at /api/models/:modelId/sharing - mergeParams so :modelId from the
 * parent path is visible here.
 *
 * Reads are fully implemented; granting/revoking a share is stubbed with the
 * permission shape validated (so the frontend can be built against a stable
 * contract) but not yet persisted - see TODO below.
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

// TODO(#future): full implementation needs to walk the Enterprise firm
// hierarchy (share only "down", per guide 4.1.5) and check Third Party
// grants only target firms with a signed contract. Both require org-chart
// and contract data this scaffold's seed doesn't model yet.
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

    const grant = await prisma.sharingGrant.create({ data: { modelId, ...input } });
    res.status(201).json(grant);
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
