export type SyncStatus = 'created' | 'updated' | 'deleted' | 'synced';
export type OrderStatus = 'draft' | 'sent' | 'canceled';
/** 009-order-assembly: discount stored on Order / OrderItem. */
export type DiscountMode = 'amount' | 'percent';
export type PaymentMethod = 'cash' | 'pix' | 'transfer' | 'card' | 'other';

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
