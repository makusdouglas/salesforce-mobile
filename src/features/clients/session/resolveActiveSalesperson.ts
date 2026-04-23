import type { ActiveSalespersonState } from '../types';

export const RESOLVING: ActiveSalespersonState = {
  status: 'resolving',
  salespersonId: null,
};

export const MISSING: ActiveSalespersonState = {
  status: 'missing',
  salespersonId: null,
};

/**
 * Pure resolver. Given the salesperson rows the repo emitted and the current
 * session email, returns the matching state. Kept in its own module (no
 * WatermelonDB imports) so Jest can test it without the native SQLite adapter.
 */
export function resolveActiveSalesperson(
  rows: readonly { readonly id: string; readonly email: string }[],
  sessionStatus: string,
  email: string | null,
): ActiveSalespersonState {
  if (sessionStatus !== 'Authenticated' || email === null) {
    return RESOLVING;
  }
  const match = rows.find((r) => r.email === email);
  return match ? { status: 'ready', salespersonId: match.id } : MISSING;
}
