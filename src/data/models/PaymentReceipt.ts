import { Model, type Relation } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import type { AttachmentMimeType, AttachmentUploadState, PaymentMethod } from '../types';
import type Order from './Order';

export default class PaymentReceipt extends Model {
  static table = 'payment_receipts';

  static associations = {
    orders: { type: 'belongs_to' as const, key: 'order_id' },
    // 012-payment-receipts: self-FK for append-only corrections. A
    // correction row references the receipt it corrects via
    // correction_of_receipt_id; the original row is never mutated.
    payment_receipts: { type: 'belongs_to' as const, key: 'correction_of_receipt_id' },
  };

  @field('order_id') orderId!: string;
  @field('amount') amount!: number;
  @field('method') method!: PaymentMethod;
  @field('received_at_ms') receivedAtMs!: number;

  // 012-payment-receipts: attachment metadata stored inline. The legacy
  // image_url column still exists in the schema (v4 left it behind) but
  // is no longer read or written by this model — see schema v5 notes.
  @field('attachment_url') attachmentUrl!: string | null;
  @field('attachment_local_path') attachmentLocalPath!: string | null;
  @field('attachment_mime_type') attachmentMimeType!: AttachmentMimeType | null;
  @field('attachment_size_bytes') attachmentSizeBytes!: number | null;
  @field('attachment_upload_state') attachmentUploadState!: AttachmentUploadState | null;

  // 012-payment-receipts: populated only by paymentReceiptsRepository
  // .createCorrection(); null on regular receipts.
  @field('correction_of_receipt_id') correctionOfReceiptId!: string | null;

  @field('notes') notes!: string | null;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @relation('orders', 'order_id') order!: Relation<Order>;
  @relation('payment_receipts', 'correction_of_receipt_id')
  correctionOf!: Relation<PaymentReceipt>;
}
