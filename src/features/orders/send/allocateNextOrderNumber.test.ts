// 011-order-email-delivery: pure helper tests. The stateful
// `allocateNextOrderNumber` is tested by orderSendService.test.ts via the
// real repo inside database.write — here we only lock the pure functions.

// Shim the transitive adapter load (database.ts imports the real SQLite
// adapter which needs a native module unavailable under node/jest).
import {
  OrderNumberOverflowError,
  allocateNextNumber,
  formatOrderNumber,
  parseOrderNumber,
} from './allocateNextOrderNumber';

jest.mock('@/data/database', () => ({ database: { write: (fn: () => unknown) => fn(), get: () => ({}) } }));

describe('formatOrderNumber', () => {
  test.each([
    [2026, 1, '#2026-0001'],
    [2026, 42, '#2026-0042'],
    [2026, 999, '#2026-0999'],
    [2026, 1000, '#2026-1000'],
    [2026, 9999, '#2026-9999'],
  ])('formats %i/%i as %s', (year, n, expected) => {
    expect(formatOrderNumber(year, n)).toBe(expected);
  });

  test('throws on overflow', () => {
    expect(() => formatOrderNumber(2026, 10000)).toThrow(OrderNumberOverflowError);
    expect(() => formatOrderNumber(2026, 0)).toThrow(OrderNumberOverflowError);
    expect(() => formatOrderNumber(2026, -1)).toThrow(OrderNumberOverflowError);
  });
});

describe('parseOrderNumber', () => {
  test('round-trips valid numbers', () => {
    expect(parseOrderNumber('#2026-0042')).toEqual({ year: 2026, n: 42 });
    expect(parseOrderNumber('#2000-0001')).toEqual({ year: 2000, n: 1 });
  });
  test('rejects malformed strings', () => {
    expect(parseOrderNumber('2026-0042')).toBeNull(); // missing #
    expect(parseOrderNumber('#2026-42')).toBeNull(); // short n
    expect(parseOrderNumber('#26-0042')).toBeNull(); // short year
    expect(parseOrderNumber('')).toBeNull();
    expect(parseOrderNumber('random')).toBeNull();
  });
});

describe('allocateNextNumber', () => {
  test('returns 0001 for empty taken', () => {
    expect(allocateNextNumber({ year: 2026, taken: [] })).toBe('#2026-0001');
  });

  test('skips taken contiguous range', () => {
    const taken = ['#2026-0001', '#2026-0002', '#2026-0003'];
    expect(allocateNextNumber({ year: 2026, taken })).toBe('#2026-0004');
  });

  test('fills gaps in sparse taken list', () => {
    const taken = ['#2026-0001', '#2026-0003', '#2026-0005'];
    expect(allocateNextNumber({ year: 2026, taken })).toBe('#2026-0002');
  });

  test('ignores entries from a different year', () => {
    const taken = ['#2025-0001', '#2025-0002', '#2026-0001'];
    expect(allocateNextNumber({ year: 2026, taken })).toBe('#2026-0002');
  });

  test('ignores malformed entries', () => {
    const taken = ['garbage', '', '#2026-0001', '2026-0002'];
    expect(allocateNextNumber({ year: 2026, taken })).toBe('#2026-0002');
  });

  test('is deterministic', () => {
    const taken = ['#2026-0001', '#2026-0004'];
    const a = allocateNextNumber({ year: 2026, taken });
    const b = allocateNextNumber({ year: 2026, taken });
    expect(a).toBe(b);
    expect(a).toBe('#2026-0002');
  });
});
