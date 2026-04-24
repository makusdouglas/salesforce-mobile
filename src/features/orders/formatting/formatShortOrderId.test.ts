import { formatShortOrderId } from './formatShortOrderId';

describe('formatShortOrderId', () => {
  it('takes the last 4 hex chars, uppercases, and prefixes with #', () => {
    expect(
      formatShortOrderId({ id: '0a1b2c3d-4e5f-6789-abcd-ef0123456789' }),
    ).toBe('#6789');
  });

  it('handles a bare uuid without dashes', () => {
    expect(formatShortOrderId({ id: 'abcd1234efab5678' })).toBe('#5678');
  });

  it('pads correctly for short inputs (dev fixtures)', () => {
    expect(formatShortOrderId({ id: 'xyz' })).toBe('#XYZ');
  });

  it('prefers orderNumber when present', () => {
    expect(
      formatShortOrderId({
        id: '0a1b2c3d-ef0123456789',
        orderNumber: '#2026-0041',
      }),
    ).toBe('#2026-0041');
  });

  it('prepends # when orderNumber lacks one', () => {
    expect(
      formatShortOrderId({
        id: '0a1b2c3d',
        orderNumber: '2026-0041',
      }),
    ).toBe('#2026-0041');
  });

  it('falls back to uuid suffix when orderNumber is empty string', () => {
    expect(
      formatShortOrderId({ id: 'abcdef12345678', orderNumber: '' }),
    ).toBe('#5678');
  });

  it('falls back to uuid suffix when orderNumber is null', () => {
    expect(
      formatShortOrderId({ id: 'abcdef12345678', orderNumber: null }),
    ).toBe('#5678');
  });
});
