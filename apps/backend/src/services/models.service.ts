import { Prisma } from '@prisma/client';
import {
  ModelAim,
  ModelRisk,
  ModelStatus,
  Permission,
  roleHasPermission,
  validateModelAllocation,
  isValidModelReference,
  isValidChargePercent,
} from '@model-portfolio/shared';
import { prisma } from '../lib/prisma.js';
import { ApiException } from '../middleware/errorHandler.js';
import type { AuthTokenPayload } from '../lib/jwt.js';

const modelInclude = {
  assets: { include: { asset: true } },
  _count: { select: { clientAccounts: true } },
} satisfies Prisma.ModelInclude;

export function serializeModel(model: Prisma.ModelGetPayload<{ include: typeof modelInclude }>) {
  return {
    id: model.id,
    reference: model.reference,
    name: model.name,
    status: model.status,
    lockState: model.lockState,
    lockedByUserId: model.lockedByUserId,
    aim: model.aim,
    risk: model.risk,
    minimumTradeValue: Number(model.minimumTradeValue),
    chargePercent: model.chargePercent == null ? null : Number(model.chargePercent),
    vatIncluded: model.vatIncluded,
    accountsAttachedCount: model._count.clientAccounts,
    ownerFirmId: model.ownerFirmId,
    ownerUserId: model.ownerUserId,
    createdByUserId: model.createdByUserId,
    updatedByUserId: model.updatedByUserId,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    assets: model.assets.map((ma) => ({
      assetId: ma.assetId,
      percentAllocated: Number(ma.percentAllocated),
      asset: {
        id: ma.asset.id,
        name: ma.asset.name,
        isin: ma.asset.isin,
        type: ma.asset.type,
        sector: ma.asset.sector,
        isCash: ma.asset.isCash,
        lastPrice: ma.asset.lastPrice == null ? null : Number(ma.asset.lastPrice),
      },
    })),
  };
}

export async function listModels(params: { status?: ModelStatus; firmId?: string }) {
  const models = await prisma.model.findMany({
    where: {
      status: params.status,
      ownerFirmId: params.firmId,
    },
    include: modelInclude,
    orderBy: { updatedAt: 'desc' },
  });
  return models.map(serializeModel);
}

export async function getModelOrThrow(id: string) {
  const model = await prisma.model.findUnique({ where: { id }, include: modelInclude });
  if (!model) {
    throw new ApiException(404, 'MODEL_NOT_FOUND', `No model with id ${id}.`);
  }
  return model;
}

/**
 * Guide 4.1.5: a model owner always has full rights; anyone else needs a
 * SharingGrant against this model that grants canEditModel (FIRM/ENTERPRISE
 * scope only - never THIRD_PARTY, matching the guide's "there is no Edit
 * permission possible" note for third-party sharing).
 */
export async function assertCanEditModel(user: AuthTokenPayload, modelId: string): Promise<void> {
  if (roleHasPermission(user.role, Permission.PLATFORM_ADMIN_ACCESS)) return;

  const model = await prisma.model.findUnique({ where: { id: modelId } });
  if (!model) {
    throw new ApiException(404, 'MODEL_NOT_FOUND', `No model with id ${modelId}.`);
  }

  if (model.ownerUserId === user.sub) return;

  if (roleHasPermission(user.role, Permission.EDIT_MODEL) && model.ownerFirmId === user.firmId) {
    return;
  }

  const grant = await prisma.sharingGrant.findFirst({
    where: {
      modelId,
      canEditModel: true,
      OR: [{ granteeUserId: user.sub }, { granteeFirmId: user.firmId }],
    },
  });
  if (grant) return;

  throw new ApiException(403, 'FORBIDDEN', 'You do not have edit rights on this model.');
}

export function assertModelUnlockedOrOwnedByUser(
  model: { lockState: string; lockedByUserId: string | null },
  userId: string,
): void {
  if (model.lockState === 'LOCKED' && model.lockedByUserId !== userId) {
    throw new ApiException(
      409,
      'MODEL_LOCKED',
      'This model is locked by another user and cannot be edited right now.',
    );
  }
}

export interface CreateModelInput {
  reference: string;
  name: string;
  minimumTradeValue: number;
  chargePercent?: number | null;
  vatIncluded?: boolean | null;
  aim?: ModelAim;
  risk?: ModelRisk;
}

export async function createModel(user: AuthTokenPayload, input: CreateModelInput) {
  if (!isValidModelReference(input.reference)) {
    throw new ApiException(
      422,
      'INVALID_REFERENCE',
      'Model reference may only contain letters, digits, dash and underscore.',
    );
  }
  if (input.chargePercent != null && !isValidChargePercent(input.chargePercent)) {
    throw new ApiException(422, 'INVALID_CHARGE', 'Charge percent must be between 0 and 10.');
  }

  const existing = await prisma.model.findUnique({ where: { reference: input.reference } });
  if (existing) {
    throw new ApiException(
      409,
      'DUPLICATE_REFERENCE',
      `A model with reference "${input.reference}" already exists.`,
    );
  }

  const cashAsset = await prisma.asset.findFirst({ where: { isCash: true } });

  const model = await prisma.model.create({
    data: {
      reference: input.reference,
      name: input.name,
      minimumTradeValue: input.minimumTradeValue,
      chargePercent: input.chargePercent ?? null,
      vatIncluded: input.vatIncluded ?? null,
      aim: input.aim ?? ModelAim.NOT_SPECIFIED,
      risk: input.risk ?? ModelRisk.NOT_SPECIFIED,
      ownerFirmId: user.firmId,
      ownerUserId: user.sub,
      createdByUserId: user.sub,
      updatedByUserId: user.sub,
      // Every model starts with 100% allocated to cash, per guide 4.1.3:
      // "there is also the cash asset added as the last one on the assets list".
      ...(cashAsset
        ? { assets: { create: [{ assetId: cashAsset.id, percentAllocated: 100 }] } }
        : {}),
    },
    include: modelInclude,
  });

  return serializeModel(model);
}

export interface UpdateModelInput {
  name?: string;
  minimumTradeValue?: number;
  chargePercent?: number | null;
  vatIncluded?: boolean | null;
  aim?: ModelAim;
  risk?: ModelRisk;
}

export async function updateModel(user: AuthTokenPayload, modelId: string, input: UpdateModelInput) {
  await assertCanEditModel(user, modelId);
  const model = await getModelOrThrow(modelId);
  assertModelUnlockedOrOwnedByUser(model, user.sub);

  if (input.chargePercent != null && !isValidChargePercent(input.chargePercent)) {
    throw new ApiException(422, 'INVALID_CHARGE', 'Charge percent must be between 0 and 10.');
  }

  const updated = await prisma.model.update({
    where: { id: modelId },
    data: {
      name: input.name,
      minimumTradeValue: input.minimumTradeValue,
      chargePercent: input.chargePercent,
      vatIncluded: input.vatIncluded,
      aim: input.aim,
      risk: input.risk,
      updatedByUserId: user.sub,
    },
    include: modelInclude,
  });

  return serializeModel(updated);
}

export async function deleteModel(user: AuthTokenPayload, modelId: string): Promise<void> {
  await assertCanEditModel(user, modelId);
  const model = await getModelOrThrow(modelId);

  // Guide 4.1.1: drafts can always be deleted; live models only if no
  // client accounts are attached.
  if (model.status === 'LIVE' && model._count.clientAccounts > 0) {
    throw new ApiException(
      409,
      'MODEL_HAS_ACCOUNTS',
      'A live model with client accounts attached cannot be deleted.',
    );
  }

  await prisma.model.delete({ where: { id: modelId } });
}

export async function setLock(
  user: AuthTokenPayload,
  modelId: string,
  locked: boolean,
): Promise<ReturnType<typeof serializeModel>> {
  await assertCanEditModel(user, modelId);
  const model = await getModelOrThrow(modelId);

  if (locked) {
    if (model.lockState === 'LOCKED' && model.lockedByUserId !== user.sub) {
      throw new ApiException(409, 'MODEL_LOCKED', 'This model is already locked by another user.');
    }
  } else if (model.lockState === 'LOCKED' && model.lockedByUserId !== user.sub) {
    throw new ApiException(409, 'MODEL_LOCKED', 'Only the locking user can unlock this model.');
  }

  const updated = await prisma.model.update({
    where: { id: modelId },
    data: {
      lockState: locked ? 'LOCKED' : 'UNLOCKED',
      lockedByUserId: locked ? user.sub : null,
    },
    include: modelInclude,
  });
  return serializeModel(updated);
}

export interface SetAllocationEntry {
  assetId: string;
  percentAllocated: number;
}

/**
 * Guide 4.1.3 "Set Allocation Change": replaces the full allocation set for
 * the model in one transaction. Validated against
 * packages/shared/src/validation.ts so the 100% rule is enforced identically
 * to the frontend's inline check.
 */
export async function setModelAllocation(
  user: AuthTokenPayload,
  modelId: string,
  entries: SetAllocationEntry[],
) {
  await assertCanEditModel(user, modelId);
  const model = await getModelOrThrow(modelId);
  assertModelUnlockedOrOwnedByUser(model, user.sub);

  const validation = validateModelAllocation(entries);
  if (!validation.valid) {
    throw new ApiException(422, 'INVALID_ALLOCATION', 'Model allocation is invalid.', validation.errors);
  }

  const assetIds = entries.map((e) => e.assetId);
  const assets = await prisma.asset.findMany({ where: { id: { in: assetIds } } });
  if (assets.length !== assetIds.length) {
    throw new ApiException(422, 'UNKNOWN_ASSET', 'One or more assets do not exist.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.modelAsset.deleteMany({ where: { modelId } });
    await tx.modelAsset.createMany({
      data: entries.map((e) => ({
        modelId,
        assetId: e.assetId,
        percentAllocated: e.percentAllocated,
      })),
    });
    return tx.model.update({
      where: { id: modelId },
      data: { updatedByUserId: user.sub },
      include: modelInclude,
    });
  });

  return serializeModel(updated);
}

/** Guide 4.1.2: "To change the model status from Draft to Live, finish adding the desirable assets and click on the Publish button." */
export async function publishModel(user: AuthTokenPayload, modelId: string) {
  await assertCanEditModel(user, modelId);
  const model = await getModelOrThrow(modelId);
  assertModelUnlockedOrOwnedByUser(model, user.sub);

  const validation = validateModelAllocation(
    model.assets.map((a) => ({ assetId: a.assetId, percentAllocated: Number(a.percentAllocated) })),
  );
  if (!validation.valid) {
    throw new ApiException(
      422,
      'INVALID_ALLOCATION',
      'Cannot publish: asset allocation must sum to 100% first.',
      validation.errors,
    );
  }

  const updated = await prisma.model.update({
    where: { id: modelId },
    data: { status: 'LIVE', updatedByUserId: user.sub },
    include: modelInclude,
  });
  return serializeModel(updated);
}
