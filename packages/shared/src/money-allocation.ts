/**
 * Money Allocation calculation, per guide section 4.2.3: "In Money
 * Allocation you simply divide the cash according to the model asset
 * allocation percentage". Unlike Rebalance, existing holdings are ignored
 * entirely and only BUY orders are produced (guide: "no sell orders are
 * generated").
 */

export interface MoneyAllocationModelEntry {
  assetId: string;
  percentAllocated: number;
  isCash: boolean;
}

export interface MoneyAllocationInput {
  /** Amount of cash this account has chosen to invest (guide: "Allocation Amount" / "Allocate All"). */
  investAmount: number;
  modelAllocations: MoneyAllocationModelEntry[];
}

export interface MoneyAllocationOrder {
  assetId: string;
  value: number;
}

export function calculateMoneyAllocation(input: MoneyAllocationInput): MoneyAllocationOrder[] {
  const { investAmount, modelAllocations } = input;
  if (investAmount <= 0) return [];

  return modelAllocations
    .filter((a) => !a.isCash && a.percentAllocated > 0)
    .map((a) => ({
      assetId: a.assetId,
      value: investAmount * (a.percentAllocated / 100),
    }));
}
