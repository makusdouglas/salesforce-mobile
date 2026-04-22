import { deriveProductDTO, sortProducts, type VariantDisplayDTO } from '../types';

const baseProduct = {
  id: 'p1',
  name: 'Refri Cola',
  description: null,
  imageUrl: null,
  unit: null,
  category: 'Bebidas',
};

function variant(id: string, label: string, price: number | null): VariantDisplayDTO {
  return { id, label, price, barcode: null, attributes: label };
}

describe('deriveProductDTO', () => {
  test('basePrice = min of non-null variant prices', () => {
    const dto = deriveProductDTO(baseProduct, [
      variant('v1', 'Garrafa 2L', 8.9),
      variant('v2', 'Lata 350ml', 3.5),
      variant('v3', 'Pet 600ml', 4.9),
    ]);
    expect(dto.basePrice).toBe(3.5);
    expect(dto.variantCount).toBe(3);
  });

  test('basePrice is null when every variant has no price', () => {
    const dto = deriveProductDTO(baseProduct, [
      variant('v1', 'Garrafa 2L', null),
      variant('v2', 'Lata 350ml', null),
    ]);
    expect(dto.basePrice).toBeNull();
    expect(dto.variantCount).toBe(2);
  });

  test('basePrice ignores null prices', () => {
    const dto = deriveProductDTO(baseProduct, [
      variant('v1', 'Garrafa 2L', 10),
      variant('v2', 'Lata 350ml', null),
    ]);
    expect(dto.basePrice).toBe(10);
    expect(dto.variantCount).toBe(2);
  });

  test('DTO preserves product fields verbatim', () => {
    const dto = deriveProductDTO(
      { ...baseProduct, imageUrl: 'https://x/a.jpg', description: 'desc', unit: 'un' },
      [],
    );
    expect(dto).toMatchObject({
      id: 'p1',
      name: 'Refri Cola',
      description: 'desc',
      imageUrl: 'https://x/a.jpg',
      unit: 'un',
      category: 'Bebidas',
      variantCount: 0,
    });
  });
});

describe('sortProducts', () => {
  const dto = (id: string, name: string) =>
    deriveProductDTO({ ...baseProduct, id, name }, []);

  test('alphabetical order by name (pt-BR locale)', () => {
    const sorted = sortProducts([dto('3', 'Café'), dto('1', 'Açaí'), dto('2', 'Biscoito')]);
    expect(sorted.map((p) => p.name)).toEqual(['Açaí', 'Biscoito', 'Café']);
  });

  test('empty input returns empty', () => {
    expect(sortProducts([])).toEqual([]);
  });
});
