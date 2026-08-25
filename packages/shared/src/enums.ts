/**
 * Domain enums shared between backend and frontend.
 *
 * These map directly onto the concepts described in the Model Portfolio
 * User Guide: model lifecycle, asset allocation, sharing scopes, and the
 * Money Allocation / Rebalance order-generation workflow.
 *
 * Implementation note: these are modelled as `as const` objects + derived
 * union types rather than TypeScript `enum`s. Prisma Client generates its
 * own enums the same way (a const object of string literals + a type alias
 * over its values) rather than as real TS enums. Real TS enums create a
 * *nominal* type - a value typed as our `enum Role` is NOT assignable to a
 * plain string-literal union even when the runtime strings match exactly
 * (a well-known TS gotcha), which would make every value crossing the
 * boundary between this package and Prisma's generated types need a cast.
 * Using the same const-object pattern Prisma uses keeps both sides
 * structurally compatible for free.
 */

// The `const` modifier (TS 5.0+) is load-bearing here: without it, generic
// inference from an object-literal argument widens each property's value to
// `string`, which defeats the whole point of this helper (every "enum" below
// would silently type as `string` instead of a literal union - exactly the
// bug this comment block above is warning against).
function asConst<const T extends Record<string, string>>(obj: T): T {
  return obj;
}

/** The six user types described in the guide's "User" chapter, generalised. */
export const Role = asConst({
  /** Platform-level administrator (guide: "IFDL Super User"). Manages the platform itself. */
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  /** Platform-level support/config user (guide: "IFDL User"). */
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',
  /** Adviser firm user who owns models (guide: "Professional User - Model Owner"). */
  ADVISER_MODEL_OWNER: 'ADVISER_MODEL_OWNER',
  /** Adviser firm user without model-ownership rights (guide: "Professional User - Standard"). */
  ADVISER_STANDARD: 'ADVISER_STANDARD',
  /** External/third-party firm user who owns models shared out to other firms. */
  THIRD_PARTY_MODEL_OWNER: 'THIRD_PARTY_MODEL_OWNER',
  /** External/third-party firm user without model-ownership rights. */
  THIRD_PARTY_STANDARD: 'THIRD_PARTY_STANDARD',
});
export type Role = (typeof Role)[keyof typeof Role];

/** Fine-grained permissions checked by RBAC middleware and used to render UI affordances. */
export const Permission = asConst({
  DASHBOARD_ACCESS: 'DASHBOARD_ACCESS',
  MODEL_MANAGEMENT_ACCESS: 'MODEL_MANAGEMENT_ACCESS',
  ALLOCATION_ACCESS: 'ALLOCATION_ACCESS',
  CREATE_MODEL: 'CREATE_MODEL',
  EDIT_MODEL: 'EDIT_MODEL',
  DELETE_MODEL: 'DELETE_MODEL',
  LOCK_MODEL: 'LOCK_MODEL',
  ADD_EDIT_ASSETS: 'ADD_EDIT_ASSETS',
  ADD_EDIT_CLIENT_ACCOUNTS: 'ADD_EDIT_CLIENT_ACCOUNTS',
  ALLOCATE_MONEY: 'ALLOCATE_MONEY',
  REBALANCE: 'REBALANCE',
  DELETE_ALLOCATION_LIST: 'DELETE_ALLOCATION_LIST',
  SHARE_MY_FIRM: 'SHARE_MY_FIRM',
  SHARE_ENTERPRISE: 'SHARE_ENTERPRISE',
  SHARE_THIRD_PARTY: 'SHARE_THIRD_PARTY',
  PLATFORM_ADMIN_ACCESS: 'PLATFORM_ADMIN_ACCESS',
});
export type Permission = (typeof Permission)[keyof typeof Permission];

/** Model lifecycle status (guide 4.1.2 "Model Status"). */
export const ModelStatus = asConst({
  DRAFT: 'DRAFT',
  LIVE: 'LIVE',
});
export type ModelStatus = (typeof ModelStatus)[keyof typeof ModelStatus];

/** Model editing lock state (guide 4.1.2 "Model State"). */
export const ModelLockState = asConst({
  LOCKED: 'LOCKED',
  UNLOCKED: 'UNLOCKED',
});
export type ModelLockState = (typeof ModelLockState)[keyof typeof ModelLockState];

/** Investment aim, selected from a managed dropdown (guide Table 2). */
export const ModelAim = asConst({
  BALANCE: 'BALANCE',
  GROWTH: 'GROWTH',
  BALANCED_AND_GROWTH: 'BALANCED_AND_GROWTH',
  INCOME_AND_GROWTH: 'INCOME_AND_GROWTH',
  INCOME: 'INCOME',
  NOT_SPECIFIED: 'NOT_SPECIFIED',
});
export type ModelAim = (typeof ModelAim)[keyof typeof ModelAim];

/** Risk profile, selected from a managed dropdown (guide Table 2). */
export const ModelRisk = asConst({
  HIGH: 'HIGH',
  LOW: 'LOW',
  LOW_MEDIUM: 'LOW_MEDIUM',
  MEDIUM: 'MEDIUM',
  MEDIUM_HIGH: 'MEDIUM_HIGH',
  NOT_SPECIFIED: 'NOT_SPECIFIED',
});
export type ModelRisk = (typeof ModelRisk)[keyof typeof ModelRisk];

/** Broad asset sector classification (guide 4.1.3 "Assets"). */
export const AssetSector = asConst({
  EQUITY: 'EQUITY',
  BOND: 'BOND',
  WARRANT: 'WARRANT',
  FUND: 'FUND',
  CASH: 'CASH',
  OTHER: 'OTHER',
});
export type AssetSector = (typeof AssetSector)[keyof typeof AssetSector];

/** Account wrapper type (guide 4.1.4), checked against a model's `eligibleAccountTypes`. */
export const AccountType = asConst({
  ISA: 'ISA',
  GIA: 'GIA',
  SIPP: 'SIPP',
  OTHER: 'OTHER',
});
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

/**
 * The three sharing scopes described in guide 4.1.5:
 *  - FIRM: sharing within the model owner's own firm (default or bespoke permissions)
 *  - ENTERPRISE: sharing down an internal parent -> child team hierarchy
 *  - THIRD_PARTY: sharing with an external firm once a contract is in place
 */
export const SharingScope = asConst({
  FIRM: 'FIRM',
  ENTERPRISE: 'ENTERPRISE',
  THIRD_PARTY: 'THIRD_PARTY',
});
export type SharingScope = (typeof SharingScope)[keyof typeof SharingScope];

/** Whether a firm-sharing grant is a blanket default or a bespoke per-user override. */
export const SharingKind = asConst({
  DEFAULT: 'DEFAULT',
  BESPOKE: 'BESPOKE',
});
export type SharingKind = (typeof SharingKind)[keyof typeof SharingKind];

/** The two order-generation procedures (guide 4.2). */
export const AllocationListType = asConst({
  MONEY_ALLOCATION: 'MONEY_ALLOCATION',
  REBALANCE: 'REBALANCE',
});
export type AllocationListType = (typeof AllocationListType)[keyof typeof AllocationListType];

/**
 * Allocation/Rebalance list status, matching the 3-step wizard in guide 4.2.2/4.2.3/4.2.4:
 *  Step 1 -> CLIENT_ACCOUNTS_SELECTED
 *  Step 2 -> GENERATING_ORDERS -> POTENTIAL_ORDERS_GENERATED
 *  Step 3 -> SENDING_ORDERS -> ORDERS_SUBMITTED
 */
export const AllocationListStatus = asConst({
  CLIENT_ACCOUNTS_SELECTED: 'CLIENT_ACCOUNTS_SELECTED',
  GENERATING_ORDERS: 'GENERATING_ORDERS',
  POTENTIAL_ORDERS_GENERATED: 'POTENTIAL_ORDERS_GENERATED',
  SENDING_ORDERS: 'SENDING_ORDERS',
  ORDERS_SUBMITTED: 'ORDERS_SUBMITTED',
});
export type AllocationListStatus = (typeof AllocationListStatus)[keyof typeof AllocationListStatus];

export const OrderSide = asConst({
  BUY: 'BUY',
  SELL: 'SELL',
});
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

/** Reasons an order/account was excluded before submission (guide 4.2.5). */
export const ExclusionReason = asConst({
  ASSET_NOT_TRADEABLE: 'ASSET_NOT_TRADEABLE',
  RESTRICTED_ASSET: 'RESTRICTED_ASSET',
  NO_PRICE_AVAILABLE: 'NO_PRICE_AVAILABLE',
  BELOW_MINIMUM_TRADE_VALUE: 'BELOW_MINIMUM_TRADE_VALUE',
  ACCOUNT_NOT_ATTACHED_TO_MODEL: 'ACCOUNT_NOT_ATTACHED_TO_MODEL',
  CLIENT_DOCUMENTATION_INCOMPLETE: 'CLIENT_DOCUMENTATION_INCOMPLETE',
});
export type ExclusionReason = (typeof ExclusionReason)[keyof typeof ExclusionReason];

/** Reasons a submitted order failed to execute (guide 4.2.6). */
export const FailureReason = asConst({
  ASSET_CANNOT_BE_TRADED: 'ASSET_CANNOT_BE_TRADED',
  NO_PURCHASE_ALLOWED: 'NO_PURCHASE_ALLOWED',
  RESTRICTED_ASSET_CANNOT_SELL: 'RESTRICTED_ASSET_CANNOT_SELL',
  NO_PRICE_FOR_ASSET: 'NO_PRICE_FOR_ASSET',
  UNEXECUTED_OR_UNSETTLED_TRANSACTIONS: 'UNEXECUTED_OR_UNSETTLED_TRANSACTIONS',
  NO_HOLDING_OR_CASH_AVAILABLE: 'NO_HOLDING_OR_CASH_AVAILABLE',
  ACCOUNT_CLOSED: 'ACCOUNT_CLOSED',
  CLIENT_DOCUMENTATION_NOT_COMPLETE: 'CLIENT_DOCUMENTATION_NOT_COMPLETE',
  DEAL_STATUS_DISABLED: 'DEAL_STATUS_DISABLED',
  ACCOUNT_WRAPPER_RESTRICTION: 'ACCOUNT_WRAPPER_RESTRICTION',
  INCOMPLETE_SETUP: 'INCOMPLETE_SETUP',
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  ASSET_START_DATE_IN_FUTURE: 'ASSET_START_DATE_IN_FUTURE',
  CHARGES_NOT_SET_UP: 'CHARGES_NOT_SET_UP',
  UNABLE_TO_GENERATE_ORDERS: 'UNABLE_TO_GENERATE_ORDERS',
  ACCOUNT_NO_LONGER_ATTACHED_TO_MODEL: 'ACCOUNT_NO_LONGER_ATTACHED_TO_MODEL',
  NO_ORDERS_GENERATED: 'NO_ORDERS_GENERATED',
});
export type FailureReason = (typeof FailureReason)[keyof typeof FailureReason];
