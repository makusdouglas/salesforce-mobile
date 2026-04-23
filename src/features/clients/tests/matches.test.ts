import { matchesQuery } from '../search/matches';
import type { ClientListItemDTO } from '../types';

function client(
  overrides: Partial<ClientListItemDTO> & Pick<ClientListItemDTO, 'name'>,
): ClientListItemDTO {
  return {
    id: overrides.id ?? 'c1',
    name: overrides.name,
    taxId: overrides.taxId ?? null,
    addressSnippet: overrides.addressSnippet ?? null,
    contactSnippet: overrides.contactSnippet ?? null,
    updatedAt: overrides.updatedAt ?? 0,
    isPendingSync: overrides.isPendingSync ?? false,
  };
}

describe('matchesQuery', () => {
  test('empty query returns true', () => {
    expect(matchesQuery(client({ name: 'Loja A' }), '')).toBe(true);
  });

  test('name substring at start matches', () => {
    expect(matchesQuery(client({ name: 'Mercearia São Paulo' }), 'merc')).toBe(true);
  });

  test('name substring in the middle matches', () => {
    expect(matchesQuery(client({ name: 'Mercearia São Paulo' }), 'sao')).toBe(true);
  });

  test('name substring at end matches', () => {
    expect(matchesQuery(client({ name: 'Mercearia São Paulo' }), 'paulo')).toBe(true);
  });

  test('CNPJ digits-only query matches stored formatted CNPJ', () => {
    expect(
      matchesQuery(client({ name: 'Loja B', taxId: '12345678000199' }), '12345'),
    ).toBe(true);
  });

  test('CNPJ digits-only query matches stored formatted CNPJ (with punctuation in stored)', () => {
    expect(
      matchesQuery(
        client({ name: 'Loja B', taxId: '12.345.678/0001-99' }),
        '12345',
      ),
    ).toBe(true);
  });

  test('CNPJ query does not match when client.taxId is null', () => {
    expect(matchesQuery(client({ name: 'Loja B', taxId: null }), '12345')).toBe(false);
  });

  test('no-match returns false', () => {
    expect(matchesQuery(client({ name: 'Loja B', taxId: null }), 'zzzz')).toBe(false);
  });

  test('name match is diacritic-insensitive (relies on pre-normalized query)', () => {
    // Caller normalizes the query — test with already-normalized "sao paulo".
    expect(matchesQuery(client({ name: 'São Paulo' }), 'sao paulo')).toBe(true);
  });
});
