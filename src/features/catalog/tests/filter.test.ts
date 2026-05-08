import { applyFilter } from '../search/filter';
import { deriveProductDTO, type ProductDisplayDTO, type VariantDisplayDTO } from '../types';

function variant(id: string, label: string): VariantDisplayDTO {
  return { id, label, price: 10, barcode: null, attributes: label };
}

function dto(
  id: string,
  name: string,
  category: string | null,
  variants: VariantDisplayDTO[] = [],
): ProductDisplayDTO {
  return deriveProductDTO(
    { id, name, description: null, imageUrl: null, unit: null, category },
    variants,
  );
}

const products: readonly ProductDisplayDTO[] = [
  dto('1', 'Refri Cola', 'Bebidas', [variant('v1', 'Garrafa 2L')]),
  dto('2', 'Salgadinho Queijo', 'Snacks'),
  dto('3', 'Sabonete Hidratante', 'Higiene'),
  dto('4', 'Amaciante 500ml', 'Limpeza'),
  dto('5', 'Café Torrado', 'Bebidas'),
  dto('6', 'Biscoito Recheado', null), // null category
];

describe('applyFilter', () => {
  test('empty query + null category returns original reference', () => {
    const result = applyFilter({ products, query: '', activeCategory: null });
    expect(result).toBe(products);
  });

  test('category only narrows to matching category', () => {
    const result = applyFilter({ products, query: '', activeCategory: 'Bebidas' });
    expect(result.map((p) => p.name)).toEqual(['Refri Cola', 'Café Torrado']);
  });

  test('query only matches name across categories', () => {
    const result = applyFilter({ products, query: 'cola', activeCategory: null });
    expect(result.map((p) => p.name)).toEqual(['Refri Cola']);
  });

  test('category + query compose as intersection', () => {
    const result = applyFilter({ products, query: 'refri', activeCategory: 'Bebidas' });
    expect(result.map((p) => p.name)).toEqual(['Refri Cola']);
  });

  test('null-category products are filtered out when category is active', () => {
    const result = applyFilter({ products, query: '', activeCategory: 'Bebidas' });
    expect(result.find((p) => p.name === 'Biscoito Recheado')).toBeUndefined();
  });

  test('whitespace-trimmed category matching', () => {
    const withWs = [dto('7', 'Chá Gelado', 'Bebidas ')];
    const result = applyFilter({ products: withWs, query: '', activeCategory: 'Bebidas' });
    expect(result).toHaveLength(1);
  });

  test('diacritic-insensitive query match', () => {
    const result = applyFilter({ products, query: 'cafe', activeCategory: null });
    expect(result.map((p) => p.name)).toEqual(['Café Torrado']);
  });

  test('variant-label match when variants are populated', () => {
    const result = applyFilter({ products, query: 'garrafa', activeCategory: null });
    expect(result.map((p) => p.name)).toEqual(['Refri Cola']);
  });

  test('no match returns empty array', () => {
    const result = applyFilter({ products, query: 'xyzzy', activeCategory: null });
    expect(result).toEqual([]);
  });

  test('uppercase query is normalized before matching', () => {
    const result = applyFilter({ products, query: 'COLA', activeCategory: null });
    expect(result.map((p) => p.name)).toEqual(['Refri Cola']);
  });
});
