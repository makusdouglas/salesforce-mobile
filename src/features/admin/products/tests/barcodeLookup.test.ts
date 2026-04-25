jest.mock('@/data/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/features/sync/triggers/adminWriteTrigger', () => ({
  triggerSyncAfterAdminWrite: jest.fn(),
}));

import { lookupBarcode, normalizeBarcode } from '../service/barcodeLookup';
import { findProductByBarcode, ProductsApiError } from '../service/productsApi';

jest.mock('../service/productsApi', () => {
  const actual = jest.requireActual('../service/productsApi');
  return {
    ...actual,
    findProductByBarcode: jest.fn(),
  };
});

const findMock = findProductByBarcode as jest.MockedFunction<
  typeof findProductByBarcode
>;

const SAMPLE_PRODUCT = {
  id: 'p1',
  name: 'Bolo',
  description: null,
  category: 'Doces',
  base_price: 29.9,
  barcode: '7891234567890',
  image_url: null,
  active: true,
  deactivated_at: null,
  updated_at: new Date().toISOString(),
  deleted_at: null,
  variants: [],
};

describe('normalizeBarcode', () => {
  it('trims whitespace', () => {
    expect(normalizeBarcode('  7891  ')).toBe('7891');
  });
});

describe('lookupBarcode', () => {
  beforeEach(() => {
    findMock.mockReset();
  });

  it('returns no_match when the code is empty after normalization', async () => {
    const result = await lookupBarcode('   ');
    expect(result).toEqual({ status: 'no_match' });
    expect(findMock).not.toHaveBeenCalled();
  });

  it('returns match when the product exists', async () => {
    findMock.mockResolvedValueOnce(SAMPLE_PRODUCT);
    const result = await lookupBarcode('7891234567890');
    expect(result).toEqual({ status: 'match', product: SAMPLE_PRODUCT });
  });

  it('returns no_match when the product is absent (also covers soft-deleted)', async () => {
    findMock.mockResolvedValueOnce(null);
    const result = await lookupBarcode('7891234567890');
    expect(result).toEqual({ status: 'no_match' });
  });

  it('maps an offline ProductsApiError to status offline', async () => {
    findMock.mockRejectedValueOnce(
      new ProductsApiError('offline', 'Você está offline — conecte-se.'),
    );
    const result = await lookupBarcode('7891234567890');
    expect(result.status).toBe('offline');
  });

  it('maps other errors to status error', async () => {
    findMock.mockRejectedValueOnce(new Error('boom'));
    const result = await lookupBarcode('7891234567890');
    expect(result).toMatchObject({ status: 'error' });
  });
});
