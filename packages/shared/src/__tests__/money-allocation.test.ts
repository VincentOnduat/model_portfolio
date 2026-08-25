import { describe, expect, it } from 'vitest';
import { calculateMoneyAllocation } from '../money-allocation.js';

describe('calculateMoneyAllocation', () => {
  it('splits the invested amount by model percentage, buy orders only', () => {
    const orders = calculateMoneyAllocation({
      investAmount: 1000,
      modelAllocations: [
        { assetId: 'cash', percentAllocated: 20, isCash: true },
        { assetId: 'equityA', percentAllocated: 30, isCash: false },
        { assetId: 'equityB', percentAllocated: 50, isCash: false },
      ],
    });

    expect(orders).toEqual([
      { assetId: 'equityA', value: 300 },
      { assetId: 'equityB', value: 500 },
    ]);
  });

  it('returns no orders when there is nothing to invest', () => {
    expect(
      calculateMoneyAllocation({
        investAmount: 0,
        modelAllocations: [{ assetId: 'equityA', percentAllocated: 100, isCash: false }],
      }),
    ).toEqual([]);
  });
});
