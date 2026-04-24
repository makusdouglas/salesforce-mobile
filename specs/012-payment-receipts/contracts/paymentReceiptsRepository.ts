/**
 * Contract: paymentReceiptsRepository (post-012 shape)
 *
 * Reference-only TypeScript signatures. The actual implementation lives at
 * `src/data/repositories/paymentReceiptsRepository.ts`.
 *
 * The append-only invariant is enforced here at the export boundary:
 * `update` and `softDelete` are intentionally NOT part of the public surface.
 */

import type { Observable } from 'rxjs';

import type PaymentReceipt from '../../../src/data/models/PaymentReceipt';

export type PaymentMethod = 'cash' | 'pix' | 'transfer' | 'check' | 'other';

export type AttachmentUploadState = 'pending' | 'synced' | 'failed';

export interface AttachmentInput {
  /** Absolute path to the staged file under `<docDir>/receipts/staging/<id>.<ext>`. */
  localPath: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/heic' | 'application/pdf';
  sizeBytes: number;
}

export interface PaymentReceiptCreateInput {
  orderId: string;
  /** Strictly > 0. Corrections (negative amounts) go through createCorrection. */
  amount: number;
  method: PaymentMethod;
  /** Defaults to Date.now() when omitted. No upper bound (future dates are legal). */
  receivedAtMs?: number;
  notes?: string;
  attachment?: AttachmentInput;
}

export interface PaymentReceiptCreateCorrectionInput {
  /** Must reference an existing receipt row (or an orphan-synced one). */
  originalId: string;
  /** Non-zero; may be positive (upward adjustment) or negative (reversal). */
  amount: number;
  method: PaymentMethod;
  receivedAtMs?: number;
  notes?: string;
  attachment?: AttachmentInput;
}

export interface PaymentReceiptsRepository {
  findById(id: string): Promise<PaymentReceipt | null>;

  observe(id: string): Observable<PaymentReceipt | null>;

  /** Newest-first by received_at_ms, ties broken by created_at. Excludes _status=deleted. */
  observeByOrder(orderId: string): Observable<PaymentReceipt[]>;

  /**
   * Creates a new receipt. Offline-first: does NOT await network.
   * Rejects amount <= 0 and unknown methods.
   */
  create(input: PaymentReceiptCreateInput): Promise<PaymentReceipt>;

  /**
   * Creates a new receipt whose correction_of_receipt_id references originalId.
   * The original row is NEVER mutated.
   * Rejects amount == 0 (any non-zero signed value is accepted).
   */
  createCorrection(input: PaymentReceiptCreateCorrectionInput): Promise<PaymentReceipt>;

  /**
   * Re-queues a failed attachment upload. Flips upload_state from 'failed' back to 'pending'.
   * No-op if the receipt has no attachment or upload_state is not 'failed'.
   */
  retryAttachmentUpload(receiptId: string): Promise<void>;
}

/* The following are intentionally absent from the public surface.
 *   update(id, patch): ...     // removed — append-only
 *   softDelete(id):   ...     // removed — append-only
 *   destroy(id):      ...     // removed — append-only
 */
