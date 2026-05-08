/**
 * Public barrel for the lock feature.
 *
 * Re-exports ONLY what feature/app code may consume. Does NOT re-export:
 *   lockStore, _internalLockStore, lockStorage, biometricAdapter, pinHash,
 *   random, bootstrap, inactivity, PinPad, useLockFailedAttempts.
 *
 * Design tokens are imported directly from `@/features/auth/theme/tokens`
 * as an explicit cross-feature exception — tokens are app-wide visual
 * constants, not feature-scoped logic.
 *
 * `deletePinCredential` (`./storage/lockStorage`) is the only direct
 * non-barrel import allowed from outside this feature — consumed solely
 * by `@/features/auth/service/authService.logout` as part of the atomic
 * session+PIN wipe (research R5, tasks T032).
 */

export { lockService } from './service/lockService';
export { LockError, type LockErrorCode } from './service/errors';
export { useLock } from './hooks/useLock';
export { LockProvider } from './components/LockProvider';
export { LockGate } from './components/LockGate';
export { PinSetupScreen } from './screens/PinSetupScreen';
export { LockScreen } from './screens/LockScreen';
export { PinRecoveryConfirmScreen } from './screens/PinRecoveryConfirmScreen';
export type { LockStatus, LockSnapshot } from './state/lockStore';
