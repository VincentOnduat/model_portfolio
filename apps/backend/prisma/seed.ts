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

  // --- A published "Balanced Growth" model, owned by the adviser firm ------
  const balancedGrowthModel = await prisma.model.create({
    data: {
      reference: 'BAL-GROWTH-01',
      name: 'Balanced Growth',
      status: 'LIVE',
      minimumTradeValue: 250,
      aim: 'BALANCED_AND_GROWTH',
      risk: 'MEDIUM',
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
