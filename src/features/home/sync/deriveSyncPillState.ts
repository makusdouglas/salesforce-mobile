import type { SyncStatus } from '@/features/sync';

import { formatRelativeSyncAge } from './formatRelativeSyncAge';

/**
 * Pure state-machine for HomeSyncPill — translates the sync store's
 * { status, lastOkAt } snapshot into a render-ready DTO.
 *
 * When `status === 'in-sync'` but no successful sync has happened in this
 * session yet (`lastOkAt === null`), the pill renders the green "Sincronizado"
 * state WITHOUT an age label (`ageLabel: null`). It does NOT fall back to
 * 'syncing', because nothing is actually syncing — the store is simply in
 * its initial state. HomeScreen may trigger an auto-sync when it mounts
 * into this shape so the age label fills in shortly after.
 */

export type SyncPillStateDTO =
  | { readonly kind: 'in-sync'; readonly ageLabel: string | null }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'failed' };

export type DeriveSyncPillStateInput = {
  readonly status: SyncStatus;
  readonly lastOkAt: number | null;
  readonly nowMs: number;
};

export function deriveSyncPillState(input: DeriveSyncPillStateInput): SyncPillStateDTO {
  const { status, lastOkAt, nowMs } = input;
  if (status === 'syncing') return { kind: 'syncing' };
  if (status === 'offline') return { kind: 'offline' };
  if (status === 'failed') return { kind: 'failed' };
  // status === 'in-sync'
  if (lastOkAt === null) return { kind: 'in-sync', ageLabel: null };
  return { kind: 'in-sync', ageLabel: formatRelativeSyncAge(lastOkAt, nowMs) };
}
