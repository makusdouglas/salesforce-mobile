import { useMemo } from 'react';

import { useRoles } from '../hooks/useRoles';
import type { AdminSessionRole, SessionRole } from './session';

// Pure predicates, exported for unit testing without a React renderer.

// A 'superuser' (or legacy 'admin' alias) implies every admin-grade
// role, so holding it satisfies any required module-specific role.
export function impliesSuperuser(roles: readonly SessionRole[]): boolean {
  return roles.includes('superuser') || roles.includes('admin');
}

export function hasAdminGate(
  roles: readonly SessionRole[],
  required: AdminSessionRole,
): boolean {
  if (impliesSuperuser(roles)) return true;
  return roles.includes(required);
}

export function hasAnyAdminRole(roles: readonly SessionRole[]): boolean {
  if (impliesSuperuser(roles)) return true;
  return (
    roles.includes('manage-products') ||
    roles.includes('manage-salespersons') ||
    roles.includes('manage-clients')
  );
}

/**
 * True when the signed-in user holds the required admin-grade role —
 * either directly, or implicitly via 'superuser'.
 *
 * Use this to gate a specific admin sub-screen (AdminProductsList →
 * 'manage-products', AdminSellersList → 'manage-salespersons',
 * AdminClientsList → 'manage-clients', AdminUsersList → 'superuser').
 */
export function useAdminGate(required: AdminSessionRole): boolean {
  const roles = useRoles();
  return useMemo(() => hasAdminGate(roles, required), [roles, required]);
}

/**
 * True when the signed-in user carries at least one admin-grade role.
 * Drives the visibility of the root-navigator Admin tab (UX6).
 */
export function useAnyAdminRole(): boolean {
  const roles = useRoles();
  return useMemo(() => hasAnyAdminRole(roles), [roles]);
}
