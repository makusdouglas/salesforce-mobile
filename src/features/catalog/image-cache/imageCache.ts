import * as FileSystem from 'expo-file-system/legacy';

import * as cacheStore from './cacheStore';
import { downloadOnce, isInFlight, _resetDownloadState } from './download';
import { CACHE_DIR, mkPath } from './paths';

const PARALLEL_CAP = 4;

let activeAbort: AbortController | null = null;

async function getCachedUri(url: string): Promise<string> {
  await cacheStore.ensureCacheDir();

  const mapped = cacheStore.get(url);
  if (mapped !== undefined) {
    const info = await FileSystem.getInfoAsync(mapped);
    if (info.exists) return toFileUri(mapped);
    cacheStore.remove(url);
  }

  const expected = await mkPath(url);
  const info = await FileSystem.getInfoAsync(expected);
  if (info.exists) {
    cacheStore.set(url, expected);
    return toFileUri(expected);
  }

  const signal = activeAbort?.signal;
  await downloadOnce(url, expected, signal);
  cacheStore.set(url, expected);
  return toFileUri(expected);
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function prefetch(urls: readonly string[]): Promise<void> {
  if (activeAbort) activeAbort.abort();
  activeAbort = new AbortController();
  const signal = activeAbort.signal;

  const unique = Array.from(new Set(urls));
  let index = 0;
  const workers: Promise<void>[] = [];

  async function worker(): Promise<void> {
    while (index < unique.length) {
      if (signal.aborted) return;
      const url = unique[index++];
      if (url === undefined) return;
      try {
        await getCachedUri(url);
      } catch {
        // Per-URL failures are isolated; continue.
      }
    }
  }

  for (let i = 0; i < Math.min(PARALLEL_CAP, unique.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  if (activeAbort?.signal === signal) activeAbort = null;
}

async function evictOrphans(validUrls: readonly string[]): Promise<number> {
  await cacheStore.ensureCacheDir();

  const validPaths = new Set(
    await Promise.all(validUrls.map((u) => mkPath(u))),
  );
  const files = await FileSystem.readDirectoryAsync(CACHE_DIR);

  let removed = 0;
  for (const file of files) {
    const fullPath = `${CACHE_DIR}${file}`;
    if (validPaths.has(fullPath)) continue;

    const url = findUrlForPath(fullPath);
    if (url !== undefined && isInFlight(url)) continue;

    await FileSystem.deleteAsync(fullPath, { idempotent: true });
    if (url !== undefined) cacheStore.remove(url);
    removed++;
  }

  for (const [url] of cacheStore.entries()) {
    if (!validUrls.includes(url)) cacheStore.remove(url);
  }

  return removed;
}

function findUrlForPath(path: string): string | undefined {
  for (const [url, filePath] of cacheStore.entries()) {
    if (filePath === path) return url;
  }
  return undefined;
}

async function _reset(): Promise<void> {
  activeAbort?.abort();
  activeAbort = null;
  cacheStore._reset();
  _resetDownloadState();
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  } catch {
    // best-effort
  }
}

export const imageCache = {
  getCachedUri,
  prefetch,
  evictOrphans,
  _reset,
};
