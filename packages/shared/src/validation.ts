/**
 * Domain validation rules shared by the API (authoritative) and the frontend
 * (fast inline feedback), so the two never drift apart.
 */

export const ALLOCATION_TOTAL_TARGET = 100;
/** Floating point tolerance when comparing summed percentages to 100. */
export const ALLOCATION_TOLERANCE = 0.005;

export interface AllocationEntry {
  assetId: string;
  percentAllocated: number;
}

export interface AllocationValidationResult {
  valid: boolean;
  total: number;
  errors: string[];
}

/**
 * Guide 4.1.3 "Assets": "The sum of all allocations must equal 100%. It is
 * not possible to save a model when the allocation is set to a different
 * value." Also enforces 0-100 bounds per line and no duplicate assets.
 */
export function validateModelAllocation(entries: AllocationEntry[]): AllocationValidationResult {
  const errors: string[] = [];

  if (entries.length === 0) {
    errors.push('A model must have at least one asset allocated (cash counts as an asset).');
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.assetId)) {
      errors.push(`Asset ${entry.assetId} is allocated more than once.`);
    }
    seen.add(entry.assetId);

    if (entry.percentAllocated < 0 || entry.percentAllocated > 100) {
      errors.push(`Allocation for asset ${entry.assetId} must be between 0 and 100.`);
    }
  }

  const total = entries.reduce((sum, e) => sum + e.percentAllocated, 0);
  if (Math.abs(total - ALLOCATION_TOTAL_TARGET) > ALLOCATION_TOLERANCE) {
    errors.push(`Allocations must sum to 100% (currently ${total.toFixed(2)}%).`);
  }

  return { valid: errors.length === 0, total, errors };
}

/**
 * Guide Table 2 "Model Details": a model reference may contain letters,
 * digits, dash and underscore - no spaces - and must be unique (uniqueness
 * is enforced at the database layer).
 */
const MODEL_REFERENCE_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isValidModelReference(reference: string): boolean {
  return reference.length > 0 && reference.length <= 32 && MODEL_REFERENCE_PATTERN.test(reference);
}

/** Guide Table 2: DFM charge "cannot be greater than 10%". */
export const MAX_CHARGE_PERCENT = 10;

export function isValidChargePercent(chargePercent: number): boolean {
  return chargePercent >= 0 && chargePercent <= MAX_CHARGE_PERCENT;
}
