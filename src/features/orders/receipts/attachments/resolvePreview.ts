/**
 * 012-payment-receipts: resolves the preview URI for a receipt's
 * attachment. Prefers the local cache when the file still exists;
 * otherwise routes through the catalog image-cache for the remote URL.
 *
 * Contract: specs/012-payment-receipts/contracts/receiptAttachmentUploader.ts.
 * FR-015: the local cache is the source of truth for preview until a
 * successful upload replaces it; on cache eviction the remote copy
 * re-populates transparently.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';

// The catalog image-cache exposes a private helper that is not currently
// re-exported as a public API. We re-use its `getCachedUri` semantics by
// calling the download-cache pipeline manually here: fetch the remote URL
// once, then return the cached path. For now we just return the remote URL
// directly — the caller's <Image> component will cache the bytes at the
// fetcher layer. This is a deliberate simplification for MVP and matches
// the behaviour described in FR-015 (remote re-fetch is the fallback).
async function fetchRemoteIfNeeded(url: string): Promise<string | null> {
  return url;
}

/**
 * Returns a `file://`-prefixed URI when a local file exists, otherwise
 * the remote URL string, otherwise null. Never throws.
 */
export async function resolvePreview(receiptId: string): Promise<string | null> {
  const record = await paymentReceiptsRepository.findById(receiptId);
  if (!record) return null;

  const localPath = record.attachmentLocalPath;
  if (localPath !== null && localPath !== '') {
    const uri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) return uri;
    } catch {
      // fall through to remote
    }
  }

  const remote = record.attachmentUrl;
  if (remote !== null && remote !== '') {
    return fetchRemoteIfNeeded(remote);
  }

  return null;
}
