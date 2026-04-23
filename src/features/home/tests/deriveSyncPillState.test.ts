import { deriveSyncPillState } from '../sync/deriveSyncPillState';

const NOW = 1_700_000_000_000;

describe('deriveSyncPillState', () => {
  test('in-sync + lastOkAt 2 min ago → { kind: "in-sync", ageLabel: "há 2 min" }', () => {
    expect(
      deriveSyncPillState({
        status: 'in-sync',
        lastOkAt: NOW - 2 * 60_000,
        nowMs: NOW,
      }),
    ).toEqual({ kind: 'in-sync', ageLabel: 'há 2 min' });
  });

  test('in-sync + lastOkAt null → falls back to "syncing" (semantic fallback)', () => {
    expect(deriveSyncPillState({ status: 'in-sync', lastOkAt: null, nowMs: NOW })).toEqual({
      kind: 'syncing',
    });
  });

  test('in-sync + very old lastOkAt → still "in-sync" with "há N d"', () => {
    expect(
      deriveSyncPillState({
        status: 'in-sync',
        lastOkAt: NOW - 3 * 24 * 60 * 60_000,
        nowMs: NOW,
      }),
    ).toEqual({ kind: 'in-sync', ageLabel: 'há 3 d' });
  });

  test('syncing → "syncing" regardless of lastOkAt', () => {
    expect(deriveSyncPillState({ status: 'syncing', lastOkAt: null, nowMs: NOW })).toEqual({
      kind: 'syncing',
    });
    expect(deriveSyncPillState({ status: 'syncing', lastOkAt: NOW - 1000, nowMs: NOW })).toEqual({
      kind: 'syncing',
    });
  });

  test('offline → "offline" regardless of lastOkAt', () => {
    expect(deriveSyncPillState({ status: 'offline', lastOkAt: null, nowMs: NOW })).toEqual({
      kind: 'offline',
    });
    expect(
      deriveSyncPillState({
        status: 'offline',
        lastOkAt: NOW - 60_000,
        nowMs: NOW,
      }),
    ).toEqual({ kind: 'offline' });
  });

  test('failed → "failed" regardless of lastOkAt', () => {
    expect(deriveSyncPillState({ status: 'failed', lastOkAt: null, nowMs: NOW })).toEqual({
      kind: 'failed',
    });
    expect(
      deriveSyncPillState({
        status: 'failed',
        lastOkAt: NOW - 60_000,
        nowMs: NOW,
      }),
    ).toEqual({ kind: 'failed' });
  });

  test('in-sync + lastOkAt within the last second → "agora"', () => {
    expect(
      deriveSyncPillState({
        status: 'in-sync',
        lastOkAt: NOW - 500,
        nowMs: NOW,
      }),
    ).toEqual({ kind: 'in-sync', ageLabel: 'agora' });
  });
});
