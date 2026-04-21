import NetInfo from '@react-native-community/netinfo';

import { authService } from '@/features/auth';

import { biometricAdapter, type BiometricResult } from '../biometric/biometricAdapter';
import { createCredentialFromPin, verifyPinHash } from '../crypto/pinHash';
import { _internalLockStore } from '../state/lockStore';
import { deletePinCredential, lockStorage } from '../storage/lockStorage';

import { LockError } from './errors';

const PIN_REGEX = /^\d{4,6}$/;
const MAX_ATTEMPTS_BEFORE_RECOVERY = 10;

type UnlockResult = BiometricResult;

type LockServiceShape = {
  setupPin(pin: string): Promise<void>;
  verifyPin(pin: string): Promise<boolean>;
  unlockWithBiometric(): Promise<UnlockResult>;
  beginPinRecovery(): Promise<void>;
  setInactivityTimeout(minutes: number): Promise<void>;
  getInactivityTimeout(): number;
};

export const lockService: LockServiceShape = {
  /** FR-001, FR-002, FR-003, FR-004: persist a hashed PIN and unlock. */
  async setupPin(pin: string): Promise<void> {
    if (!PIN_REGEX.test(pin)) {
      throw new LockError('PIN_INVALID_LENGTH');
    }
    let credential;
    try {
      credential = await createCredentialFromPin(pin);
      await lockStorage.setPinCredential(credential);
    } catch (err) {
      throw new LockError(
        'STORAGE_UNAVAILABLE',
        err instanceof Error ? err.message : undefined,
      );
    }
    _internalLockStore.resetFailedAttempts();
    _internalLockStore.setStatus('Unlocked');
  },

  /** FR-006/007/008: verify PIN against stored hash, fully offline. */
  async verifyPin(pin: string): Promise<boolean> {
    if (!PIN_REGEX.test(pin)) {
      throw new LockError('PIN_INVALID_LENGTH');
    }
    if (_internalLockStore.getFailedAttempts() >= MAX_ATTEMPTS_BEFORE_RECOVERY) {
      throw new LockError('TOO_MANY_ATTEMPTS');
    }
    const credential = await lockStorage.getPinCredential();
    if (credential === null) {
      throw new LockError('STORAGE_UNAVAILABLE');
    }
    const ok = await verifyPinHash(pin, credential);
    if (ok) {
      _internalLockStore.resetFailedAttempts();
      _internalLockStore.setStatus('Unlocked');
      return true;
    }
    _internalLockStore.incrementFailedAttempts();
    return false;
  },

  /** FR-006: biometric unlock; on success flips store to Unlocked. */
  async unlockWithBiometric(): Promise<UnlockResult> {
    const available = await biometricAdapter.isAvailable();
    if (!available) return 'unavailable';
    const result = await biometricAdapter.authenticate({
      promptMessage: 'Desbloqueie para acessar o catálogo',
      cancelLabel: 'Usar PIN',
    });
    if (result === 'success') {
      _internalLockStore.setStatus('Unlocked');
    }
    return result;
  },

  /** FR-013, FR-014, FR-015: Forgot-PIN recovery flow. */
  async beginPinRecovery(): Promise<void> {
    const netState = await NetInfo.fetch();
    const online = netState.isConnected === true && netState.isInternetReachable === true;
    if (!online) {
      throw new LockError('RECOVERY_OFFLINE');
    }
    // Step order matters (research R8): wipe PIN first, then session.
    // If the session wipe fails mid-way, the PIN is already gone — the
    // salesperson is routed through LoginScreen → PinSetupScreen on next
    // cold launch, which is the safer failure mode.
    await deletePinCredential();
    await authService.logout({ preserveEmail: true });
    _internalLockStore.resetFailedAttempts();
    // Session flipped to NotAuthenticated → RootNavigator unmounts Home
    // branch → LockGate + screen tree unmount on next frame.
  },

  async setInactivityTimeout(minutes: number): Promise<void> {
    const clamped = Math.max(1, Math.min(30, Math.round(minutes)));
    try {
      await lockStorage.setInactivityPreference({ minutes: clamped, version: 1 });
    } catch (err) {
      throw new LockError(
        'STORAGE_UNAVAILABLE',
        err instanceof Error ? err.message : undefined,
      );
    }
    _internalLockStore.setInactivityTimeoutMinutes(clamped);
  },

  getInactivityTimeout(): number {
    return _internalLockStore.getInactivityTimeoutMinutes();
  },
};
