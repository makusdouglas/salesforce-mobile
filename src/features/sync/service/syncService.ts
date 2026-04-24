/**
 * Public entry points for the sync feature.
 *
 * - runSync({ trigger }): returns an outcome/skipped object. Never rejects.
 *   When a pass is already in-flight, returns { outcome: 'skipped', reason:
 *   'coalesced' } synchronously — normal trigger callers do not wait for
 *   the in-flight pass's outcome. See contracts/sync-service.md §runSync.
 * - onOrderSent(): fire-and-forget opportunistic trigger. No-op when offline.
 */

import { Q } from '@nozbe/watermelondb';

import { database } from '@/data/database';

import { runPass, type SyncRunResult, type SyncTrigger } from '../protocol/runPass';
import { _internalSyncStatusStore } from '../state/syncStatusStore';

import type { SyncErrorCode } from './errors';

// 012-payment-receipts: opportunistic uploader for pending receipt
// attachments. Imported lazily via dynamic import so unit tests that
// mock `@/data/supabase` don't have to stub the storage client when they
// only exercise the sync protocol.
async function flushReceiptAttachments(): Promise<void> {
  try {
    const { receiptAttachmentUploader } = await import(
      '@/features/orders/receipts/attachments/uploader'
    );
    await receiptAttachmentUploader.flushPending();
  } catch {
    // A failed upload pass never fails the sync pass — the per-row
    // `upload_state = 'failed'` state is the durable signal, and the
    // retry button in PaymentReceiptDetail is how the user recovers.
  }
}

export type SyncRunOrSkipped =
  | SyncRunResult
  | { outcome: 'skipped'; reason: 'offline' | 'coalesced' };

const PUSHABLE_TABLES = ['clients', 'orders', 'order_items', 'payment_receipts'] as const;

let _inFlightPromise: Promise<SyncRunResult> | null = null;
let _followUpQueued = false;

async function countPendingLocalChanges(): Promise<number> {
  let total = 0;
  for (const table of PUSHABLE_TABLES) {
    const count = await database
      .get(table)
      .query(Q.where('_status', Q.notEq('synced')))
      .fetchCount();
    total += count;
  }
  return total;
}

async function runSync(args: { trigger: SyncTrigger }): Promise<SyncRunOrSkipped> {
  const internal = _internalSyncStatusStore.getInternal();

  // Short-circuit: offline.
  if (!internal._online) {
    return { outcome: 'skipped', reason: 'offline' };
  }

  // Short-circuit: already in flight → queue exactly one follow-up.
  if (_inFlightPromise !== null) {
    _followUpQueued = true;
    _internalSyncStatusStore.setFollowUpQueued(true);
    return { outcome: 'skipped', reason: 'coalesced' };
  }

  // Start a new pass.
  _internalSyncStatusStore.setInFlight(true);
  _inFlightPromise = runPass(args.trigger);

  let result: SyncRunResult;
  try {
    result = await _inFlightPromise;
  } finally {
    _inFlightPromise = null;
  }

  _internalSyncStatusStore.setLastOutcome(result.outcome === 'ok' ? 'ok' : 'failed');

  // 012-payment-receipts: flush any pending receipt attachments now that
  // the row-push has completed successfully. Runs in background — the
  // caller's result is not held up by upload duration.
  if (result.outcome === 'ok') {
    void flushReceiptAttachments();
  }

  try {
    const pending = await countPendingLocalChanges();
    _internalSyncStatusStore.setHasQueuedChanges(pending > 0);
  } catch {
    // fetchCount may fail in pathological states (DB closed); leave the flag.
  }

  _internalSyncStatusStore.setInFlight(false);

  // Drain the follow-up, if any. Fire-and-forget.
  if (_followUpQueued) {
    _followUpQueued = false;
    _internalSyncStatusStore.setFollowUpQueued(false);
    void runSync({ trigger: 'follow-up' });
  }

  return result;
}

function onOrderSent(): void {
  const internal = _internalSyncStatusStore.getInternal();
  if (!internal._online) return;
  void runSync({ trigger: 'order-sent' });
}

function __resetForTests(): void {
  _inFlightPromise = null;
  _followUpQueued = false;
  _internalSyncStatusStore.__resetForTests();
}

export const syncService = {
  runSync,
  onOrderSent,
  __resetForTests,
};

export type { SyncTrigger, SyncRunResult, SyncErrorCode };
