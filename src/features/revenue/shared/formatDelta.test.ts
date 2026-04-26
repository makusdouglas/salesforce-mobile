import { computeDeltaDirection, computeDeltaPct, formatDelta } from './formatDelta';

describe('computeDeltaPct', () => {
  it('returns null when previous is null (no comparable data)', () => {
    expect(computeDeltaPct(100, null)).toBeNull();
  });

  it('returns null when previous is 0 (would divide by zero)', () => {
    expect(computeDeltaPct(100, 0)).toBeNull();
    expect(computeDeltaPct(0, 0)).toBeNull();
  });

  it('returns a positive fraction when current > previous', () => {
    expect(computeDeltaPct(110, 100)).toBeCloseTo(0.1, 6);
  });

  it('returns a negative fraction when current < previous', () => {
    expect(computeDeltaPct(90, 100)).toBeCloseTo(-0.1, 6);
  });

  it('returns 0 when current equals previous', () => {
    expect(computeDeltaPct(100, 100)).toBe(0);
  });
});

describe('computeDeltaDirection', () => {
  it('returns null when delta is null', () => {
    expect(computeDeltaDirection(100, null)).toBeNull();
    expect(computeDeltaDirection(100, 0)).toBeNull();
  });

  it('returns up for non-negative delta', () => {
    expect(computeDeltaDirection(110, 100)).toBe('up');
    expect(computeDeltaDirection(100, 100)).toBe('up');
  });

  it('returns down for negative delta', () => {
    expect(computeDeltaDirection(90, 100)).toBe('down');
  });
});

describe('formatDelta', () => {
  it('renders an em dash for null', () => {
    expect(formatDelta(null)).toEqual({ text: '—', direction: null });
  });

  it('renders an em dash for non-finite values', () => {
    expect(formatDelta(Infinity)).toEqual({ text: '—', direction: null });
    expect(formatDelta(-Infinity)).toEqual({ text: '—', direction: null });
    expect(formatDelta(Number.NaN)).toEqual({ text: '—', direction: null });
  });

  it('renders a positive delta with + and comma decimal', () => {
    expect(formatDelta(0.124)).toEqual({ text: '+12,4%', direction: 'up' });
  });

  it('renders a negative delta with the unicode minus sign', () => {
    expect(formatDelta(-0.037)).toEqual({ text: '−3,7%', direction: 'down' });
  });

  it('renders zero with + and "up" direction (no movement is treated as parity)', () => {
    expect(formatDelta(0)).toEqual({ text: '+0,0%', direction: 'up' });
  });

  it('rounds to one decimal place', () => {
    expect(formatDelta(0.1234567)).toEqual({ text: '+12,3%', direction: 'up' });
    expect(formatDelta(-0.1296)).toEqual({ text: '−13,0%', direction: 'down' });
  });
});
