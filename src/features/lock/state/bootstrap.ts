import { lockStorage } from '../storage/lockStorage';

import { _internalLockStore } from './lockStore';

/**
 * Hydrate the in-memory lock state from secure storage. Called once at app
 * start by LockProvider. No network round-trip.
 *
 * Post-condition: lockStore status is NotSet (no PIN stored) or Locked
 * (valid PIN credential present); inactivity preference is hydrated or
 * pre-persisted with the default 5-minute value.
 */
export async function lockBootstrap(): Promise<void> {
  const [credential, preference] = await Promise.all([
    lockStorage.getPinCredential(),
    lockStorage.getInactivityPreference(),
  ]);

  if (preference === null) {
    await lockStorage.setInactivityPreference({ minutes: 5, version: 1 });
    _internalLockStore.setInactivityTimeoutMinutes(5);
  } else {
    _internalLockStore.setInactivityTimeoutMinutes(preference.minutes);
  }

  // Bootstrap is the first transition from the in-memory initial state
  // (`NotSet`). `NotSet → Locked` is a legal BOOT transition per the 004
  // state-machine contract but NOT a legal normal transition, so we use
  // a dedicated setter that bypasses the transition guard.
  _internalLockStore.bootstrapStatus(credential === null ? 'NotSet' : 'Locked');
}
