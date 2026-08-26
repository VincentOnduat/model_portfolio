import {
  AccountType,
  AllocationListStatus,
  AllocationListType,
  AssetSector,
  ExclusionReason,
  FailureReason,
  ModelAim,
  ModelLockState,
  ModelRisk,
  ModelStatus,
  OrderSide,
  Role,
  SharingKind,
  SharingScope,
} from './enums.js';

export interface Firm {
  id: string;
  name: string;
  /** Null for a root/top-level firm. Enables the parent -> child Enterprise sharing tree. */
  parentFirmId: string | null;
  isThirdParty: boolean;
}

/** A signed contract permitting the owner firm to share models with the third party firm. */
export interface FirmContract {
  id: string;
  ownerFirmId: string;
  thirdPartyFirmId: string;
  signedAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  firmId: string;
}

export interface Asset {
  id: string;
  name: string;
  isin: string;
  type: string;
  sector: AssetSector;
  /** True for the single synthetic "cash" asset every model carries. */
  isCash: boolean;
  lastPrice: number | null;
  isTradeable: boolean;
  isRestricted: boolean;
}

export interface ModelAsset {
  assetId: string;
  asset: Asset;
  /** Last saved allocation percentage (0-100), the guide's "% Allocated". */
  percentAllocated: number;
}

export interface ModelSummary {
  id: string;
  reference: string;
  name: string;
  status: ModelStatus;
  lockState: ModelLockState;
  lockedByUserId: string | null;
  aim: ModelAim;
  risk: ModelRisk;
  minimumTradeValue: number;
  accountsAttachedCount: number;
  ownerFirmId: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  /** Empty means any account type is eligible to attach - guide 4.1.4 suitability. */
  eligibleAccountTypes: AccountType[];
}

export interface ModelDetail extends ModelSummary {
  chargePercent: number | null;
  vatIncluded: boolean | null;
  assets: ModelAsset[];
  createdByUserId: string;
  updatedByUserId: string;
}

export interface ClientAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  clientName: string;
  clientNumber: string;
  adviserUserId: string;
  adviserFirmId: string;
  /** Model this account is currently attached to, if any (an account may belong to only one). */
  linkedModelId: string | null;
  dateLinked: string | null;
  availableCash: number;
  cashAccountBalance: number;
  lastRebalanceDate: string | null;
  accountType: AccountType;
  hasConsent: boolean;
  /**
   * Present only when the list was fetched with a `modelId` filter - whether
   * this account could be attached to that specific model right now, and why
   * not (see `isAccountEligibleForModel` in validation.ts).
   */
  eligible?: boolean;
  ineligibleReason?: string;
}

export interface SharingGrant {
  id: string;
  modelId: string;
  scope: SharingScope;
  kind: SharingKind;
  /** Target user (FIRM scope) or target firm (ENTERPRISE / THIRD_PARTY scope). */
  granteeUserId: string | null;
  granteeFirmId: string | null;
  canAttachAccounts: boolean;
  canAllocateMoney: boolean;
  canRebalance: boolean;
  canEditModel: boolean;
  allowOnwardShare: boolean;
}

export interface AllocationListSummary {
  id: string;
  reference: string;
  name: string;
  type: AllocationListType;
  status: AllocationListStatus;
  createdByUserId: string;
  createdAt: string;
  accountCount: number;
  hasExclusions: boolean;
  hasFailures: boolean;
}

export interface AllocationListAccount {
  accountId: string;
  modelId: string;
  /** Money Allocation only: how much of the client's available cash to invest. */
  allocateAll: boolean | null;
  allocationAmount: number | null;
}

export interface OrderLine {
  id: string;
  allocationListId: string;
  accountId: string;
  assetId: string;
  side: OrderSide;
  units: number | null;
  value: number;
  lastPrice: number | null;
  belowMinTrade: boolean;
}

export interface Exclusion {
  id: string;
  allocationListId: string;
  accountId: string | null;
  assetId: string | null;
  reason: ExclusionReason;
  detail: string;
}

export interface Failure {
  id: string;
  allocationListId: string;
  accountId: string | null;
  assetId: string | null;
  reason: FailureReason;
  detail: string;
}

/** Standard error envelope returned by the API. */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

/** Standard page envelope returned by list endpoints that support pagination. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
