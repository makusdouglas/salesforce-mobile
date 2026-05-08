import { isInactivityExpired } from '../state/inactivityPolicy';

describe('isInactivityExpired', () => {
  test('returns false when backgroundedAtMs is null', () => {
    expect(
      isInactivityExpired({ backgroundedAtMs: null, nowMs: 1000, timeoutMinutes: 5 }),
    ).toBe(false);
  });

  test('returns false at the exact timeout boundary', () => {
    const timeoutMinutes = 5;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    expect(
      isInactivityExpired({
        backgroundedAtMs: 0,
        nowMs: timeoutMs,
        timeoutMinutes,
      }),
    ).toBe(false);
  });

  test('returns true one ms past the boundary', () => {
    const timeoutMinutes = 5;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    expect(
      isInactivityExpired({
        backgroundedAtMs: 0,
        nowMs: timeoutMs + 1,
        timeoutMinutes,
      }),
    ).toBe(true);
  });

  test('clock skew (nowMs < backgroundedAtMs) is clamped to 0', () => {
    expect(
      isInactivityExpired({
        backgroundedAtMs: 10_000,
        nowMs: 5_000,
        timeoutMinutes: 1,
      }),
    ).toBe(false);
  });

  test('10-min background vs 5-min timeout → expired', () => {
    expect(
      isInactivityExpired({
        backgroundedAtMs: 0,
        nowMs: 10 * 60 * 1000,
        timeoutMinutes: 5,
      }),
    ).toBe(true);
  });

  test('3-min background vs 5-min timeout → not expired', () => {
    expect(
      isInactivityExpired({
        backgroundedAtMs: 0,
        nowMs: 3 * 60 * 1000,
        timeoutMinutes: 5,
      }),
    ).toBe(false);
  });
});
