import { _internalLockStore } from './lockStore';

/**
 * Reset the in-memory lock state after a logout. Intended to be called
 * by `authService.logout()` immediately after `deletePinCredential()`,
 * so the next login on the same boot triggers PinSetup instead of
 * inheriting the previous session's `Unlocked` status.
 *
 * Consumed only by `@/features/auth/service/authService.logout` — same
 * deliberate non-barrel import exception that `deletePinCredential`
 * already has.
 */
export function resetLockStateAfterLogout(): void {
  _internalLockStore.setStatus('NotSet');
  _internalLockStore.resetFailedAttempts();
}
