import { prisma } from '../lib/prisma.js';

/**
 * Guide 4.1.5 Enterprise sharing: a grant may only target a firm that sits
 * *below* the sharer's firm in the org chart. Walks up `candidateFirmId`'s
 * parentFirmId chain looking for `ancestorFirmId` - iterative rather than a
 * recursive SQL CTE, since this scaffold's hierarchies are shallow (a few
 * levels at most) and this keeps the check simple and portable.
 */
export async function isDescendantFirm(candidateFirmId: string, ancestorFirmId: string): Promise<boolean> {
  if (candidateFirmId === ancestorFirmId) return false; // a firm isn't its own descendant

  let currentId: string | null = candidateFirmId;
  const MAX_DEPTH = 20; // backstop against a corrupt/cyclic parentFirmId chain
  for (let i = 0; i < MAX_DEPTH && currentId; i++) {
    const firm: { parentFirmId: string | null } | null = await prisma.firm.findUnique({
      where: { id: currentId },
      select: { parentFirmId: true },
    });
    if (!firm) return false;
    if (firm.parentFirmId === ancestorFirmId) return true;
    currentId = firm.parentFirmId;
  }
  return false;
}

/**
 * Guide 4.1.5 Third Party sharing: a grant may only target a firm
 * `ownerFirmId` has a signed `FirmContract` with.
 */
export async function hasSignedContract(ownerFirmId: string, thirdPartyFirmId: string): Promise<boolean> {
  const contract = await prisma.firmContract.findUnique({
    where: { ownerFirmId_thirdPartyFirmId: { ownerFirmId, thirdPartyFirmId } },
  });
  return contract != null;
}

/** All firms below `ancestorFirmId` in the org chart, at any depth - the Enterprise-scope grantee pool. */
export async function getDescendantFirms(ancestorFirmId: string): Promise<{ id: string; name: string }[]> {
  const result: { id: string; name: string }[] = [];
  let frontier = [ancestorFirmId];
  const MAX_DEPTH = 20;
  for (let i = 0; i < MAX_DEPTH && frontier.length > 0; i++) {
    const children = await prisma.firm.findMany({
      where: { parentFirmId: { in: frontier } },
      select: { id: true, name: true },
    });
    if (children.length === 0) break;
    result.push(...children);
    frontier = children.map((c) => c.id);
  }
  return result;
}

/** Firms `ownerFirmId` has a signed FirmContract with - the Third-Party-scope grantee pool. */
export async function getContractedThirdPartyFirms(ownerFirmId: string): Promise<{ id: string; name: string }[]> {
  const contracts = await prisma.firmContract.findMany({
    where: { ownerFirmId },
    include: { thirdPartyFirm: { select: { id: true, name: true } } },
  });
  return contracts.map((c) => c.thirdPartyFirm);
}
