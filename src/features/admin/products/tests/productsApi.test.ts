/* eslint-disable @typescript-eslint/no-explicit-any */
type MockState = {
  productInsertRows: Record<string, unknown>[];
  productUpdateRows: Array<{ id?: string; patch: Record<string, unknown> }>;
  variantUpserts: Array<Record<string, unknown>[]>;
  variantDeletes: string[][];
  selectById: null | Record<string, unknown>;
  nextInsertError: null | { code: string; message: string };
  nextVariantError: null | { code: string; message: string };
};

const state: MockState = {
  productInsertRows: [],
  productUpdateRows: [],
  variantUpserts: [],
  variantDeletes: [],
  selectById: null,
  nextInsertError: null,
  nextVariantError: null,
};

const fromMock = jest.fn((table: string) => {
  if (table === 'products') {
    return {
      insert: (payload: Record<string, unknown>) => ({
        select: () => ({
          single: () =>
            Promise.resolve(
              state.nextInsertError
                ? { data: null, error: state.nextInsertError }
                : (state.productInsertRows.push(payload),
                  { data: { id: 'new-product-id' }, error: null }),
            ),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: string) =>
          Promise.resolve(
            state.nextInsertError
              ? { error: state.nextInsertError, data: null }
              : (state.productUpdateRows.push({ id, patch }),
                { error: null, data: null }),
          ),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: state.selectById, error: null }),
          is: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: state.selectById, error: null }),
          }),
        }),
        is: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    };
  }
  if (table === 'product_variants') {
    return {
      upsert: (rows: Record<string, unknown>[]) =>
        Promise.resolve(
          state.nextVariantError
            ? { error: state.nextVariantError }
            : (state.variantUpserts.push(rows), { error: null }),
        ),
      update: (patch: Record<string, unknown>) => ({
        in: (_col: string, ids: string[]) =>
          Promise.resolve(
            state.nextVariantError
              ? { error: state.nextVariantError }
              : (state.variantDeletes.push(ids), void patch, { error: null }),
          ),
      }),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

jest.mock('@/data/supabase', () => ({
  supabase: { from: fromMock },
}));

jest.mock('@/features/sync/triggers/adminWriteTrigger', () => ({
  triggerSyncAfterAdminWrite: jest.fn(),
}));

import { triggerSyncAfterAdminWrite } from '@/features/sync/triggers/adminWriteTrigger';

import {
  ProductsApiError,
  saveProduct,
  type VariantInput,
} from '../service/productsApi';

function resetState() {
  state.productInsertRows.length = 0;
  state.productUpdateRows.length = 0;
  state.variantUpserts.length = 0;
  state.variantDeletes.length = 0;
  state.selectById = {
    id: 'new-product-id',
    name: 'Bolo',
    description: null,
    category: null,
    base_price: 10,
    barcode: null,
    image_url: null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    variants: [],
  };
  state.nextInsertError = null;
  state.nextVariantError = null;
  (triggerSyncAfterAdminWrite as jest.Mock).mockReset();
}

describe('saveProduct', () => {
  beforeEach(resetState);

  it('creates a product + variants and triggers a sync pull', async () => {
    const variants: VariantInput[] = [
      { id: undefined, label: 'Pequeno', price: 10, _delete: undefined },
    ];
    const saved = await saveProduct({
      id: undefined,
      name: 'Bolo',
      description: null,
      category: null,
      base_price: 10,
      barcode: null,
      image_url: null,
      variants,
    });

    expect(saved.id).toBe('new-product-id');
    expect(state.productInsertRows).toHaveLength(1);
    expect(state.variantUpserts[0]).toEqual([
      expect.objectContaining({
        product_id: 'new-product-id',
        label: 'Pequeno',
        price: 10,
      }),
    ]);
    expect(triggerSyncAfterAdminWrite).toHaveBeenCalled();
  });

  it('maps Postgres 23505 to a barcode_conflict error', async () => {
    state.nextInsertError = { code: '23505', message: 'duplicate key' };
    await expect(
      saveProduct({
        id: undefined,
        name: 'Bolo',
        description: null,
        category: null,
        base_price: 10,
        barcode: '7891',
        image_url: null,
        variants: [],
      }),
    ).rejects.toBeInstanceOf(ProductsApiError);
  });
});
