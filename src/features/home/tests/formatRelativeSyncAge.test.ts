import { formatRelativeSyncAge } from '../sync/formatRelativeSyncAge';

const NOW = 1_700_000_000_000;

function ago(ms: number): number {
  return NOW - ms;
}

describe('formatRelativeSyncAge', () => {
  test('< 60 s → "agora"', () => {
    expect(formatRelativeSyncAge(ago(0), NOW)).toBe('agora');
    expect(formatRelativeSyncAge(ago(1_000), NOW)).toBe('agora');
    expect(formatRelativeSyncAge(ago(59_999), NOW)).toBe('agora');
  });

  test('60 s exactly → "há 1 min"', () => {
    expect(formatRelativeSyncAge(ago(60_000), NOW)).toBe('há 1 min');
  });

  test('1–59 min → "há N min"', () => {
    expect(formatRelativeSyncAge(ago(2 * 60_000), NOW)).toBe('há 2 min');
    expect(formatRelativeSyncAge(ago(38 * 60_000), NOW)).toBe('há 38 min');
    expect(formatRelativeSyncAge(ago(59 * 60_000 + 59_000), NOW)).toBe('há 59 min');
  });

  test('1 h exactly → "há 1 h"', () => {
    expect(formatRelativeSyncAge(ago(60 * 60_000), NOW)).toBe('há 1 h');
  });

  test('1–23 h → "há N h"', () => {
    expect(formatRelativeSyncAge(ago(3 * 60 * 60_000), NOW)).toBe('há 3 h');
    expect(formatRelativeSyncAge(ago(23 * 60 * 60_000 + 59 * 60_000), NOW)).toBe(
      'há 23 h',
    );
  });

  test('24 h exactly → "há 1 d"', () => {
    expect(formatRelativeSyncAge(ago(24 * 60 * 60_000), NOW)).toBe('há 1 d');
  });

  test('≥ 24 h → "há N d" (no upper bound)', () => {
    expect(formatRelativeSyncAge(ago(2 * 24 * 60 * 60_000), NOW)).toBe('há 2 d');
    expect(formatRelativeSyncAge(ago(30 * 24 * 60 * 60_000), NOW)).toBe('há 30 d');
    expect(formatRelativeSyncAge(ago(365 * 24 * 60 * 60_000), NOW)).toBe('há 365 d');
  });

  test('future timestamp (clock drift) clamps at "agora"', () => {
    expect(formatRelativeSyncAge(NOW + 60_000, NOW)).toBe('agora');
  });

  test('integer floor — 2 min 59 s → "há 2 min"', () => {
    expect(formatRelativeSyncAge(ago(2 * 60_000 + 59_000), NOW)).toBe('há 2 min');
  });
});
