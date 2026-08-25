/**
 * Rebalance calculation engine, implementing the algorithm described in
 * guide section 4.2.4.1 "Rebalance Algorithms":
 *
 *  1. Total account value = sum of (price * quantity) across holdings + cash.
 *  2. Real allocation per asset = current asset value / total account value.
 *  3. Target value per asset = total account value * model allocation %.
 *  4. Cash difference per asset = target value - current value.
 *  5. Treat the cash difference as the value of a future order per asset.
 *  6. Apply de-minimis: differences smaller than the model's minimum trade
 *     value are dropped (no order generated for that asset).
 *  7. diff > 0 => BUY, diff < 0 => SELL.
 *  8. Sell order quantity = abs(diff) / price.
 *  9. Cash available for buys = sum of the (surviving) sell order values.
 *  10. Each buy order's share of that cash = its diff / sum(all buy diffs).
 *  11. Buy order quantity = (share * cash available) / price.
 *
 * This is deliberately a pure function with no I/O, so it can be unit
 * tested in isolation from the database and reused by both the backend
 * (to actually generate orders) and the frontend (to preview a rebalance
 * before submitting it).
 */

export interface RebalanceHolding {
  assetId: string;
  /** Current quantity held. 0 (or omitted) for an asset the account doesn't hold yet. */
  quantity: number;
  /** Indicative mid-price. Required for every non-cash asset. */
  price: number | null;
  isCash?: boolean;
}

export interface RebalanceModelAllocation {
  assetId: string;
  /** Target allocation percentage, 0-100. */
  percentAllocated: number;
}

export interface RebalanceInput {
  holdings: RebalanceHolding[];
  modelAllocations: RebalanceModelAllocation[];
  minimumTradeValue: number;
}

export type RebalanceOrderSide = 'BUY' | 'SELL';

export interface RebalanceOrder {
  assetId: string;
  side: RebalanceOrderSide;
  /** Cash value of the order (positive). */
  value: number;
  /** Units to trade, when a price is known. Null if it can't be computed (e.g. missing price). */
  units: number | null;
}

export interface RebalanceResult {
  totalAccountValue: number;
  orders: RebalanceOrder[];
  /** Assets whose computed difference was inside the de-minimis band, so no order was raised. */
  skippedBelowDeMinimis: string[];
  /** Assets that would need a price to trade but have none. */
  skippedMissingPrice: string[];
}

function currentValue(h: RebalanceHolding): number {
  if (h.isCash) return h.quantity;
  if (h.price == null) return 0;
  return h.quantity * h.price;
}

export function calculateRebalance(input: RebalanceInput): RebalanceResult {
  const { holdings, modelAllocations, minimumTradeValue } = input;

  // Step 1: total account value.
  const totalAccountValue = holdings.reduce((sum, h) => sum + currentValue(h), 0);

  const holdingsByAsset = new Map(holdings.map((h) => [h.assetId, h]));
  const skippedMissingPrice: string[] = [];
  const skippedBelowDeMinimis: string[] = [];

  // Steps 2-6: per-asset cash difference vs. target, with de-minimis applied.
  const diffs: { assetId: string; diff: number; price: number | null; isCash: boolean }[] = [];

  for (const alloc of modelAllocations) {
    const holding = holdingsByAsset.get(alloc.assetId);
    const isCash = holding?.isCash ?? false;
    const current = holding ? currentValue(holding) : 0;
    const target = totalAccountValue * (alloc.percentAllocated / 100);
    const diff = target - current;

    if (!isCash && (holding?.price == null) && Math.abs(diff) > minimumTradeValue) {
      skippedMissingPrice.push(alloc.assetId);
      continue;
    }

    if (Math.abs(diff) < minimumTradeValue) {
      if (Math.abs(diff) > 0) skippedBelowDeMinimis.push(alloc.assetId);
      continue;
    }

    diffs.push({ assetId: alloc.assetId, diff, price: holding?.price ?? null, isCash });
  }

  // Steps 7-8: sells first, sized directly from their own diff.
  const sells = diffs.filter((d) => d.diff < 0 && !d.isCash);
  const sellOrders: RebalanceOrder[] = sells.map((s) => ({
    assetId: s.assetId,
    side: 'SELL',
    value: Math.abs(s.diff),
    units: s.price ? Math.abs(s.diff) / s.price : null,
  }));

  // Step 9: cash raised from sells is what funds the buys.
  const cashAvailableForBuys = sellOrders.reduce((sum, o) => sum + o.value, 0);

  // Steps 10-11: buys share the available cash proportionally to their diff.
  const buys = diffs.filter((d) => d.diff > 0 && !d.isCash);
  const totalBuyDiff = buys.reduce((sum, b) => sum + b.diff, 0);

  const buyOrders: RebalanceOrder[] = buys.map((b) => {
    const share = totalBuyDiff > 0 ? b.diff / totalBuyDiff : 0;
    const value = share * cashAvailableForBuys;
    return {
      assetId: b.assetId,
      side: 'BUY',
      value,
      units: b.price ? value / b.price : null,
    };
  });

  // Guide: "When placing orders, first sell orders are made, followed by buy orders."
  return {
    totalAccountValue,
    orders: [...sellOrders, ...buyOrders],
    skippedBelowDeMinimis,
    skippedMissingPrice,
  };
}
