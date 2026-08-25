import { Permission, Role } from './enums.js';

/**
 * Static role -> permission matrix, modelled on the guide's Table 1
 * "Users' types and their permissions".
 *
 * Notes carried over from the guide:
 *  - ALLOCATE_MONEY / REBALANCE / ADD_EDIT_CLIENT_ACCOUNTS / ADD_EDIT_ASSETS / EDIT_MODEL
 *    for "standard" adviser/third-party users are additionally gated per-model by the
 *    sharing grant a model owner makes to them ("Set by Model Owner" in the guide) -
 *    see packages/shared/src/types.ts SharingGrant. The matrix below is the *ceiling*:
 *    a standard user can never exceed it even if a model owner grants more.
 *  - Third-party users never get EDIT_MODEL (guide 4.1.5.3: "there is no Edit
 *    permission possible" for third-party sharing).
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.PLATFORM_ADMIN]: Object.values(Permission),

  [Role.PLATFORM_SUPPORT]: [
    Permission.DASHBOARD_ACCESS,
    Permission.MODEL_MANAGEMENT_ACCESS,
    Permission.ALLOCATION_ACCESS,
    Permission.PLATFORM_ADMIN_ACCESS,
  ],

  [Role.ADVISER_MODEL_OWNER]: [
    Permission.DASHBOARD_ACCESS,
    Permission.MODEL_MANAGEMENT_ACCESS,
    Permission.ALLOCATION_ACCESS,
    Permission.CREATE_MODEL,
    Permission.EDIT_MODEL,
    Permission.DELETE_MODEL,
    Permission.LOCK_MODEL,
    Permission.ADD_EDIT_ASSETS,
    Permission.ADD_EDIT_CLIENT_ACCOUNTS,
    Permission.ALLOCATE_MONEY,
    Permission.REBALANCE,
    Permission.DELETE_ALLOCATION_LIST,
    Permission.SHARE_MY_FIRM,
    Permission.SHARE_ENTERPRISE,
    Permission.SHARE_THIRD_PARTY,
  ],

  [Role.ADVISER_STANDARD]: [
    Permission.DASHBOARD_ACCESS,
    Permission.MODEL_MANAGEMENT_ACCESS,
    Permission.ALLOCATION_ACCESS,
    // ALLOCATE_MONEY / REBALANCE / ADD_EDIT_CLIENT_ACCOUNTS / ADD_EDIT_ASSETS / EDIT_MODEL
    // are granted per-model via a SharingGrant ("Set by Model Owner").
  ],

  [Role.THIRD_PARTY_MODEL_OWNER]: [
    Permission.DASHBOARD_ACCESS,
    Permission.MODEL_MANAGEMENT_ACCESS,
    Permission.ALLOCATION_ACCESS,
    Permission.CREATE_MODEL,
    Permission.EDIT_MODEL,
    Permission.DELETE_MODEL,
    Permission.LOCK_MODEL,
    Permission.ADD_EDIT_ASSETS,
    Permission.ADD_EDIT_CLIENT_ACCOUNTS,
    Permission.ALLOCATE_MONEY,
    Permission.REBALANCE,
    Permission.DELETE_ALLOCATION_LIST,
    Permission.SHARE_THIRD_PARTY,
  ],

  [Role.THIRD_PARTY_STANDARD]: [
    Permission.DASHBOARD_ACCESS,
    Permission.MODEL_MANAGEMENT_ACCESS,
    Permission.ALLOCATION_ACCESS,
    // Same per-model grant caveat as ADVISER_STANDARD, minus EDIT_MODEL (never
    // available to third-party users per guide 4.1.5.3).
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Roles that can own/create models at all (before any per-model grant is considered). */
export const MODEL_OWNER_ROLES = [Role.ADVISER_MODEL_OWNER, Role.THIRD_PARTY_MODEL_OWNER];
