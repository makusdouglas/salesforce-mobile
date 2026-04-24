/**
 * 012-payment-receipts: opportunistic uploader that flushes pending
 * receipt attachments to Supabase Storage.
 *
 * Contract: specs/012-payment-receipts/contracts/receiptAttachmentUploader.ts.
 *
 * Behaviour:
 *   - `flushPending()` finds every receipt whose attachment_upload_state is
 *     'pending' AND that has a valid local file, uploads them serially
 *     (concurrency cap 2 to stay polite on mobile networks), and:
 *       • on success → flips state to 'synced' and persists the returned
 *         public URL in attachment_url.
 *       • on failure, retries up to 3 attempts with linear backoff (2s / 4s).
 *         After the last failure, state flips to 'failed' and the row
 *         surfaces a manual-retry button in PaymentReceiptDetailScreen.
 *   - `retry(receiptId)` flips 'failed' → 'pending' via
 *     paymentReceiptsRepository.retryAttachmentUpload. The next flushPending
 *     pass picks the row up.
 *
 * Called from syncService after a successful push pass — see T029.
 *
 * Storage path convention: receipt-attachments/<seller_id>/<receipt_id>.<ext>
 * Policies gate both SELECT + INSERT on the parent order's salesperson_id;
 * anything the client sends that violates RLS is rejected without mutation.
 */

import { Q } from '@nozbe/watermelondb';
import * as FileSystem from 'expo-file-system/legacy';

import { database } from '@/data/database';
import PaymentReceipt from '@/data/models/PaymentReceipt';
import { supabase } from '@/data/supabase';
import type { AttachmentMimeType } from '@/data/types';

import { __PATHS_ONLY__ } from './stage';

const BUCKET = 'receipt-attachments';
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [0, 2_000, 4_000];
const PARALLEL_CAP = 2;

export type UploadErrorKind =
  | 'network'
  | 'storage_rejected'
  | 'file_missing'
  | 'quota_exceeded'
  | 'auth_missing'
  | 'unknown';

export interface UploadOutcome {
  receiptId: string;
  ok: boolean;
  url?: string;
  error?: UploadErrorKind;
  attempts: number;
}

function extensionFor(mime: AttachmentMimeType): string {
  // Delegated to stage.ts to keep the extension map single-sourced.
  return __PATHS_ONLY__.extensionFor(mime);
}

async function readFileAsBytes(localPath: string): Promise<Uint8Array> {
  const uri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // Hermes (RN 0.72+) ships atob natively, which we use for cheap base64 → bytes.
   
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function classifyError(err: unknown): UploadErrorKind {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : typeof err === 'string'
        ? err.toLowerCase()
        : '';
  if (msg.includes('quota')) return 'quota_exceeded';
  if (msg.includes('network') || msg.includes('fetch failed')) return 'network';
  if (msg.includes('auth') || msg.includes('jwt')) return 'auth_missing';
  if (msg.includes('file') && msg.includes('missing')) return 'file_missing';
  if (msg.includes('row-level') || msg.includes('policy')) return 'storage_rejected';
  return 'unknown';
}

async function uploadOne(record: PaymentReceipt): Promise<UploadOutcome> {
  const localPath = record.attachmentLocalPath;
  const mime = record.attachmentMimeType;
  if (localPath === null || mime === null) {
    return { receiptId: record.id, ok: false, error: 'file_missing', attempts: 0 };
  }

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    return { receiptId: record.id, ok: false, error: 'auth_missing', attempts: 0 };
  }
  const remotePath = `${user.id}/${record.id}.${extensionFor(mime)}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const backoff = RETRY_BACKOFF_MS[attempt - 1] ?? 0;
    if (backoff > 0) await new Promise((r) => setTimeout(r, backoff));

    try {
      const bytes = await readFileAsBytes(localPath);
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(remotePath, bytes, {
          contentType: mime,
          upsert: false,
        });

      if (error) {
        const kind = classifyError(error);
        if (attempt === MAX_ATTEMPTS) {
          return { receiptId: record.id, ok: false, error: kind, attempts: attempt };
        }
        continue;
      }

      // Build the stored-object URL. For private buckets, this string is a
      // deterministic pointer the client uses with signed-URL flows later;
      // the actual signed-URL generation happens at preview time if/when
      // remote fetching is needed.
      const url = data?.path
        ? `${BUCKET}/${data.path}`
        : `${BUCKET}/${remotePath}`;

      await database.write(async () => {
        await record.update((r) => {
          r.attachmentUrl = url;
          r.attachmentUploadState = 'synced';
        });
      });
      return { receiptId: record.id, ok: true, url, attempts: attempt };
    } catch (err) {
      const kind = classifyError(err);
      if (attempt === MAX_ATTEMPTS) {
        return { receiptId: record.id, ok: false, error: kind, attempts: attempt };
      }
    }
  }

  return {
    receiptId: record.id,
    ok: false,
    error: 'unknown',
    attempts: MAX_ATTEMPTS,
  };
}

async function markFailed(record: PaymentReceipt): Promise<void> {
  await database.write(async () => {
    await record.update((r) => {
      r.attachmentUploadState = 'failed';
    });
  });
}

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<UploadOutcome>,
): Promise<UploadOutcome[]> {
  const results: UploadOutcome[] = [];
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      const out = await worker(item);
      results.push(out);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}

export const receiptAttachmentUploader = {
  /**
   * Idempotent. Safe to call concurrently with create/createCorrection;
   * per-row updates are atomic inside `database.write`.
   */
  async flushPending(): Promise<UploadOutcome[]> {
    const collection = database.get<PaymentReceipt>('payment_receipts');
    const pending = await collection
      .query(Q.where('attachment_upload_state', 'pending'))
      .fetch();

    if (pending.length === 0) return [];

    const outcomes = await runPool(pending, PARALLEL_CAP, async (rec) => {
      const outcome = await uploadOne(rec);
      if (!outcome.ok) {
        await markFailed(rec);
      }
      return outcome;
    });
    return outcomes;
  },

  /**
   * Flips a 'failed' row back to 'pending' so the next flushPending pass
   * picks it up. Delegates to paymentReceiptsRepository.retryAttachmentUpload,
   * which is the sanctioned mutation path.
   */
  async retry(receiptId: string): Promise<void> {
    const { paymentReceiptsRepository } = await import(
      '@/data/repositories/paymentReceiptsRepository'
    );
    await paymentReceiptsRepository.retryAttachmentUpload(receiptId);
  },
};
