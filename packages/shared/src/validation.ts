/**
 * Domain validation rules shared by the API (authoritative) and the frontend
 * (fast inline feedback), so the two never drift apart.
 */

import type { AccountType } from './enums.js';

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

export interface AccountEligibilityInput {
  hasConsent: boolean;
  accountType: AccountType;
}

export interface ModelEligibilityInput {
  /** Empty means "no restriction" - any account type is eligible. */
  eligibleAccountTypes: AccountType[];
}

export interface AccountEligibilityResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Guide 4.1.4: an account can only be attached to a model when the client
 * has given consent AND the account's wrapper type is one the model
 * accepts (an empty `eligibleAccountTypes` on the model means "any type").
 * Checked both server-side (the enforcement point, in
 * clientAccounts.routes.ts) and client-side (to grey out ineligible rows
 * before a round-trip, in ClientAccountsTab.tsx).
 */
export function isAccountEligibleForModel(
  account: AccountEligibilityInput,
  model: ModelEligibilityInput,
): AccountEligibilityResult {
  if (!account.hasConsent) {
    return { eligible: false, reason: 'Client has not given consent for this account.' };
  }
  if (model.eligibleAccountTypes.length > 0 && !model.eligibleAccountTypes.includes(account.accountType)) {
    return {
      eligible: false,
      reason: `This model only accepts ${model.eligibleAccountTypes.join('/')} accounts.`,
    };
  }
  return { eligible: true };
}
