import { type SyncStatus } from '@/features/sync/state/derive';

export function shouldTriggerPrefetch(
  prev: SyncStatus | null,
  curr: SyncStatus,
): boolean {
  return prev === 'syncing' && curr === 'in-sync';
}
