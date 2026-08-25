import { describe, expect, it } from 'vitest';
import { calculateRebalance } from '../rebalance.js';
import { validateModelAllocation, isValidModelReference, isValidChargePercent } from '../validation.js';

describe('calculateRebalance', () => {
  it('generates a sell and a buy order when an account has drifted from its model', () => {
    // Total value = 6000 (cash) + 3000 (equityA @ 10 * 300) + 1000 (equityB @ 5 * 200) = 10000
    // Model target: cash 10%, equityA 30%, equityB 60%
    // Target: cash 1000, equityA 3000, equityB 6000
    // Diff:   cash -5000 (cash isn't tradeable so ignored), equityA 0, equityB +5000
    const result = calculateRebalance({
      holdings: [
        { assetId: 'cash', quantity: 6000, price: null, isCash: true },
        { assetId: 'equityA', quantity: 300, price: 10 },
        { assetId: 'equityB', quantity: 200, price: 5 },
      ],
      modelAllocations: [
        { assetId: 'cash', percentAllocated: 10 },
        { assetId: 'equityA', percentAllocated: 30 },
        { assetId: 'equityB', percentAllocated: 60 },
      ],
      minimumTradeValue: 50,
    });

    expect(result.totalAccountValue).toBe(10000);
    const buy = result.orders.find((o) => o.assetId === 'equityB');
    expect(buy?.side).toBe('BUY');
    expect(buy?.value).toBeCloseTo(5000, 2);
    expect(buy?.units).toBeCloseTo(1000, 2);
    // equityA is exactly on target, so no order should be raised for it.
    expect(result.orders.find((o) => o.assetId === 'equityA')).toBeUndefined();
  });

  it('funds buy orders only from the proceeds of sell orders, split proportionally', () => {
    const result = calculateRebalance({
      holdings: [
        { assetId: 'cash', quantity: 0, price: null, isCash: true },
        { assetId: 'equityA', quantity: 1000, price: 1 }, // over-weight, will be sold
        { assetId: 'equityB', quantity: 0, price: 1 }, // under-weight, will be bought
        { assetId: 'equityC', quantity: 0, price: 1 }, // under-weight, will be bought
      ],
      modelAllocations: [
        { assetId: 'cash', percentAllocated: 0 },
        { assetId: 'equityA', percentAllocated: 0 },
        { assetId: 'equityB', percentAllocated: 50 },
        { assetId: 'equityC', percentAllocated: 50 },
      ],
      minimumTradeValue: 10,
    });

    const sell = result.orders.find((o) => o.assetId === 'equityA');
    expect(sell?.side).toBe('SELL');
    expect(sell?.value).toBeCloseTo(1000, 2);

    const buyB = result.orders.find((o) => o.assetId === 'equityB');
    const buyC = result.orders.find((o) => o.assetId === 'equityC');
    // Split evenly since both are equally under-weight relative to the same total.
    expect(buyB?.value).toBeCloseTo(500, 2);
    expect(buyC?.value).toBeCloseTo(500, 2);
  });

  it('applies de-minimis so tiny drifts do not generate orders', () => {
    // With cash and equityA as the only two holdings, total value = 1000.
    // Target: cash 0 (100% equityA), so equityA's target is 1000 but it's
    // only holding 997 - a $3 drift, comfortably inside the $5 de-minimis
    // band, so neither asset should generate an order.
    const result = calculateRebalance({
      holdings: [
        { assetId: 'cash', quantity: 3, price: null, isCash: true },
        { assetId: 'equityA', quantity: 997, price: 1 },
      ],
      modelAllocations: [
        { assetId: 'cash', percentAllocated: 0 },
        { assetId: 'equityA', percentAllocated: 100 },
      ],
      minimumTradeValue: 5,
    });

    expect(result.orders).toHaveLength(0);
    expect(result.skippedBelowDeMinimis).toContain('equityA');
  });
});

describe('validateModelAllocation', () => {
  it('accepts allocations that sum to exactly 100', () => {
    const res = validateModelAllocation([
      { assetId: 'cash', percentAllocated: 20 },
      { assetId: 'equityA', percentAllocated: 80 },
    ]);
    expect(res.valid).toBe(true);
    expect(res.total).toBe(100);
  });

  it('rejects allocations that do not sum to 100', () => {
    const res = validateModelAllocation([{ assetId: 'cash', percentAllocated: 50 }]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('sum to 100'))).toBe(true);
  });

  it('rejects duplicate asset entries', () => {
    const res = validateModelAllocation([
      { assetId: 'cash', percentAllocated: 50 },
      { assetId: 'cash', percentAllocated: 50 },
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('more than once'))).toBe(true);
  });
});

describe('isValidModelReference', () => {
  it('allows letters, digits, dash and underscore', () => {
    expect(isValidModelReference('BAL-GROWTH_01')).toBe(true);
  });

  it('rejects spaces', () => {
    expect(isValidModelReference('BAL GROWTH')).toBe(false);
  });
});

describe('isValidChargePercent', () => {
  it('caps DFM charge at 10%', () => {
    expect(isValidChargePercent(10)).toBe(true);
    expect(isValidChargePercent(10.5)).toBe(false);
  });
});
