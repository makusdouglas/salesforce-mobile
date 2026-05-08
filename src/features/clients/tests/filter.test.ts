import { applyFilter, RECENT_LIMIT } from '../search/filter';
import type { ClientListItemDTO } from '../types';

function c(id: string, name: string, updatedAt: number, taxId: string | null = null): ClientListItemDTO {
  return {
    id,
    name,
    taxId,
    addressSnippet: null,
    contactSnippet: null,
    updatedAt,
    isPendingSync: false,
  };
}

describe('applyFilter', () => {
  test('empty query + null filter returns full list unchanged', () => {
    const list = [c('1', 'Alpha', 1), c('2', 'Beta', 2)];
    expect(applyFilter({ clients: list, query: '', activeFilter: null })).toBe(list);
  });

  test('recent chip returns top-10 by updatedAt descending', () => {
    const many = Array.from({ length: 20 }, (_, i) => c(`${i}`, `Loja ${i}`, i));
    const result = applyFilter({
      clients: many,
      query: '',
      activeFilter: { kind: 'recent' },
    });
    expect(result).toHaveLength(RECENT_LIMIT);
    expect(result[0]?.id).toBe('19');
    expect(result[RECENT_LIMIT - 1]?.id).toBe('10');
  });

  test('letter chip keeps only clients whose normalized name starts with that letter', () => {
    const list = [c('1', 'Alpha', 1), c('2', 'Beta', 2), c('3', 'Álcool', 3)];
    const result = applyFilter({
      clients: list,
      query: '',
      activeFilter: { kind: 'letter', value: 'A' },
    });
    // Both 'Alpha' and 'Álcool' normalize to a start char 'a'.
    expect(result.map((r) => r.id).sort()).toEqual(['1', '3']);
  });

  test('query + letter filter intersects', () => {
    const list = [
      c('1', 'Alpha Store', 1),
      c('2', 'Amazing Shop', 2),
      c('3', 'Bravo Foods', 3),
    ];
    const result = applyFilter({
      clients: list,
      query: 'store',
      activeFilter: { kind: 'letter', value: 'A' },
    });
    expect(result.map((r) => r.id)).toEqual(['1']);
  });

  test('query + recent chip intersects', () => {
    const list = [
      c('1', 'Alpha Store', 100),
      c('2', 'Amazing Shop', 200),
      c('3', 'Bravo Foods', 50),
    ];
    const result = applyFilter({
      clients: list,
      query: 'shop',
      activeFilter: { kind: 'recent' },
    });
    expect(result.map((r) => r.id)).toEqual(['2']);
  });

  test('no-match combo returns empty', () => {
    const list = [c('1', 'Alpha', 1), c('2', 'Beta', 2)];
    expect(
      applyFilter({ clients: list, query: 'zzzz', activeFilter: null }),
    ).toEqual([]);
  });

  test('CNPJ digits-only query matches', () => {
    const list = [c('1', 'Loja A', 1, '12.345.678/0001-99')];
    const result = applyFilter({ clients: list, query: '12345', activeFilter: null });
    expect(result.map((r) => r.id)).toEqual(['1']);
  });

  test('diacritic-insensitive query matches diacritic name', () => {
    const list = [c('1', 'São Paulo', 1), c('2', 'Curitiba', 2)];
    const result = applyFilter({ clients: list, query: 'sao', activeFilter: null });
    expect(result.map((r) => r.id)).toEqual(['1']);
  });
});
