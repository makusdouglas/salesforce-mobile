import * as FileSystem from 'expo-file-system/legacy';

const COOLDOWN_MS = 5_000;

const inFlight = new Map<string, Promise<void>>();
const failedAt = new Map<string, number>();

class AbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

export function isInFlight(url: string): boolean {
  return inFlight.has(url);
}

export async function downloadOnce(
  url: string,
  dest: string,
  signal?: AbortSignal,
): Promise<void> {
  const now = Date.now();
  const lastFailure = failedAt.get(url);
  if (lastFailure !== undefined && now - lastFailure < COOLDOWN_MS) {
    throw new Error('DOWNLOAD_FAILED_COOLDOWN');
  }

  const existing = inFlight.get(url);
  if (existing) return existing;

  if (signal?.aborted) throw new AbortError();

  const task = (async () => {
    try {
      const result = await FileSystem.downloadAsync(url, dest, { md5: false, cache: true });
      if (signal?.aborted) {
        await FileSystem.deleteAsync(dest, { idempotent: true });
        throw new AbortError();
      }
      if (result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(dest, { idempotent: true });
        failedAt.set(url, Date.now());
        throw new Error(`DOWNLOAD_FAILED_STATUS_${result.status}`);
      }
      failedAt.delete(url);
    } catch (err) {
      if (!(err instanceof AbortError)) {
        failedAt.set(url, Date.now());
      }
      throw err;
    }
  })();

  inFlight.set(url, task);
  try {
    await task;
  } finally {
    inFlight.delete(url);
  }
}

export function _resetDownloadState(): void {
  inFlight.clear();
  failedAt.clear();
}
