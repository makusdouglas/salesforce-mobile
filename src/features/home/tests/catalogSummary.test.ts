import { deriveCatalogSummary } from '../hooks/catalogSummary';

describe('deriveCatalogSummary', () => {
  test('empty array → count 0', () => {
    expect(deriveCatalogSummary([])).toEqual({ count: 0 });
  });

  test('single element → count 1', () => {
    expect(deriveCatalogSummary([{ id: 'p1' }])).toEqual({ count: 1 });
  });

  test('multiple elements → count matches length', () => {
    const products = Array.from({ length: 17 }, (_, i) => ({ id: `p${i}` }));
    expect(deriveCatalogSummary(products)).toEqual({ count: 17 });
  });
});
