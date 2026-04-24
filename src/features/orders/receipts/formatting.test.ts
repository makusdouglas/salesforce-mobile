/**
 * 012-payment-receipts: parseBRL / formatBRL behaviour lock.
 *
 * The form's value path is: typed text → parseBRL → BRL decimal stored on
 * the receipt row → formatBRL when rendered. These tests cover every
 * shape the seller might type.
 */

import { formatBRL, parseBRL } from './formatting';

describe('parseBRL — digit-only input (no separator)', () => {
  it.each([
    ['10', 10],
    ['150', 150],
    ['1234', 1234],
    ['0', 0],
    ['', 0],
  ])('"%s" → %d reais', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });
});

describe('parseBRL — with a comma (pt-BR decimal)', () => {
  it.each([
    ['10,5', 10.5],
    ['10,50', 10.5],
    ['150,00', 150],
    ['0,01', 0.01],
    ['1.234,50', 1234.5],
  ])('"%s" → %s', (input, expected) => {
    expect(parseBRL(input)).toBeCloseTo(expected);
  });
});

describe('parseBRL — with a dot (en-US decimal)', () => {
  it.each([
    ['10.5', 10.5],
    ['10.50', 10.5],
    ['1,234.50', 1234.5],
  ])('"%s" → %s', (input, expected) => {
    expect(parseBRL(input)).toBeCloseTo(expected);
  });
});

describe('parseBRL — trailing comma (mid-type)', () => {
  it('accepts a dangling comma as the decimal marker with 0 centavos', () => {
    expect(parseBRL('10,')).toBe(10);
  });
});

describe('parseBRL — garbage', () => {
  it('returns 0 for pure non-numeric input', () => {
    expect(parseBRL('abc')).toBe(0);
  });
});

describe('parseBRL — leading minus (correction form)', () => {
  it.each([
    ['-10', -10],
    ['- 10', -10],
    ['−10', -10], // Unicode minus
    ['—10', -10], // em-dash
    ['-150,50', -150.5],
    ['-1.234,50', -1234.5],
  ])('"%s" → %s', (input, expected) => {
    expect(parseBRL(input)).toBeCloseTo(expected);
  });

  it('"-" alone returns 0 (no magnitude)', () => {
    expect(parseBRL('-')).toBe(0);
  });
});

describe('formatBRL', () => {
  it('formats integer reais with two centavos', () => {
    expect(formatBRL(10)).toMatch(/10,00/);
  });
  it('formats decimals precisely', () => {
    expect(formatBRL(194.5)).toMatch(/194,50/);
  });
  it('formats negative values with a minus', () => {
    expect(formatBRL(-10)).toMatch(/-.*10,00|−.*10,00/);
  });
});
