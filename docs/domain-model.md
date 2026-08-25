# Domain model

This scaffold's domain is modelled directly on the *Model Portfolio User Guide*
supplied when this repo was generated. This document maps each guide concept
to where it lives in the code, and calls out what's fully implemented versus
stubbed for follow-up work.

## Roles & permissions (guide chapter "User")

The guide lists six user types. This scaffold generalises their names (no
platform branding) but keeps the same shape:

| Guide role | Code (`Role` enum) | Notes |
|---|---|---|
| IFDL Super User (platform administrator) | `PLATFORM_ADMIN` | All permissions. |
| IFDL User | `PLATFORM_SUPPORT` | Platform config access, no model ownership. |
| Professional User - Model Owner | `ADVISER_MODEL_OWNER` | Owns/creates models within their firm. |
| Professional User - Standard | `ADVISER_STANDARD` | Needs a per-model `SharingGrant` to do anything beyond viewing. |
| Third Party - Model Owner | `THIRD_PARTY_MODEL_OWNER` | Same as adviser owner, but for external firms; can never receive `canEditModel` via sharing. |
| Third Party - Standard | `THIRD_PARTY_STANDARD` | Same caveat as adviser standard, minus edit rights. |

Source of truth: `packages/shared/src/enums.ts` (`Role`, `Permission`) and
`packages/shared/src/permissions.ts` (`ROLE_PERMISSIONS`, the static ceiling
matrix modelled on the guide's Table 1). Route-level enforcement is
`apps/backend/src/middleware/auth.ts#requirePermission`; per-model overrides
(sharing grants) are checked in `apps/backend/src/services/models.service.ts#assertCanEditModel`.

## Models & assets (guide 4.1.1 - 4.1.3)

| Guide concept | Code |
|---|---|
| Model (Draft/Live, Locked/Unlocked, Aim, Risk, Minimum Trade Value, Charge/VAT) | `Model` (Prisma), `ModelDetail`/`ModelSummary` (shared types) |
| "Assets Allocated to this Model" / percentage rule (sum to 100%) | `ModelAsset` (Prisma), validated by `validateModelAllocation` (`packages/shared/src/validation.ts`) - checked both client-side (`AssetsTab.tsx`) and server-side (`models.service.ts#setModelAllocation`/`publishModel`) |
| Publish (Draft -> Live) | `POST /api/models/:id/publish` |
| Lock/Unlock for editing | `POST /api/models/:id/lock` / `/unlock` |
| Delete rules (drafts always; live only with zero attached accounts) | `models.service.ts#deleteModel` |

**Status: fully implemented** (the scaffold's "vertical slice").

## Client accounts (guide 4.1.4)

`ClientAccount` (Prisma) with `linkedModelId` enforcing "attached to only one
model". Listing/searching/attach/detach are implemented
(`apps/backend/src/routes/clientAccounts.routes.ts`).

**Status: fully implemented**, including client-consent gating and
account-type/model suitability: `ClientAccount.hasConsent` /
`ClientAccount.accountType` (`AccountType` enum: ISA/GIA/SIPP/OTHER) against
`Model.eligibleAccountTypes` (empty = no restriction), checked by the pure
`isAccountEligibleForModel` (`packages/shared/src/validation.ts`) - both
client-side, to grey out ineligible rows in `ClientAccountsTab.tsx` before a
round-trip, and server-side (the enforcement point) in `POST
/client-accounts/attach`, which rejects ineligible accounts by name/reason
rather than silently no-op'ing them.

## Sharing (guide 4.1.5)

| Guide concept | Code |
|---|---|
| Scope: My Firm's / Enterprise / Third Party | `SharingScope` enum |
| Default vs. bespoke grants | `SharingKind` enum |
| Permission flags (Attach/Remove, Allocate Money, Rebalance, Edit Model, Allow Onward Share) | Columns on `SharingGrant` |
| "No Edit permission possible" for third-party | Enforced in `sharing.routes.ts` (rejects `canEditModel: true` when `scope: THIRD_PARTY`) |

**Status: fully implemented.** Reads and grant create/revoke work end to
end, including the Enterprise hierarchy walk and Third Party contract
restriction: `services/firms.service.ts#isDescendantFirm` walks a firm's
`parentFirmId` chain to confirm an Enterprise grantee sits below the model
owner's firm in the org chart, and `hasSignedContract` checks the new
`FirmContract` model (a directed, per-firm-pair "signed contract" - guide
4.1.5's "restricted to firms with a signed contract") before a Third Party
grant is allowed. `sharing.routes.ts` enforces both in `POST /`, and a new
`GET .../sharing/eligible-grantees` endpoint feeds `SharingTab.tsx`'s
grantee picker so the frontend only ever offers a valid choice instead of a
raw UUID field the caller has to guess.

## Money Allocation / Rebalance (guide 4.2)

This is the guide's core workflow and the scaffold implements the actual
calculation engines, not just the CRUD shell around them:

| Guide concept | Code |
|---|---|
| Step 1: Select Accounts | `POST /api/allocation-lists` (`allocationLists.service.ts#createAllocationList`) |
| Step 2: Generate Orders | `POST /api/allocation-lists/:id/generate-orders` |
| Rebalance algorithm (guide 4.2.4.1, all 11 steps) | `packages/shared/src/rebalance.ts#calculateRebalance` - pure function, unit tested in `packages/shared/src/__tests__/rebalance.test.ts` |
| Money Allocation math (buy-only, split by model %) | `packages/shared/src/money-allocation.ts#calculateMoneyAllocation` |
| "Below Min Trade" orders kept but not executed | `belowMinTrade` flag on `OrderLine`, set in `generateOrders` |
| Step 2: Remove Potential Orders | `POST /api/allocation-lists/:id/remove-orders` |
| Step 3: Confirm/Trade Confirmation | `POST /api/allocation-lists/:id/confirm-orders` |
| List statuses (guide's 5-state flow) | `AllocationListStatus` enum |

**Partially implemented.** The calculation engines and the full Step
1->2->3 status flow work against seeded data (see the demo account seeded
with deliberately drifted holdings in `apps/backend/prisma/seed.ts`).

Exclusions/Failures *generation* (guide 4.2.5/4.2.6) now writes real rows
for the subset of the ~23 named reasons that's grounded in data this schema
actually has, in `allocationLists.service.ts#generateOrders`:

| Reason | Trigger | List type it's recorded against |
|---|---|---|
| `ACCOUNT_NOT_ATTACHED_TO_MODEL` | Account was detached from its model after being added to the list | Both (Exclusion) |
| `CLIENT_DOCUMENTATION_INCOMPLETE` | `ClientAccount.hasConsent` is false | Both (Exclusion) |
| `ASSET_NOT_TRADEABLE` | `Asset.isTradeable` is false | Money Allocation (Exclusion) |
| `RESTRICTED_ASSET` | `Asset.isRestricted` is true, on a buy | Money Allocation (Exclusion) |
| `NO_PRICE_AVAILABLE` | Non-cash asset with no `lastPrice`, on a buy | Money Allocation (Exclusion) |
| `RESTRICTED_ASSET_CANNOT_SELL` | `Asset.isRestricted` is true, on a sell | Rebalance (Failure) |
| `NO_PRICE_FOR_ASSET` | Non-cash asset with no `lastPrice` | Rebalance (Failure) |
| `NO_ORDERS_GENERATED` | Zero orders survived generation | Both (Failure) - previously thrown as an opaque 422; now a real row, and the request still succeeds so the frontend's Exclusions/Failures panel can explain why |

Money Allocation only ever produces buys, so its asset-level issues use
`ExclusionReason`'s buy-oriented values; Rebalance produces both buys and
sells, so its asset-level issues use the richer, dealing-oriented
`FailureReason` values instead. Demoable via the seeded "Exclusions Demo"
model/account (`apps/backend/prisma/seed.ts`) and unit-tested in
`apps/backend/src/__tests__/allocationLists.service.test.ts`.

**Still not implemented**: the remaining ~15 reasons name concepts this
scaffold has no data for at all - CREST status, deal-status workflows,
charges setup, a documentation-completeness workflow beyond consent, etc.
Each remaining `ExclusionReason`/`FailureReason` enum value in
`packages/shared/src/enums.ts` is still named after its guide bullet point,
so the mapping stays easy for whoever adds the schema/logic for those next.

## Holdings

The guide's Rebalance algorithm needs each client account's *current* asset
quantities to compare against the model's target. This scaffold adds a
`Holding` model (account x asset -> quantity) that the original guide text
doesn't name explicitly but is implied by "the model's balance may differ
from the model assumption" - see `apps/backend/prisma/schema.prisma`.
