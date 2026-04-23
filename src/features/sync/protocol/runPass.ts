import { synchronize } from '@nozbe/watermelondb/sync';

import { database } from '@/data/database';
import { authService } from '@/features/auth';

import { SyncError, type SyncErrorCode } from '../service/errors';
import { pullChanges } from '../supabase/pullChanges';
import { pushChanges } from '../supabase/pushChanges';

import { conflictResolver } from './conflictResolver';

export type SyncTrigger = 'login' | 'pull-to-refresh' | 'order-sent' | 'follow-up';

export type SyncRunResult =
  | { outcome: 'ok' }
  | { outcome: 'failed'; code: SyncErrorCode };

/**
 * Run one pull-then-push pass via WatermelonDB's synchronize() helper.
 *
 * Never rejects — always returns one of the two SyncRunResult shapes.
 */
export async function runPass(_trigger: SyncTrigger): Promise<SyncRunResult> {
  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }) =>
        pullChanges({ lastPulledAt: lastPulledAt ?? null }),
      pushChanges: async ({ changes, lastPulledAt }) =>
        // Watermelon types `lastPulledAt` as possibly undefined; the adapter
        // treats it as an opaque stamp and does not need a defined value for
        // the MVP push path.
        pushChanges({ changes, lastPulledAt: lastPulledAt ?? 0 }),
      conflictResolver: (table, local, remote, resolved) =>
        conflictResolver(table, local, remote, resolved),
      sendCreatedAsUpdated: true,
    });
    return { outcome: 'ok' };
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[sync] runPass failed', err);
    }
    if (err instanceof SyncError) {
      if (err.code === 'AUTH_REJECTED') {
        // Hand off to auth — do NOT retry inside the same pass.
        void authService.refresh({ reason: 'requireSession' }).catch(() => {
          // auth feature handles the downstream state transition; we swallow
          // here because runPass itself is best-effort.
        });
      }
      return { outcome: 'failed', code: err.code };
    }
    // Non-SyncError from deeper in the stack — classify conservatively.
    return { outcome: 'failed', code: 'SERVER' };
  }
}
