/**
 * 012-payment-receipts: sync mapper round-trip for payment_receipts.
 *
 * - Outbound push payload MUST include `attachment_url` and
 *   `correction_of_receipt_id` (both sync-visible) and MUST NOT include
 *   the four device-local attachment columns.
 * - Inbound pull MUST initialize the device-local columns to null so the
 *   WatermelonDB raw record is shape-complete for the model's typing.
 * - Orphan corrections (correction_of_receipt_id pointing at a receipt
 *   that has not yet been pulled locally) MUST insert cleanly — no
 *   rejection, no quarantine.
 */

import {
  mapPaymentReceiptServerRowToWMDB,
  mapPaymentReceiptWMDBRecordToServerPayload,
} from '@/features/sync/supabase/mappers';

const DEVICE_LOCAL_COLUMNS = [
  'attachment_local_path',
  'attachment_mime_type',
  'attachment_size_bytes',
  'attachment_upload_state',
] as const;

describe('push: payment_receipt payload excludes device-local columns', () => {
  it('shared columns pass through, device-local columns are stripped', () => {
    const payload = mapPaymentReceiptWMDBRecordToServerPayload({
      id: 'r-1',
      server_id: null,
      _status: 'created',
      _changed: '',
      updated_at: 123,
      order_id: 'o-1',
      amount: 15000,
      method: 'pix',
      received_at_ms: 1_700_000_000_000,
      attachment_url: 'receipt-attachments/seller/r-1.jpg',
      correction_of_receipt_id: null,
      notes: null,
      attachment_local_path: '/doc/receipts/staging/r-1.jpg',
      attachment_mime_type: 'image/jpeg',
      attachment_size_bytes: 2048,
      attachment_upload_state: 'synced',
    });

    expect(payload).toMatchObject({
      order_id: 'o-1',
      amount: 15000,
      method: 'pix',
      received_at_ms: 1_700_000_000_000,
      attachment_url: 'receipt-attachments/seller/r-1.jpg',
      correction_of_receipt_id: null,
      notes: null,
    });
    for (const col of DEVICE_LOCAL_COLUMNS) {
      expect(payload).not.toHaveProperty(col);
    }
  });

  it('correction rows push their `correction_of_receipt_id` reference', () => {
    const payload = mapPaymentReceiptWMDBRecordToServerPayload({
      id: 'r-correction',
      server_id: null,
      _status: 'created',
      _changed: '',
      updated_at: 1,
      order_id: 'o-1',
      amount: -1000,
      method: 'cash',
      received_at_ms: 2,
      attachment_url: null,
      correction_of_receipt_id: 'r-original',
      notes: null,
      attachment_local_path: null,
      attachment_mime_type: null,
      attachment_size_bytes: null,
      attachment_upload_state: null,
    });
    expect(payload).toMatchObject({
      amount: -1000,
      correction_of_receipt_id: 'r-original',
    });
  });
});

describe('pull: payment_receipt row initializes device-local columns to null', () => {
  it('a freshly-pulled row has all four attachment metadata columns set to null', () => {
    const wmdb = mapPaymentReceiptServerRowToWMDB({
      id: 'r-1',
      updated_at: new Date('2026-04-01T12:00:00Z').toISOString(),
      deleted_at: null,
      order_id: 'o-1',
      amount: 15000,
      method: 'pix',
      received_at_ms: 1_700_000_000_000,
      attachment_url: 'receipt-attachments/seller/r-1.jpg',
      correction_of_receipt_id: null,
      notes: null,
    });

    expect(wmdb).toMatchObject({
      order_id: 'o-1',
      amount: 15000,
      method: 'pix',
      attachment_url: 'receipt-attachments/seller/r-1.jpg',
      correction_of_receipt_id: null,
      attachment_local_path: null,
      attachment_mime_type: null,
      attachment_size_bytes: null,
      attachment_upload_state: null,
    });
  });

  it('orphan correction pulls do NOT reject — the reference is preserved verbatim', () => {
    const wmdb = mapPaymentReceiptServerRowToWMDB({
      id: 'r-orphan-correction',
      updated_at: new Date('2026-04-01T12:00:00Z').toISOString(),
      deleted_at: null,
      order_id: 'o-1',
      amount: -500,
      method: 'cash',
      received_at_ms: 1_700_000_000_000,
      attachment_url: null,
      correction_of_receipt_id: 'r-not-yet-pulled',
      notes: null,
    });
    expect(wmdb.correction_of_receipt_id).toBe('r-not-yet-pulled');
    // Row still inserts cleanly — no special "quarantine" field on the record.
    expect(wmdb).toHaveProperty('amount', -500);
  });
});
