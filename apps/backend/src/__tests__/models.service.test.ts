import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@model-portfolio/shared';
import { prisma } from '../lib/prisma.js';
import { deleteModel, publishModel, setLock, setModelAllocation } from '../services/models.service.js';
import type { AuthTokenPayload } from '../lib/jwt.js';

// Exercises publish/lock/unlock/delete rules and allocation-sum validation
// (guide 4.1.1-4.1.3) against a real Postgres instance (see
// vitest.config.ts), with a small, self-contained set of fixtures cleaned
// up afterwards.

let firmId: string;
let ownerUserId: string;
let otherUserId: string;
let owner: AuthTokenPayload;
let other: AuthTokenPayload;
let assetAId: string;
let assetBId: string;
let seq = 0;

beforeAll(async () => {
  const firm = await prisma.firm.create({ data: { name: 'Test Firm - models.service.test' } });
  firmId = firm.id;

  const ownerUser = await prisma.user.create({
    data: {
      email: 'models-test-owner@example.test',
      passwordHash: 'unused',
      displayName: 'Test Owner',
      role: Role.ADVISER_MODEL_OWNER,
      firmId,
    },
  });
  ownerUserId = ownerUser.id;
  owner = { sub: ownerUserId, role: Role.ADVISER_MODEL_OWNER, firmId };

  // Same role/firm as the owner - only *which* user locked the model should
  // gate re-locking/unlocking (assertModelUnlockedOrOwnedByUser), not RBAC.
  const otherUser = await prisma.user.create({
    data: {
      email: 'models-test-other@example.test',
      passwordHash: 'unused',
      displayName: 'Test Other Owner',
      role: Role.ADVISER_MODEL_OWNER,
      firmId,
    },
  });
  otherUserId = otherUser.id;
  other = { sub: otherUserId, role: Role.ADVISER_MODEL_OWNER, firmId };

  const assetA = await prisma.asset.create({
    data: { name: 'Test Model Asset A', isin: 'TESTMDL0001', type: 'Fund', sector: 'EQUITY', lastPrice: 10 },
  });
  assetAId = assetA.id;

  const assetB = await prisma.asset.create({
    data: { name: 'Test Model Asset B', isin: 'TESTMDL0002', type: 'Fund', sector: 'EQUITY', lastPrice: 10 },
  });
  assetBId = assetB.id;
});

afterAll(async () => {
  await prisma.clientAccount.deleteMany({ where: { adviserFirmId: firmId } });
  await prisma.modelAsset.deleteMany({ where: { model: { ownerFirmId: firmId } } });
  await prisma.model.deleteMany({ where: { ownerFirmId: firmId } });
  await prisma.asset.deleteMany({ where: { id: { in: [assetAId, assetBId] } } });
  await prisma.user.deleteMany({ where: { firmId } });
  await prisma.firm.delete({ where: { id: firmId } });
});

async function createDraftModel() {
  seq += 1;
  return prisma.model.create({
    data: {
      reference: `TEST-MDL-${seq}`,
      name: `Test model ${seq}`,
      status: 'DRAFT',
      minimumTradeValue: 10,
      ownerFirmId: firmId,
      ownerUserId,
      createdByUserId: ownerUserId,
      updatedByUserId: ownerUserId,
    },
  });
}

describe('setModelAllocation - allocation-sum validation (guide 4.1.3)', () => {
  it('rejects an allocation that does not sum to 100%', async () => {
    const model = await createDraftModel();
    await expect(
      setModelAllocation(owner, model.id, [{ assetId: assetAId, percentAllocated: 40 }]),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_ALLOCATION' });
  });

  it('accepts an allocation that sums to exactly 100%', async () => {
    const model = await createDraftModel();
    const updated = await setModelAllocation(owner, model.id, [
      { assetId: assetAId, percentAllocated: 60 },
      { assetId: assetBId, percentAllocated: 40 },
    ]);
    expect(updated.assets.reduce((sum, a) => sum + a.percentAllocated, 0)).toBe(100);
  });
});

describe('publishModel (guide 4.1.2)', () => {
  it('refuses to publish a model with no allocation set at all', async () => {
    const model = await createDraftModel();
    await expect(publishModel(owner, model.id)).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_ALLOCATION',
    });
  });

  it('publishes a model whose allocation sums to 100%, moving it Draft -> Live', async () => {
    const model = await createDraftModel();
    await setModelAllocation(owner, model.id, [{ assetId: assetAId, percentAllocated: 100 }]);
    const published = await publishModel(owner, model.id);
    expect(published.status).toBe('LIVE');
  });
});

describe('setLock (guide 4.1.2 model state)', () => {
  it('lets the owner lock a model', async () => {
    const model = await createDraftModel();
    const locked = await setLock(owner, model.id, true);
    expect(locked.lockState).toBe('LOCKED');
    expect(locked.lockedByUserId).toBe(ownerUserId);
  });

  it('refuses to let a different user lock an already-locked model', async () => {
    const model = await createDraftModel();
    await setLock(owner, model.id, true);
    await expect(setLock(other, model.id, true)).rejects.toMatchObject({ status: 409, code: 'MODEL_LOCKED' });
  });

  it('refuses to let a different user unlock a model they did not lock', async () => {
    const model = await createDraftModel();
    await setLock(owner, model.id, true);
    await expect(setLock(other, model.id, false)).rejects.toMatchObject({ status: 409, code: 'MODEL_LOCKED' });
  });

  it('lets the locking user unlock their own model', async () => {
    const model = await createDraftModel();
    await setLock(owner, model.id, true);
    const unlocked = await setLock(owner, model.id, false);
    expect(unlocked.lockState).toBe('UNLOCKED');
    expect(unlocked.lockedByUserId).toBeNull();
  });

  it('blocks another user from editing the allocation of a model locked against them', async () => {
    const model = await createDraftModel();
    await setLock(owner, model.id, true);
    await expect(
      setModelAllocation(other, model.id, [{ assetId: assetAId, percentAllocated: 100 }]),
    ).rejects.toMatchObject({ status: 409, code: 'MODEL_LOCKED' });
  });
});

describe('deleteModel (guide 4.1.1 delete rules)', () => {
  it('always allows deleting a draft model', async () => {
    const model = await createDraftModel();
    await expect(deleteModel(owner, model.id)).resolves.toBeUndefined();
  });

  it('allows deleting a live model with zero attached accounts', async () => {
    const model = await createDraftModel();
    await setModelAllocation(owner, model.id, [{ assetId: assetAId, percentAllocated: 100 }]);
    await publishModel(owner, model.id);
    await expect(deleteModel(owner, model.id)).resolves.toBeUndefined();
  });

  it('refuses to delete a live model with attached client accounts', async () => {
    const model = await createDraftModel();
    await setModelAllocation(owner, model.id, [{ assetId: assetAId, percentAllocated: 100 }]);
    await publishModel(owner, model.id);
    const account = await prisma.clientAccount.create({
      data: {
        accountNumber: `TEST-MDL-ACC-${seq}`,
        accountName: 'Test Account',
        clientName: 'Test Client',
        clientNumber: `TEST-MDL-CL-${seq}`,
        adviserUserId: ownerUserId,
        adviserFirmId: firmId,
        linkedModelId: model.id,
      },
    });

    await expect(deleteModel(owner, model.id)).rejects.toMatchObject({
      status: 409,
      code: 'MODEL_HAS_ACCOUNTS',
    });

    await prisma.clientAccount.delete({ where: { id: account.id } });
  });
});
