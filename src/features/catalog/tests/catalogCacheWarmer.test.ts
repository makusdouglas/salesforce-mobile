import { shouldTriggerPrefetch } from '../hooks/cacheWarmerLogic';

describe('shouldTriggerPrefetch', () => {
  test('syncing → in-sync triggers prefetch', () => {
    expect(shouldTriggerPrefetch('syncing', 'in-sync')).toBe(true);
  });

  test('null → in-sync (first mount while synced) does not trigger', () => {
    expect(shouldTriggerPrefetch(null, 'in-sync')).toBe(false);
  });

  test('in-sync → in-sync (spurious re-render) does not trigger', () => {
    expect(shouldTriggerPrefetch('in-sync', 'in-sync')).toBe(false);
  });

  test('in-sync → syncing does not trigger (it is the inverse)', () => {
    expect(shouldTriggerPrefetch('in-sync', 'syncing')).toBe(false);
  });

  test('syncing → failed does not trigger', () => {
    expect(shouldTriggerPrefetch('syncing', 'failed')).toBe(false);
  });

  test('syncing → offline does not trigger', () => {
    expect(shouldTriggerPrefetch('syncing', 'offline')).toBe(false);
  });

  test('offline → in-sync (connectivity restored, no actual sync) does not trigger', () => {
    // Prefetch should run only after a sync PASS completes, not when connectivity returns.
    expect(shouldTriggerPrefetch('offline', 'in-sync')).toBe(false);
  });

  test('failed → in-sync (recovered without going through syncing) does not trigger', () => {
    // Canonical path is syncing → in-sync; skipping `syncing` means the state edge does not count.
    expect(shouldTriggerPrefetch('failed', 'in-sync')).toBe(false);
  });
});
