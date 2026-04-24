export type SyncStatus = 'created' | 'updated' | 'deleted' | 'synced';
export type OrderStatus = 'draft' | 'sent' | 'canceled';
/** 009-order-assembly: discount stored on Order / OrderItem. */
export type DiscountMode = 'amount' | 'percent';
// 012-payment-receipts: the historical `card` enum from 002 is rewritten
// to `check` to match the business vocabulary (Cheque). There are no
// production rows predating 012, so the rewrite is safe; the migration
// UPDATEs any dev-fixture rows in-place.
export type PaymentMethod = 'cash' | 'pix' | 'transfer' | 'check' | 'other';

// 012-payment-receipts: attachment metadata stored inline on payment_receipts
// rows (1:1 lifetime with the receipt — no separate table). See data-model.md.
export type AttachmentUploadState = 'pending' | 'synced' | 'failed';
export type AttachmentMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/heic'
  | 'application/pdf';

export type DataLayerErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'FOREIGN_KEY' | 'STATE_TRANSITION';

export class DataLayerError extends Error {
  readonly code: DataLayerErrorCode;
  readonly field?: string;

  constructor(code: DataLayerErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'DataLayerError';
    this.code = code;
    if (field !== undefined) {
      this.field = field;
    }
  }
}
