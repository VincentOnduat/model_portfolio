import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Firms -----------------------------------------------------------
  const platformFirm = await prisma.firm.create({ data: { name: 'Platform Operator' } });
  const parentAdviserFirm = await prisma.firm.create({ data: { name: 'Northbridge Wealth Group' } });
  const childAdviserFirm = await prisma.firm.create({
    data: { name: 'Northbridge Wealth - Manchester', parentFirmId: parentAdviserFirm.id },
  });
  const thirdPartyFirm = await prisma.firm.create({
    data: { name: 'Aldgate Discretionary Managers', isThirdParty: true },
  });

  // --- Users -------------------------------------------------------------
  const [admin, ifaOwner, ifaStandard, dfmOwner, thirdPartyStandard] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@platform.test',
        passwordHash,
        displayName: 'Priya Admin',
        role: 'PLATFORM_ADMIN',
        firmId: platformFirm.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'owner@northbridge.test',
        passwordHash,
        displayName: 'Alex Owner',
        role: 'ADVISER_MODEL_OWNER',
        firmId: parentAdviserFirm.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'advisor@northbridge.test',
        passwordHash,
        displayName: 'Sam Advisor',
        role: 'ADVISER_STANDARD',
        firmId: childAdviserFirm.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'owner@aldgate.test',
        passwordHash,
        displayName: 'Jordan DFM',
        role: 'THIRD_PARTY_MODEL_OWNER',
        firmId: thirdPartyFirm.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'standard@aldgate.test',
        passwordHash,
        displayName: 'Riley Broker',
        role: 'THIRD_PARTY_STANDARD',
        firmId: thirdPartyFirm.id,
      },
    }),
  ]);

  // --- Assets --------------------------------------------------------------
  const cash = await prisma.asset.create({
    data: { name: 'Cash', isin: 'CASH000000', type: 'Cash', sector: 'CASH', isCash: true, lastPrice: 1 },
  });
  const globalEquity = await prisma.asset.create({
    data: {
      name: 'Global Equity Index Fund',
      isin: 'GB00B4L5Y983',
      type: 'Fund',
      sector: 'EQUITY',
      lastPrice: 145.32,
    },
  });
  const ukGilt = await prisma.asset.create({
    data: { name: 'UK Gilt Fund', isin: 'GB00B24CGK77', type: 'Fund', sector: 'BOND', lastPrice: 98.1 },
  });
  const emergingEquity = await prisma.asset.create({
    data: {
      name: 'Emerging Markets Equity Fund',
      isin: 'IE00B0M63177',
      type: 'Fund',
      sector: 'EQUITY',
      lastPrice: 76.44,
    },
  });
  const corporateBond = await prisma.asset.create({
    data: {
      name: 'Sterling Corporate Bond Fund',
      isin: 'GB00B7S8GS22',
      type: 'Fund',
      sector: 'BOND',
      lastPrice: 110.05,
    },
  });

  // Two assets that deliberately trigger Exclusions (guide 4.2.5) - kept out
  // of the Balanced Growth model so its Rebalance demo stays clean; see the
  // dedicated "Exclusions Demo" model below.
  const suspendedFund = await prisma.asset.create({
    data: {
      name: 'Suspended Fund X',
      isin: 'GB00SUSPEND1',
      type: 'Fund',
      sector: 'EQUITY',
      lastPrice: 50,
      isTradeable: false,
    },
  });
  const noPriceFund = await prisma.asset.create({
    data: { name: 'New Launch Fund', isin: 'GB00NOPRICE1', type: 'Fund', sector: 'EQUITY' },
  });

  // --- A published "Balanced Growth" model, owned by the adviser firm ------
  const balancedGrowthModel = await prisma.model.create({
    data: {
      reference: 'BAL-GROWTH-01',
      name: 'Balanced Growth',
      status: 'LIVE',
      minimumTradeValue: 250,
      aim: 'BALANCED_AND_GROWTH',
      risk: 'MEDIUM',
      // Guide 4.1.4 account-type suitability demo: only ISA/GIA accounts are
      // eligible - see the SIPP account below for the greyed-out case.
      eligibleAccountTypes: ['ISA', 'GIA'],
      ownerFirmId: parentAdviserFirm.id,
      ownerUserId: ifaOwner.id,
      createdByUserId: ifaOwner.id,
      updatedByUserId: ifaOwner.id,
      assets: {
        create: [
          { assetId: cash.id, percentAllocated: 5 },
          { assetId: globalEquity.id, percentAllocated: 45 },
          { assetId: ukGilt.id, percentAllocated: 25 },
          { assetId: emergingEquity.id, percentAllocated: 10 },
          { assetId: corporateBond.id, percentAllocated: 15 },
        ],
      },
    },
  });

  // A second, still-draft model to demonstrate the Draft/Live distinction.
  await prisma.model.create({
    data: {
      reference: 'CAUTIOUS-INC-01',
      name: 'Cautious Income (Draft)',
      status: 'DRAFT',
      minimumTradeValue: 250,
      aim: 'INCOME',
      risk: 'LOW_MEDIUM',
      ownerFirmId: thirdPartyFirm.id,
      ownerUserId: dfmOwner.id,
      createdByUserId: dfmOwner.id,
      updatedByUserId: dfmOwner.id,
      chargePercent: 0.5,
      vatIncluded: false,
      assets: { create: [{ assetId: cash.id, percentAllocated: 100 }] },
    },
  });

  // A third model whose allocation deliberately includes a non-tradeable and
  // a no-price asset, so Money Allocation -> Generate Orders demonstrates
  // real Exclusions (guide 4.2.5) instead of the panel always being empty.
  const exclusionsDemoModel = await prisma.model.create({
    data: {
      reference: 'EXCL-DEMO-01',
      name: 'Exclusions Demo',
      status: 'LIVE',
      minimumTradeValue: 100,
      aim: 'GROWTH',
      risk: 'HIGH',
      ownerFirmId: parentAdviserFirm.id,
      ownerUserId: ifaOwner.id,
      createdByUserId: ifaOwner.id,
      updatedByUserId: ifaOwner.id,
      assets: {
        create: [
          { assetId: cash.id, percentAllocated: 20 },
          { assetId: suspendedFund.id, percentAllocated: 40 },
          { assetId: noPriceFund.id, percentAllocated: 40 },
        ],
      },
    },
  });

  // --- A firm-sharing grant so ifaStandard can operate on the model -------
  await prisma.sharingGrant.create({
    data: {
      modelId: balancedGrowthModel.id,
      scope: 'FIRM',
      kind: 'BESPOKE',
      granteeUserId: ifaStandard.id,
      canAttachAccounts: true,
      canAllocateMoney: true,
      canRebalance: true,
      canEditModel: false,
      allowOnwardShare: false,
    },
  });

  // Northbridge has a signed contract with Aldgate - guide 4.1.5 Third Party
  // sharing restriction demo (without this, a THIRD_PARTY grant to Aldgate
  // would be rejected).
  await prisma.firmContract.create({
    data: { ownerFirmId: parentAdviserFirm.id, thirdPartyFirmId: thirdPartyFirm.id },
  });

  // Enterprise grant to the (legitimate, descendant) Manchester office, and
  // a Third Party grant to the now-contracted Aldgate - guide 4.1.5 hierarchy
  // walk / contract check demo.
  await prisma.sharingGrant.create({
    data: {
      modelId: balancedGrowthModel.id,
      scope: 'ENTERPRISE',
      kind: 'BESPOKE',
      granteeFirmId: childAdviserFirm.id,
      canAttachAccounts: true,
      canAllocateMoney: false,
      canRebalance: false,
      canEditModel: false,
      allowOnwardShare: false,
    },
  });
  await prisma.sharingGrant.create({
    data: {
      modelId: balancedGrowthModel.id,
      scope: 'THIRD_PARTY',
      kind: 'BESPOKE',
      granteeFirmId: thirdPartyFirm.id,
      canAttachAccounts: false,
      canAllocateMoney: false,
      canRebalance: true,
      canEditModel: false,
      allowOnwardShare: false,
    },
  });

  // --- Client accounts, one attached & drifted (for Rebalance demo), one unattached
  const attachedAccount = await prisma.clientAccount.create({
    data: {
      accountNumber: 'ACC-100234',
      accountName: 'J Whitfield - ISA',
      clientName: 'James Whitfield',
      clientNumber: 'CL-5521',
      adviserUserId: ifaStandard.id,
      adviserFirmId: childAdviserFirm.id,
      linkedModelId: balancedGrowthModel.id,
      dateLinked: new Date(),
      availableCash: 5000,
      cashAccountBalance: 2000,
      accountType: 'ISA',
      holdings: {
        create: [
          { assetId: globalEquity.id, quantity: 400 }, // over-weight equity vs. model target
          { assetId: ukGilt.id, quantity: 50 },
        ],
      },
    },
  });

  await prisma.clientAccount.create({
    data: {
      accountNumber: 'ACC-100235',
      accountName: 'R Adeyemi - GIA',
      clientName: 'Ronke Adeyemi',
      clientNumber: 'CL-5522',
      adviserUserId: ifaOwner.id,
      adviserFirmId: parentAdviserFirm.id,
      availableCash: 12000,
      cashAccountBalance: 12000,
      accountType: 'GIA',
    },
  });

  // Guide 4.1.4 suitability demo: a SIPP account, unattached - Balanced
  // Growth only accepts ISA/GIA, so this one shows greyed-out in its
  // "Available" list once the model's eligibleAccountTypes is checked.
  await prisma.clientAccount.create({
    data: {
      accountNumber: 'ACC-100236',
      accountName: 'M Chen - SIPP',
      clientName: 'Mei Chen',
      clientNumber: 'CL-5523',
      adviserUserId: ifaOwner.id,
      adviserFirmId: parentAdviserFirm.id,
      availableCash: 8000,
      cashAccountBalance: 8000,
      accountType: 'SIPP',
    },
  });

  // Guide 4.1.4 consent demo: an otherwise-eligible ISA account whose client
  // hasn't given consent - also shows greyed-out, for a different reason.
  await prisma.clientAccount.create({
    data: {
      accountNumber: 'ACC-100237',
      accountName: 'T Osei - ISA',
      clientName: 'Tunde Osei',
      clientNumber: 'CL-5524',
      adviserUserId: ifaOwner.id,
      adviserFirmId: parentAdviserFirm.id,
      availableCash: 4000,
      cashAccountBalance: 4000,
      accountType: 'ISA',
      hasConsent: false,
    },
  });

  // Attached to the Exclusions Demo model, with cash to invest via Money
  // Allocation - see the suspendedFund/noPriceFund assets above.
  await prisma.clientAccount.create({
    data: {
      accountNumber: 'ACC-100238',
      accountName: 'P Nkemelu - GIA',
      clientName: 'Phoebe Nkemelu',
      clientNumber: 'CL-5525',
      adviserUserId: ifaOwner.id,
      adviserFirmId: parentAdviserFirm.id,
      linkedModelId: exclusionsDemoModel.id,
      dateLinked: new Date(),
      availableCash: 3000,
      cashAccountBalance: 3000,
      accountType: 'GIA',
    },
  });

  console.log('Seed complete.');
  console.log('---------------------------------------------------------');
  console.log('Demo accounts (all use password: ' + DEMO_PASSWORD + '):');
  console.log('  admin@platform.test          PLATFORM_ADMIN');
  console.log('  owner@northbridge.test        ADVISER_MODEL_OWNER');
  console.log('  advisor@northbridge.test      ADVISER_STANDARD (bespoke grant on Balanced Growth)');
  console.log('  owner@aldgate.test            THIRD_PARTY_MODEL_OWNER');
  console.log('  standard@aldgate.test         THIRD_PARTY_STANDARD');
  console.log('---------------------------------------------------------');
  console.log(`Model "Balanced Growth" (${balancedGrowthModel.reference}) has client account`);
  console.log(`${attachedAccount.accountNumber} attached and deliberately drifted from target -`);
  console.log('use it to try the Rebalance flow end to end.');
  console.log('---------------------------------------------------------');
  console.log('Account-type/consent gating demo (Client Accounts tab on Balanced Growth):');
  console.log('  ACC-100236 (SIPP) - greyed out, wrong account type for this model.');
  console.log('  ACC-100237 (ISA)  - greyed out, client has not given consent.');
  console.log('Sharing demo: Enterprise grant to Manchester + Third-Party grant to');
  console.log('Aldgate (now under contract) are pre-seeded on Balanced Growth.');
  console.log(`Exclusions demo: Money Allocation on "${exclusionsDemoModel.name}" (account`);
  console.log('ACC-100238) generates real Exclusion rows for a non-tradeable and a');
  console.log('no-price asset alongside a normal cash buy.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
