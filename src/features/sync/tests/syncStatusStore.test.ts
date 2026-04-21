import { deriveStatus, type InternalState } from '../state/derive';
import { _internalSyncStatusStore, syncStatusStore } from '../state/syncStatusStore';

beforeEach(() => {
  _internalSyncStatusStore.__resetForTests();
});

function state(overrides: Partial<InternalState>): InternalState {
  return {
    _inFlight: false,
    _followUpQueued: false,
    _online: false,
    _lastOutcome: 'initial',
    _hasQueuedChanges: false,
    ...overrides,
  };
}

describe('deriveStatus (pure)', () => {
  test.each([
    [state({ _inFlight: true, _online: true, _lastOutcome: 'ok' }), 'syncing'],
    [state({ _inFlight: true, _online: false, _lastOutcome: 'failed' }), 'syncing'],
    [state({ _online: false, _lastOutcome: 'ok' }), 'offline'],
    [state({ _online: false, _lastOutcome: 'failed' }), 'offline'],
    [state({ _online: true, _lastOutcome: 'failed' }), 'failed'],
    [state({ _online: true, _lastOutcome: 'ok' }), 'in-sync'],
    [state({ _online: true, _lastOutcome: 'initial' }), 'in-sync'],
  ] as const)('%j → %s', (s, expected) => {
    expect(deriveStatus(s)).toBe(expected);
  });

  test('follow-up-queued and has-queued-changes do not affect public status', () => {
    const online = state({ _online: true, _lastOutcome: 'ok' });
    expect(deriveStatus(online)).toBe('in-sync');
    expect(
      deriveStatus({ ...online, _followUpQueued: true, _hasQueuedChanges: true }),
    ).toBe('in-sync');
  });
});

describe('syncStatusStore invariants', () => {
  test('setInFlight(true) forces status === syncing regardless of other flags', () => {
    _internalSyncStatusStore.setOnline(false);
    _internalSyncStatusStore.setLastOutcome('failed');
    _internalSyncStatusStore.setInFlight(true);
    expect(syncStatusStore.getSnapshot().status).toBe('syncing');
  });

  test('setInFlight(false) + _online=false forces status === offline', () => {
    _internalSyncStatusStore.setInFlight(true);
    _internalSyncStatusStore.setOnline(false);
    _internalSyncStatusStore.setInFlight(false);
    expect(syncStatusStore.getSnapshot().status).toBe('offline');
  });

  test('failed requires _online=true and _inFlight=false', () => {
    _internalSyncStatusStore.setOnline(true);
    _internalSyncStatusStore.setLastOutcome('failed');
    expect(syncStatusStore.getSnapshot().status).toBe('failed');
  });

  test('in-sync path: online + ok + not in-flight', () => {
    _internalSyncStatusStore.setOnline(true);
    _internalSyncStatusStore.setLastOutcome('ok');
    expect(syncStatusStore.getSnapshot().status).toBe('in-sync');
  });
});

describe('syncStatusStore emissions', () => {
  test('setInFlight(true) emits once', () => {
    _internalSyncStatusStore.setOnline(true);
    _internalSyncStatusStore.setLastOutcome('ok');
    const listener = jest.fn();
    syncStatusStore.subscribe(listener);
    _internalSyncStatusStore.setInFlight(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('setFollowUpQueued does NOT emit (internal-only)', () => {
    _internalSyncStatusStore.setOnline(true);
    const listener = jest.fn();
    syncStatusStore.subscribe(listener);
    _internalSyncStatusStore.setFollowUpQueued(true);
    expect(listener).not.toHaveBeenCalled();
  });

  test('setHasQueuedChanges does NOT emit (internal-only)', () => {
    _internalSyncStatusStore.setOnline(true);
    const listener = jest.fn();
    syncStatusStore.subscribe(listener);
    _internalSyncStatusStore.setHasQueuedChanges(true);
    expect(listener).not.toHaveBeenCalled();
  });

  test('setting same value twice emits at most once', () => {
    _internalSyncStatusStore.setOnline(true);
    const listener = jest.fn();
    syncStatusStore.subscribe(listener);
    _internalSyncStatusStore.setOnline(true); // no change
    _internalSyncStatusStore.setOnline(true); // no change
    expect(listener).not.toHaveBeenCalled();
  });

  test('unsubscribe stops further emissions', () => {
    _internalSyncStatusStore.setOnline(true);
    _internalSyncStatusStore.setLastOutcome('ok');
    const listener = jest.fn();
    const unsubscribe = syncStatusStore.subscribe(listener);
    unsubscribe();
    _internalSyncStatusStore.setInFlight(true);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('syncStatusStore reentrancy guard (__DEV__)', () => {
  test('listener that triggers a transition throws', () => {
    _internalSyncStatusStore.setOnline(true);
    _internalSyncStatusStore.setLastOutcome('ok');
    const bad = () => _internalSyncStatusStore.setInFlight(true);
    syncStatusStore.subscribe(() => {
      // This is only safe if the listener doesn't mutate — reentrancy guard
      // should throw inside the subscriber's synchronous callback.
      expect(bad).toThrow(
        /transitions must not happen inside subscriber callbacks/,
      );
    });
    _internalSyncStatusStore.setLastOutcome('failed');
  });
});

describe('__resetForTests', () => {
  test('zeroes internal state and clears listeners', () => {
    _internalSyncStatusStore.setOnline(true);
    _internalSyncStatusStore.setLastOutcome('ok');
    const listener = jest.fn();
    syncStatusStore.subscribe(listener);
    _internalSyncStatusStore.__resetForTests();
    _internalSyncStatusStore.setOnline(true); // would normally emit a transition
    expect(listener).not.toHaveBeenCalled();
  });
});
