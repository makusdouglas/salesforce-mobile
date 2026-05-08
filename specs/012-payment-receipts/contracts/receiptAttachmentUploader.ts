/**
 * Contract: receiptAttachmentUploader
 *
 * Reference-only TypeScript signatures. Implementation lives at
 * `src/features/orders/receipts/attachments/uploader.ts` (plus sibling files).
 *
 * Invoked by the sync engine during the push phase, AFTER receipt rows have
 * been accepted by Supabase. Idempotent. Runs entirely on the background
 * JS thread; no UI blocking.
 */

export interface UploadAttempt {
  receiptId: string;
  attempt: number; // 1-based
  bytes: number;
  startedAtMs: number;
}

export interface UploadOutcome {
  receiptId: string;
  ok: boolean;
  /** Populated on success; shape: https://<project>.supabase.co/storage/v1/object/sign/receipt-attachments/<seller>/<receipt>.<ext> */
  url?: string;
  error?: 'network' | 'storage_rejected' | 'file_missing' | 'quota_exceeded' | 'unknown';
  attempts: number;
}

export interface ReceiptAttachmentUploader {
  /**
   * Finds all receipts with attachment_upload_state === 'pending' that have a
   * valid local file, uploads them serially (PARALLEL_CAP = 2 to stay
   * polite on mobile networks), flips state to 'synced' on success, records
   * 'failed' after 3 attempts, and persists the returned Storage URL.
   *
   * Safe to call concurrently with create/createCorrection; the uploader's
   * DB reads are snapshot-isolated per row.
   */
  flushPending(): Promise<UploadOutcome[]>;

  /**
   * Re-queues a single 'failed' row back to 'pending'. Typically called from
   * the retry button in PaymentReceiptDetailScreen.
   */
  retry(receiptId: string): Promise<void>;

  /**
   * Resolves the preview URI for an attachment. Prefers attachment_local_path
   * when the file exists; falls back to the catalog image-cache resolver for
   * attachment_url (which itself streams + caches on first hit).
   *
   * Never throws; returns null when the receipt has no attachment or both
   * paths resolve to a missing file.
   */
  resolvePreview(receiptId: string): Promise<string | null>;
}
