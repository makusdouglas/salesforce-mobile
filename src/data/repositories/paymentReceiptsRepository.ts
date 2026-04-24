import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import { generateId } from '../ids';
import PaymentReceipt from '../models/PaymentReceipt';
import type { AttachmentMimeType, AttachmentUploadState, PaymentMethod } from '../types';

import { throwNotFound, throwValidation } from './_errors';
import { applyTouchOnCreate } from './_touch';

/**
 * 012-payment-receipts: append-only repository surface.
 *
 * This module deliberately does NOT export `update()` or `softDelete()` /
 * `destroy()`. Receipts are immutable once created; corrections are new
 * rows that carry a reference back to the original via `createCorrection()`.
 * The static scan at `src/features/orders/receipts/appendOnlyReceipts.test.ts`
 * catches any future call site that tries to mutate a receipt directly.
 *
 * See specs/012-payment-receipts/contracts/paymentReceiptsRepository.ts for
 * the contract, and data-model.md for column semantics.
 */

const collection = database.get<PaymentReceipt>('payment_receipts');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'pix',
  'transfer',
  'check',
  'other',
];

const ALLOWED_MIME_TYPES: readonly AttachmentMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/pdf',
];

function isValidMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

function isValidMimeType(value: string): value is AttachmentMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export interface AttachmentInput {
  /** Absolute path under `<docDir>/receipts/staging/<id>.<ext>`. */
  localPath: string;
  mimeType: AttachmentMimeType;
  sizeBytes: number;
}

export interface PaymentReceiptCreateInput {
  /**
   * Optional pre-allocated id. Callers pass one when they need the receipt
   * id to be known BEFORE the row is inserted — e.g. the attachment-staging
   * pipeline stages a file at `<docDir>/receipts/staging/<id>.<ext>` and
   * the uploader builds its remote Storage path from the same id. When
   * omitted, the repo allocates a fresh id via generateId().
   */
  id?: string;
  orderId: string;
  /** Strictly > 0. Corrections (any non-zero signed value) go through createCorrection. */
  amount: number;
  method: PaymentMethod;
  /** Defaults to Date.now() when omitted. No upper bound (future dates are legal — FR-010). */
  receivedAtMs?: number;
  notes?: string;
  attachment?: AttachmentInput;
}

export interface PaymentReceiptCreateCorrectionInput {
  /** Optional pre-allocated id. See PaymentReceiptCreateInput.id. */
  id?: string;
  /** Must reference an existing receipt row. Orphan pulls (original not yet synced locally) are handled at the sync layer. */
  originalId: string;
  /** Non-zero; may be positive (upward adjustment) or negative (reversal). */
  amount: number;
  method: PaymentMethod;
  receivedAtMs?: number;
  notes?: string;
  attachment?: AttachmentInput;
}

function validateAttachment(attachment: AttachmentInput | undefined): void {
  if (attachment === undefined) return;
  if (attachment.localPath.trim() === '') {
    throwValidation('attachment.localPath is required', 'attachment.localPath');
  }
  if (!isValidMimeType(attachment.mimeType)) {
    throwValidation(
      `attachment.mimeType must be one of ${ALLOWED_MIME_TYPES.join(', ')}`,
      'attachment.mimeType',
    );
  }
  if (attachment.sizeBytes <= 0) {
    throwValidation('attachment.sizeBytes must be > 0', 'attachment.sizeBytes');
  }
}

function writeAttachmentFields(
  record: PaymentReceipt,
  attachment: AttachmentInput | undefined,
): void {
  if (attachment === undefined) {
    record.attachmentLocalPath = null;
    record.attachmentMimeType = null;
    record.attachmentSizeBytes = null;
    record.attachmentUploadState = null;
    record.attachmentUrl = null;
    return;
  }
  record.attachmentLocalPath = attachment.localPath;
  record.attachmentMimeType = attachment.mimeType;
  record.attachmentSizeBytes = attachment.sizeBytes;
  record.attachmentUploadState = 'pending' as AttachmentUploadState;
  record.attachmentUrl = null;
}

export const paymentReceiptsRepository = {
  async findById(id: string): Promise<PaymentReceipt | null> {
    return collection.find(id).catch(() => null);
  },

  observe(id: string) {
    return collection
      .findAndObserve(id)
      .pipe(catchError(() => of<PaymentReceipt | null>(null)));
  },

  /**
   * Newest-first by received_at_ms, ties broken by created_at_ms.
   * Sorting happens in-memory — MVP row counts are small (< 5 per order);
   * see data-model.md for the no-DB-index decision.
   */
  observeByOrder(orderId: string) {
    return collection.query(Q.where('order_id', orderId), notDeleted).observe();
  },

  async create(input: PaymentReceiptCreateInput): Promise<PaymentReceipt> {
    if (input.orderId.trim() === '') throwValidation('orderId is required', 'orderId');
    if (input.amount <= 0) throwValidation('amount must be > 0', 'amount');
    if (!isValidMethod(input.method)) {
      throwValidation(`method must be one of ${PAYMENT_METHODS.join(', ')}`, 'method');
    }
    validateAttachment(input.attachment);

    return database.write(async () =>
      collection.create((record) => {
        record._raw.id = input.id ?? generateId();
        record.orderId = input.orderId;
        record.amount = input.amount;
        record.method = input.method;
        record.receivedAtMs = input.receivedAtMs ?? Date.now();
        record.notes = input.notes ?? null;
        record.correctionOfReceiptId = null;
        writeAttachmentFields(record, input.attachment);
        applyTouchOnCreate(record);
      }),
    );
  },

  /**
   * Creates a new receipt whose `correction_of_receipt_id` references
   * `originalId`. The original row is NEVER mutated. Amount can be any
   * non-zero signed value.
   */
  async createCorrection(
    input: PaymentReceiptCreateCorrectionInput,
  ): Promise<PaymentReceipt> {
    if (input.originalId.trim() === '') {
      throwValidation('originalId is required', 'originalId');
    }
    if (input.amount === 0) throwValidation('amount must be non-zero', 'amount');
    if (!isValidMethod(input.method)) {
      throwValidation(`method must be one of ${PAYMENT_METHODS.join(', ')}`, 'method');
    }
    validateAttachment(input.attachment);

    const original = await collection.find(input.originalId).catch(() => null);
    if (!original) throwNotFound('paymentReceipt', input.originalId);

    return database.write(async () =>
      collection.create((record) => {
        record._raw.id = input.id ?? generateId();
        // Correction inherits the order the original belongs to — the
        // caller cannot redirect a correction to a different order.
        record.orderId = original.orderId;
        record.amount = input.amount;
        record.method = input.method;
        record.receivedAtMs = input.receivedAtMs ?? Date.now();
        record.notes = input.notes ?? null;
        record.correctionOfReceiptId = input.originalId;
        writeAttachmentFields(record, input.attachment);
        applyTouchOnCreate(record);
      }),
    );
  },

  /**
   * Re-queues a failed attachment upload. Flips `upload_state` from
   * 'failed' back to 'pending'. No-op otherwise.
   *
   * Note: this is the ONLY sanctioned mutation path on an existing
   * receipt row, and it only touches device-local sync-bookkeeping
   * columns — never business fields. The append-only static scan
   * whitelists this file explicitly.
   */
  async retryAttachmentUpload(receiptId: string): Promise<void> {
    const record = await collection.find(receiptId).catch(() => null);
    if (!record) throwNotFound('paymentReceipt', receiptId);
    if (record.attachmentUploadState !== 'failed') return;

    await database.write(async () => {
      await record.update((r) => {
        r.attachmentUploadState = 'pending' as AttachmentUploadState;
      });
    });
  },
};
