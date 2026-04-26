import type {
  OrderOverviewRowDTO,
  OrdersOverviewStatusFilter,
} from '../types';
import { applyFilters, normalizeForSearch } from './applyFilters';

function row(
  overrides: Partial<OrderOverviewRowDTO> & Pick<OrderOverviewRowDTO, 'status'>,
): OrderOverviewRowDTO {
  return {
    id: 'o',
    shortId: '#0000',
    clientId: 'c',
    clientName: 'Cliente',
    total: 100,
    itemCount: 1,
    received: 0,
    paymentStatus: null,
    effectiveTimestampMs: 0,
    timestampLabel: 'enviado',
    ...overrides,
  };
}

describe('normalizeForSearch', () => {
  it.each([
    ['Padaria São José', 'padaria sao jose'],
    ['AÇOUGUE', 'acougue'],
    ['  Hortifruti  ', 'hortifruti'],
    ['', ''],
    ['Maçã & Pêra', 'maca & pera'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(normalizeForSearch(input)).toBe(expected);
  });
});

describe('applyFilters — status chip', () => {
  const rows = [
    row({ id: 'd', status: 'draft' }),
    row({
      id: 's-paid',
      status: 'sent',
      paymentStatus: 'paid',
      received: 100,
      total: 100,
    }),
    row({
      id: 's-partial',
      status: 'sent',
      paymentStatus: 'partial',
      received: 30,
      total: 100,
    }),
    row({
      id: 's-pending',
      status: 'sent',
      paymentStatus: 'pending',
      received: 0,
      total: 100,
    }),
    row({
      id: 's-adjust',
      status: 'sent',
      paymentStatus: 'adjust',
      received: 150,
      total: 100,
    }),
    row({ id: 'c', status: 'canceled' }),
  ];

  const cases: [OrdersOverviewStatusFilter, string[]][] = [
    ['all', ['d', 's-paid', 's-partial', 's-pending', 's-adjust', 'c']],
    ['draft', ['d']],
    ['canceled', ['c']],
    ['paid', ['s-paid']],
    ['pending', ['s-partial', 's-pending', 's-adjust']], // bundle
  ];

  it.each(cases)('filter=%s keeps %j', (filter, expectedIds) => {
    const out = applyFilters(rows, { status: filter, query: '' });
    expect(out.map((r) => r.id)).toEqual(expectedIds);
  });
});

describe('applyFilters — search query', () => {
  const rows = [
    row({ id: 'a', clientName: 'Padaria São José', shortId: '#2041', status: 'sent' }),
    row({ id: 'b', clientName: 'Mercadinho Bom Preço', shortId: '#3A7B', status: 'sent' }),
    row({ id: 'c', clientName: 'Açougue do Zé', shortId: '#0F2C', status: 'draft' }),
  ];

  it('matches client name case-insensitively', () => {
    expect(
      applyFilters(rows, { status: 'all', query: 'PAD' }).map((r) => r.id),
    ).toEqual(['a']);
  });

  it('matches client name accent-insensitively', () => {
    expect(
      applyFilters(rows, { status: 'all', query: 'acougue' }).map((r) => r.id),
    ).toEqual(['c']);
  });

  it('matches short id (full or partial)', () => {
    expect(
      applyFilters(rows, { status: 'all', query: '#2041' }).map((r) => r.id),
    ).toEqual(['a']);
    expect(
      applyFilters(rows, { status: 'all', query: '3a' }).map((r) => r.id),
    ).toEqual(['b']);
  });

  it('empty query returns all rows', () => {
    expect(applyFilters(rows, { status: 'all', query: '' })).toHaveLength(3);
    expect(applyFilters(rows, { status: 'all', query: '   ' })).toHaveLength(3);
  });

  it('returns empty when query matches nothing', () => {
    expect(applyFilters(rows, { status: 'all', query: 'xxx' })).toHaveLength(0);
  });
});

describe('applyFilters — combined status + query', () => {
  const rows = [
    row({
      id: 'a',
      clientName: 'Mercadinho A',
      status: 'sent',
      paymentStatus: 'pending',
      received: 0,
      total: 100,
    }),
    row({
      id: 'b',
      clientName: 'Mercadinho B',
      status: 'sent',
      paymentStatus: 'paid',
      received: 100,
      total: 100,
    }),
    row({ id: 'c', clientName: 'Outro', status: 'draft' }),
  ];

  it('intersects status and query filters', () => {
    expect(
      applyFilters(rows, { status: 'pending', query: 'mer' }).map((r) => r.id),
    ).toEqual(['a']);
  });
});
