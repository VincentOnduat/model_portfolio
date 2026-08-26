import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma.js';
import {
  getContractedThirdPartyFirms,
  getDescendantFirms,
  hasSignedContract,
  isDescendantFirm,
} from '../services/firms.service.js';

// Exercises the Enterprise hierarchy walk and Third-Party contract check
// (guide 4.1.5) against a real Postgres instance (see vitest.config.ts),
// with a small, self-contained set of fixtures cleaned up afterwards.

let rootFirmId: string;
let childFirmId: string;
let grandchildFirmId: string;
let unrelatedFirmId: string;
let contractedThirdPartyId: string;
let uncontractedThirdPartyId: string;

beforeAll(async () => {
  const root = await prisma.firm.create({ data: { name: 'Test Root Firm - firms.service.test' } });
  rootFirmId = root.id;

  const child = await prisma.firm.create({
    data: { name: 'Test Child Firm - firms.service.test', parentFirmId: rootFirmId },
  });
  childFirmId = child.id;

  const grandchild = await prisma.firm.create({
    data: { name: 'Test Grandchild Firm - firms.service.test', parentFirmId: childFirmId },
  });
  grandchildFirmId = grandchild.id;

  const unrelated = await prisma.firm.create({ data: { name: 'Test Unrelated Firm - firms.service.test' } });
  unrelatedFirmId = unrelated.id;

  const contractedThirdParty = await prisma.firm.create({
    data: { name: 'Test Contracted Third Party - firms.service.test', isThirdParty: true },
  });
  contractedThirdPartyId = contractedThirdParty.id;

  const uncontractedThirdParty = await prisma.firm.create({
    data: { name: 'Test Uncontracted Third Party - firms.service.test', isThirdParty: true },
  });
  uncontractedThirdPartyId = uncontractedThirdParty.id;

  await prisma.firmContract.create({
    data: { ownerFirmId: rootFirmId, thirdPartyFirmId: contractedThirdPartyId },
  });
});

afterAll(async () => {
  await prisma.firmContract.deleteMany({ where: { ownerFirmId: rootFirmId } });
  await prisma.firm.deleteMany({
    where: {
      id: {
        in: [
          rootFirmId,
          childFirmId,
          grandchildFirmId,
          unrelatedFirmId,
          contractedThirdPartyId,
          uncontractedThirdPartyId,
        ],
      },
    },
  });
});

describe('isDescendantFirm (guide 4.1.5 Enterprise hierarchy)', () => {
  it('is true for a direct child', async () => {
    expect(await isDescendantFirm(childFirmId, rootFirmId)).toBe(true);
  });

  it('is true for a grandchild (walks the full chain)', async () => {
    expect(await isDescendantFirm(grandchildFirmId, rootFirmId)).toBe(true);
  });

  it('is false for an unrelated firm', async () => {
    expect(await isDescendantFirm(unrelatedFirmId, rootFirmId)).toBe(false);
  });

  it('is false for a firm checked against itself', async () => {
    expect(await isDescendantFirm(rootFirmId, rootFirmId)).toBe(false);
  });

  it('is false in the reverse direction (an ancestor is not its own descendant\'s descendant)', async () => {
    expect(await isDescendantFirm(rootFirmId, childFirmId)).toBe(false);
  });
});

describe('getDescendantFirms', () => {
  it('returns every firm below the given firm, at any depth', async () => {
    const descendants = await getDescendantFirms(rootFirmId);
    const ids = descendants.map((f) => f.id);
    expect(ids).toContain(childFirmId);
    expect(ids).toContain(grandchildFirmId);
    expect(ids).not.toContain(unrelatedFirmId);
  });
});

describe('hasSignedContract (guide 4.1.5 Third-Party sharing)', () => {
  it('is true when a FirmContract row exists for the pair', async () => {
    expect(await hasSignedContract(rootFirmId, contractedThirdPartyId)).toBe(true);
  });

  it('is false when no contract exists for the pair', async () => {
    expect(await hasSignedContract(rootFirmId, uncontractedThirdPartyId)).toBe(false);
  });
});

describe('getContractedThirdPartyFirms', () => {
  it('returns only firms with a signed contract with the owner firm', async () => {
    const firms = await getContractedThirdPartyFirms(rootFirmId);
    const ids = firms.map((f) => f.id);
    expect(ids).toContain(contractedThirdPartyId);
    expect(ids).not.toContain(uncontractedThirdPartyId);
  });
});
