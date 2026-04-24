import {
  currentMonthKey,
  formatMonthKeyPt,
  monthKeyForDate,
  monthKeyToRange,
  shiftMonth,
} from './monthRange';

describe('monthKeyForDate / currentMonthKey', () => {
  it('pads single-digit months', () => {
    expect(monthKeyForDate(new Date(2026, 2, 15))).toBe('2026-03');
  });

  it('handles December', () => {
    expect(monthKeyForDate(new Date(2026, 11, 31))).toBe('2026-12');
  });
});

describe('monthKeyToRange', () => {
  it('spans the month exactly', () => {
    const { startMs, endMs } = monthKeyToRange('2026-04');
    expect(new Date(startMs).getDate()).toBe(1);
    expect(new Date(startMs).getMonth()).toBe(3); // April = index 3
    expect(new Date(endMs).getDate()).toBe(1);
    expect(new Date(endMs).getMonth()).toBe(4); // May = index 4
  });

  it('throws on invalid input', () => {
    expect(() => monthKeyToRange('bogus')).toThrow(/invalid month key/);
  });
});

describe('shiftMonth', () => {
  it('shifts backward across year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('shifts forward across year boundary', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('zero delta is identity', () => {
    expect(shiftMonth('2026-04', 0)).toBe('2026-04');
  });
});

describe('formatMonthKeyPt', () => {
  it.each([
    ['2026-04', 'Abril 2026'],
    ['2026-03', 'Março 2026'],
    ['2025-12', 'Dezembro 2025'],
  ])('%s → %s', (key, expected) => {
    expect(formatMonthKeyPt(key)).toBe(expected);
  });

  it('returns the key unchanged when invalid', () => {
    expect(formatMonthKeyPt('bogus')).toBe('bogus');
  });
});

describe('currentMonthKey', () => {
  it('returns a YYYY-MM string for today', () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });
});
