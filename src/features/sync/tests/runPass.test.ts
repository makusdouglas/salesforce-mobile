/* eslint-disable import/first */
// jest.mock calls must hoist above the imports they affect.
jest.mock('../protocol/runPass', () => ({
  runPass: jest.fn(),
}));

jest.mock('@/data/database', () => ({
  database: {
    get: () => ({
      query: () => ({
        fetchCount: async () => 0,
      }),
    }),
  },
}));

import { runPass } from '../protocol/runPass';
import { syncService } from '../service/syncService';
import { _internalSyncStatusStore } from '../state/syncStatusStore';

const mockedRunPass = runPass as jest.MockedFunction<typeof runPass>;

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  syncService.__resetForTests();
  mockedRunPass.mockReset();
  _internalSyncStatusStore.setOnline(true);
});

describe('syncService.runSync — offline short-circuit', () => {
  test('returns skipped:offline when _online is false and does not call runPass', async () => {
    _internalSyncStatusStore.setOnline(false);
    const result = await syncService.runSync({ trigger: 'login' });
    expect(result).toEqual({ outcome: 'skipped', reason: 'offline' });
    expect(mockedRunPass).not.toHaveBeenCalled();
  });
});

describe('syncService.runSync — single-in-flight + coalesce', () => {
  test('overlapping triggers collapse into one in-flight + one follow-up', async () => {
    const d = deferred<Awaited<ReturnType<typeof runPass>>>();
    mockedRunPass.mockImplementationOnce(() => d.promise);
    mockedRunPass.mockImplementationOnce(async () => ({ outcome: 'ok' }));

    // Start pass A — pending
    const a = syncService.runSync({ trigger: 'login' });

    // Fire 3 more triggers while A is in-flight — all coalesce to one follow-up
    const [b, c, d2] = await Promise.all([
      syncService.runSync({ trigger: 'pull-to-refresh' }),
      syncService.runSync({ trigger: 'pull-to-refresh' }),
      syncService.runSync({ trigger: 'order-sent' }),
    ]);
    expect(b).toEqual({ outcome: 'skipped', reason: 'coalesced' });
    expect(c).toEqual({ outcome: 'skipped', reason: 'coalesced' });
    expect(d2).toEqual({ outcome: 'skipped', reason: 'coalesced' });

    // Only pass A has been started
    expect(mockedRunPass).toHaveBeenCalledTimes(1);

    // Resolve pass A
    d.resolve({ outcome: 'ok' });
    await a;

    // Give the follow-up microtask a chance to start
    await new Promise((r) => setImmediate(r));

    // Follow-up fired exactly once
    expect(mockedRunPass).toHaveBeenCalledTimes(2);
    expect(mockedRunPass).toHaveBeenNthCalledWith(2, 'follow-up');
  });

  test('failure result is recorded as _lastOutcome=failed', async () => {
    mockedRunPass.mockResolvedValue({ outcome: 'failed', code: 'NETWORK' });
    const result = await syncService.runSync({ trigger: 'login' });
    expect(result).toEqual({ outcome: 'failed', code: 'NETWORK' });
    expect(_internalSyncStatusStore.getInternal()._lastOutcome).toBe('failed');
    expect(_internalSyncStatusStore.getInternal()._inFlight).toBe(false);
  });

  test('success result is recorded as _lastOutcome=ok', async () => {
    mockedRunPass.mockResolvedValue({ outcome: 'ok' });
    const result = await syncService.runSync({ trigger: 'login' });
    expect(result).toEqual({ outcome: 'ok' });
    expect(_internalSyncStatusStore.getInternal()._lastOutcome).toBe('ok');
    expect(_internalSyncStatusStore.getInternal()._inFlight).toBe(false);
  });
});

describe('syncService.onOrderSent', () => {
  test('offline: no-op, does not set _inFlight', () => {
    _internalSyncStatusStore.setOnline(false);
    syncService.onOrderSent();
    // runSync is called but short-circuits at the offline gate
    expect(_internalSyncStatusStore.getInternal()._inFlight).toBe(false);
    expect(mockedRunPass).not.toHaveBeenCalled();
  });

  test('online: schedules a pass', async () => {
    const d = deferred<Awaited<ReturnType<typeof runPass>>>();
    mockedRunPass.mockImplementationOnce(() => d.promise);

    syncService.onOrderSent();
    // microtask to let the async runSync start
    await new Promise((r) => setImmediate(r));
    expect(_internalSyncStatusStore.getInternal()._inFlight).toBe(true);
    expect(mockedRunPass).toHaveBeenCalledWith('order-sent');

    d.resolve({ outcome: 'ok' });
    // Let the async settle
    await new Promise((r) => setImmediate(r));
    expect(_internalSyncStatusStore.getInternal()._inFlight).toBe(false);
  });
});
