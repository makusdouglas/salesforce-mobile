/**
 * Public barrel for the sync feature.
 *
 * Exports only what application code may consume. Internal modules
 * (syncStatusStore, _internalSyncStatusStore, runPass, pullChanges,
 * pushChanges, mappers, conflictResolver, netinfoBridge, loginTrigger,
 * pullToRefreshTrigger, orderSentTrigger) are NOT re-exported. External
 * code consumes the public surface only.
 *
 * US2 (T025) adds: SyncStatusIndicator
 * US3 (T028) adds: onPullToRefresh
 * US4 (T031) adds: onOrderSent (standalone convenience export)
 */

export { syncService } from './service/syncService';
export { SyncError, type SyncErrorCode } from './service/errors';
export { useSyncStatus } from './hooks/useSyncStatus';
export { SyncProvider } from './components/SyncProvider';
export type { SyncStatus } from './state/derive';
export type { SyncStatusSnapshot } from './state/syncStatusStore';
export type { SyncTrigger, SyncRunResult } from './protocol/runPass';
