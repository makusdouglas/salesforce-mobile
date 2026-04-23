import { _internalSyncStatusStore, syncStatusStore } from '@/features/sync/state/syncStatusStore';

beforeEach(() => {
  _internalSyncStatusStore.__resetForTests();
});

describe('syncStatusStore.lastOkAt', () => {
  test('initial snapshot has lastOkAt = null', () => {
    expect(syncStatusStore.getSnapshot().lastOkAt).toBeNull();
  });

  test('setLastOutcome("ok") stamps a non-null number close to Date.now()', () => {
    const before = Date.now();
    _internalSyncStatusStore.setLastOutcome('ok');
    const after = Date.now();
    const stamped = syncStatusStore.getSnapshot().lastOkAt;
    expect(stamped).not.toBeNull();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });

  test('setLastOutcome("failed") preserves the prior lastOkAt', () => {
    _internalSyncStatusStore.setLastOutcome('ok');
    const okAt = syncStatusStore.getSnapshot().lastOkAt;
    expect(okAt).not.toBeNull();
    _internalSyncStatusStore.setLastOutcome('failed');
    expect(syncStatusStore.getSnapshot().lastOkAt).toBe(okAt);
  });

  test('__resetForTests clears lastOkAt to null', () => {
    _internalSyncStatusStore.setLastOutcome('ok');
    expect(syncStatusStore.getSnapshot().lastOkAt).not.toBeNull();
    _internalSyncStatusStore.__resetForTests();
    expect(syncStatusStore.getSnapshot().lastOkAt).toBeNull();
  });

  test('snapshot is referentially stable when nothing changes', () => {
    _internalSyncStatusStore.setOnline(true);
    _internalSyncStatusStore.setLastOutcome('ok');
    const a = syncStatusStore.getSnapshot();
    // Idempotent setter calls must not change the snapshot reference.
    _internalSyncStatusStore.setOnline(true);
    const b = syncStatusStore.getSnapshot();
    expect(b).toBe(a);
  });

  test('two rapid setLastOutcome("ok") calls at the same ms produce one snapshot', () => {
    const fixed = 1_700_000_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(fixed);
    try {
      _internalSyncStatusStore.setLastOutcome('ok');
      const first = syncStatusStore.getSnapshot();
      _internalSyncStatusStore.setLastOutcome('ok');
      const second = syncStatusStore.getSnapshot();
      expect(second).toBe(first);
      expect(second.lastOkAt).toBe(fixed);
    } finally {
      spy.mockRestore();
    }
  });

  test('setLastOkAt mutator overrides the stamp directly', () => {
    _internalSyncStatusStore.setLastOkAt(42);
    expect(syncStatusStore.getSnapshot().lastOkAt).toBe(42);
    _internalSyncStatusStore.setLastOkAt(null);
    expect(syncStatusStore.getSnapshot().lastOkAt).toBeNull();
  });

  test('existing status transition semantics are preserved', () => {
    _internalSyncStatusStore.setOnline(true);
    _internalSyncStatusStore.setLastOutcome('ok');
    expect(syncStatusStore.getSnapshot().status).toBe('in-sync');
    _internalSyncStatusStore.setLastOutcome('failed');
    expect(syncStatusStore.getSnapshot().status).toBe('failed');
  });
});
