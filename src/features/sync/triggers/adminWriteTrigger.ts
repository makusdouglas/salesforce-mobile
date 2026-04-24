import { onPullToRefresh } from './pullToRefreshTrigger';

/**
 * Kick off a sync pull after a successful admin write so the seller-side
 * local cache (feature 5) propagates the change on next connect.
 *
 * Errors are swallowed on purpose: the regular sync schedule picks the
 * change up eventually; a failed trigger is best-effort.
 */
export async function triggerSyncAfterAdminWrite(): Promise<void> {
  try {
    await onPullToRefresh();
  } catch {
    // intentionally empty — sync engine will retry on its own schedule.
  }
}
