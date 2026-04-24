/* eslint-disable import/first */

// Supabase client mock — each .from(...).insert/update returns a thenable
// that resolves with { data, error }.
const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockEq = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/data', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import {
  mapClientWMDBRecordToServerPayload,
  mapOrderItemWMDBRecordToServerPayload,
  mapOrderWMDBRecordToServerPayload,
  mapPaymentReceiptWMDBRecordToServerPayload,
} from '../supabase/mappers';
import { pushChanges } from '../supabase/pushChanges';

describe('payload mappers drop sync bookkeeping', () => {
  const syncFields = ['id', 'server_id', '_status', '_changed', 'updated_at', 'deleted_at'];

  test('client payload drops sync bookkeeping', () => {
    const rec = {
      id: 'local-uuid',
      server_id: null,
      _status: 'created',
      _changed: 'name',
      updated_at: 123,
      deleted_at: null,
      salesperson_id: 'sp-1',
      name: 'Acme',
      tax_id: '12345',
      phone: '555',
      email: null,
      address_line: null,
      notes: null,
    };
    const payload = mapClientWMDBRecordToServerPayload(rec);
    for (const f of syncFields) expect(payload).not.toHaveProperty(f);
    expect(payload).toMatchObject({ salesperson_id: 'sp-1', name: 'Acme' });
  });

  test('order payload drops sync bookkeeping', () => {
    const rec = {
      id: 'l',
      server_id: null,
      _status: 'created',
      _changed: '',
      updated_at: 1,
      deleted_at: null,
      client_id: 'c',
      salesperson_id: 'sp',
      status: 'draft',
      discount_amount: 0,
      notes: null,
      created_at_ms: 100,
      sent_at_ms: null,
      pdf_uri: null,
    };
    const payload = mapOrderWMDBRecordToServerPayload(rec);
    for (const f of syncFields) expect(payload).not.toHaveProperty(f);
  });

  test('order_item payload drops sync bookkeeping', () => {
    const rec = {
      id: 'l',
      server_id: 's',
      _status: 'updated',
      _changed: 'quantity',
      updated_at: 1,
      deleted_at: null,
      order_id: 'o',
      product_variant_id: 'pv',
      quantity: 2,
      unit_price: 10,
      discount_amount: 0,
    };
    const payload = mapOrderItemWMDBRecordToServerPayload(rec);
    for (const f of syncFields) expect(payload).not.toHaveProperty(f);
  });

  test('payment_receipt payload drops sync bookkeeping', () => {
    const rec = {
      id: 'l',
      server_id: 's',
      _status: 'created',
      _changed: '',
      updated_at: 1,
      deleted_at: null,
      order_id: 'o',
      amount: 100,
      method: 'pix',
      received_at_ms: 123,
      attachment_url: null,
      correction_of_receipt_id: null,
      notes: null,
      // 012-payment-receipts device-local columns — must be stripped
      // from the outbound payload.
      attachment_local_path: '/tmp/x.jpg',
      attachment_mime_type: 'image/jpeg',
      attachment_size_bytes: 100,
      attachment_upload_state: 'pending',
    };
    const payload = mapPaymentReceiptWMDBRecordToServerPayload(rec);
    for (const f of syncFields) expect(payload).not.toHaveProperty(f);
    // Device-local attachment columns MUST NOT travel upstream.
    expect(payload).not.toHaveProperty('attachment_local_path');
    expect(payload).not.toHaveProperty('attachment_mime_type');
    expect(payload).not.toHaveProperty('attachment_size_bytes');
    expect(payload).not.toHaveProperty('attachment_upload_state');
    // Shared columns MUST be present.
    expect(payload).toHaveProperty('attachment_url', null);
    expect(payload).toHaveProperty('correction_of_receipt_id', null);
  });
});

describe('pushChanges — read-only table guard', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
  });

  test('changes for products / product_variants / salespeople are dropped without network I/O', async () => {
    const changes = {
      products: { created: [], updated: [{ id: 'p1' } as never], deleted: [] },
      product_variants: {
        created: [{ id: 'pv1' } as never],
        updated: [],
        deleted: [],
      },
      salespeople: { created: [], updated: [], deleted: ['sp1'] },
    };
    await pushChanges({ changes, lastPulledAt: 0 });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('pushChanges — error classification', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockSelect.mockReset();
    mockSingle.mockReset();
    mockEq.mockReset();
  });

  test('401 maps to AUTH_REJECTED', async () => {
    // Simulate: from(...).insert(...).select(...).single() rejects with 401
    mockSingle.mockResolvedValue({ data: null, error: { status: 401, message: 'jwt expired' } });
    mockSelect.mockImplementation(() => ({ single: mockSingle }));
    mockInsert.mockImplementation(() => ({ select: mockSelect }));
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));

    const changes = {
      clients: {
        created: [
          {
            id: 'local-1',
            server_id: null,
            updated_at: 1,
            salesperson_id: 'sp',
            name: 'X',
            tax_id: null,
            phone: null,
            email: null,
            address_line: null,
            notes: null,
          } as never,
        ],
        updated: [],
        deleted: [],
      },
    };

    await expect(pushChanges({ changes, lastPulledAt: 0 })).rejects.toMatchObject({
      name: 'SyncError',
      code: 'AUTH_REJECTED',
    });
  });

  test('403 maps to PUSH_REJECTED', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { status: 403, code: '42501', message: 'permission denied' },
    });
    mockSelect.mockImplementation(() => ({ single: mockSingle }));
    mockInsert.mockImplementation(() => ({ select: mockSelect }));
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));

    const changes = {
      clients: {
        created: [
          {
            id: 'l',
            server_id: null,
            updated_at: 1,
            salesperson_id: 'sp',
            name: 'X',
            tax_id: null,
            phone: null,
            email: null,
            address_line: null,
            notes: null,
          } as never,
        ],
        updated: [],
        deleted: [],
      },
    };

    await expect(pushChanges({ changes, lastPulledAt: 0 })).rejects.toMatchObject({
      name: 'SyncError',
      code: 'PUSH_REJECTED',
    });
  });

  test('5xx maps to SERVER', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { status: 503, message: 'bad gateway' } });
    mockSelect.mockImplementation(() => ({ single: mockSingle }));
    mockInsert.mockImplementation(() => ({ select: mockSelect }));
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));

    const changes = {
      clients: {
        created: [
          {
            id: 'l',
            server_id: null,
            updated_at: 1,
            salesperson_id: 'sp',
            name: 'X',
            tax_id: null,
            phone: null,
            email: null,
            address_line: null,
            notes: null,
          } as never,
        ],
        updated: [],
        deleted: [],
      },
    };

    await expect(pushChanges({ changes, lastPulledAt: 0 })).rejects.toMatchObject({
      name: 'SyncError',
      code: 'SERVER',
    });
  });

  test('network-like error maps to NETWORK', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'network request failed' } });
    mockSelect.mockImplementation(() => ({ single: mockSingle }));
    mockInsert.mockImplementation(() => ({ select: mockSelect }));
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));

    const changes = {
      clients: {
        created: [
          {
            id: 'l',
            server_id: null,
            updated_at: 1,
            salesperson_id: 'sp',
            name: 'X',
            tax_id: null,
            phone: null,
            email: null,
            address_line: null,
            notes: null,
          } as never,
        ],
        updated: [],
        deleted: [],
      },
    };

    await expect(pushChanges({ changes, lastPulledAt: 0 })).rejects.toMatchObject({
      name: 'SyncError',
      code: 'NETWORK',
    });
  });
});
