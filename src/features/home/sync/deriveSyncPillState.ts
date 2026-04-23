import type { SyncStatus } from '@/features/sync';

import { formatRelativeSyncAge } from './formatRelativeSyncAge';

/**
 * Pure state-machine for HomeSyncPill — translates the sync store's
 * { status, lastOkAt } snapshot into a render-ready DTO.
 *
 * The semantic fallback `status === 'in-sync' && lastOkAt === null` maps to
 * the `syncing` kind because the user has never seen a successful sync this
 * session — showing "Sincronizado · há … min" without a timestamp would be
 * misleading. Per research §R-001 and contracts/sync-pill.md.
 */

export type SyncPillStateDTO =
  | { readonly kind: 'in-sync'; readonly ageLabel: string }
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
  if (lastOkAt === null) return { kind: 'syncing' };
  return { kind: 'in-sync', ageLabel: formatRelativeSyncAge(lastOkAt, nowMs) };
}
