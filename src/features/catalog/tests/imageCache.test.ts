import * as FileSystem from 'expo-file-system/legacy';

import { imageCache } from '../image-cache/imageCache';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/docs/',
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn((_alg: string, url: string) => {
    // Deterministic 64-hex digest from URL for tests.
    let h = 0;
    for (let i = 0; i < url.length; i++) {
      h = (h * 31 + url.charCodeAt(i)) & 0xffffffff;
    }
    const seed = (h >>> 0).toString(16).padStart(8, '0');
    return Promise.resolve(seed.repeat(8).slice(0, 64));
  }),
}));

type Mock = jest.Mock;

const fs = FileSystem as unknown as {
  makeDirectoryAsync: Mock;
  getInfoAsync: Mock;
  readDirectoryAsync: Mock;
  downloadAsync: Mock;
  deleteAsync: Mock;
};

const virtualDisk = new Set<string>();

beforeEach(async () => {
  virtualDisk.clear();
  fs.makeDirectoryAsync.mockReset().mockResolvedValue(undefined);
  fs.getInfoAsync.mockReset().mockImplementation((path: string) =>
    Promise.resolve({ exists: virtualDisk.has(path) }),
  );
  fs.readDirectoryAsync.mockReset().mockImplementation(() =>
    Promise.resolve(
      Array.from(virtualDisk).map((p) => p.replace('/mock/docs/product-images/', '')),
    ),
  );
  fs.downloadAsync.mockReset().mockImplementation((_url: string, dest: string) => {
    virtualDisk.add(dest);
    return Promise.resolve({ status: 200 });
  });
  fs.deleteAsync.mockReset().mockImplementation((path: string) => {
    virtualDisk.delete(path);
    return Promise.resolve(undefined);
  });
  await imageCache._reset();
});

describe('imageCache', () => {
  test('single-flight: two concurrent calls produce one download', async () => {
    const url = 'https://example.com/a.jpg';
    const [u1, u2] = await Promise.all([
      imageCache.getCachedUri(url),
      imageCache.getCachedUri(url),
    ]);
    expect(u1).toBe(u2);
    expect(fs.downloadAsync).toHaveBeenCalledTimes(1);
  });

  test('prefetch no-op on hot entries', async () => {
    const url = 'https://example.com/b.jpg';
    await imageCache.getCachedUri(url);
    expect(fs.downloadAsync).toHaveBeenCalledTimes(1);
    await imageCache.prefetch([url]);
    expect(fs.downloadAsync).toHaveBeenCalledTimes(1);
  });

  test('orphan eviction deletes files whose URL is not in valid set', async () => {
    const orphan = 'https://example.com/orphan.jpg';
    const keep = 'https://example.com/keep.jpg';
    await imageCache.getCachedUri(orphan);
    await imageCache.getCachedUri(keep);
    expect(virtualDisk.size).toBe(2);

    const removed = await imageCache.evictOrphans([keep]);
    expect(removed).toBe(1);
    expect(virtualDisk.size).toBe(1);
  });

  test('eviction does not remove in-flight downloads', async () => {
    const url = 'https://example.com/slow.jpg';
    let resolveDl: ((v: { status: number }) => void) | undefined;
    fs.downloadAsync.mockImplementationOnce(
      (_u: string, dest: string) =>
        new Promise<{ status: number }>((r) => {
          resolveDl = (v) => {
            virtualDisk.add(dest);
            r(v);
          };
        }),
    );

    const pending = imageCache.getCachedUri(url);
    await new Promise((r) => setTimeout(r, 0));
    const removed = await imageCache.evictOrphans([]);
    expect(removed).toBe(0);

    resolveDl?.({ status: 200 });
    await pending;
  });

  test('rebuild from disk without re-download when file already present', async () => {
    const url = 'https://example.com/existing.jpg';
    await imageCache.getCachedUri(url);
    const calls1 = fs.downloadAsync.mock.calls.length;

    // Simulate app restart: clear in-memory state but keep file on disk.
    await imageCache._reset();
    for (const p of Array.from(virtualDisk)) {
      // Re-populate disk state that we nuked with _reset.
      virtualDisk.add(p);
    }
    // Actually _reset also cleared virtualDisk via fs.deleteAsync → let's re-seed:
    virtualDisk.clear();
    const knownPath = '/mock/docs/product-images/';
    // Seed the hashed path for this URL by running one real round trip via mocks:
    fs.downloadAsync.mockImplementationOnce((_u: string, dest: string) => {
      virtualDisk.add(dest);
      return Promise.resolve({ status: 200 });
    });
    await imageCache.getCachedUri(url);
    const seededPath = Array.from(virtualDisk).find((p) => p.startsWith(knownPath));
    expect(seededPath).toBeDefined();

    // Now clear in-memory map but keep the seeded file on disk.
    await imageCache._reset();
    // _reset called deleteAsync which removed from virtualDisk; re-add to simulate persistence:
    virtualDisk.add(seededPath!);

    const callsBefore = fs.downloadAsync.mock.calls.length;
    await imageCache.getCachedUri(url);
    const callsAfter = fs.downloadAsync.mock.calls.length;
    expect(callsAfter).toBe(callsBefore); // no new download
    expect(callsAfter).toBeGreaterThan(calls1);
  });

  test('download failure surfaces rejection', async () => {
    const url = 'https://example.com/missing.jpg';
    fs.downloadAsync.mockImplementationOnce(() => Promise.resolve({ status: 404 }));
    await expect(imageCache.getCachedUri(url)).rejects.toThrow();
  });

  test('failed-URL cooldown short-circuits repeat calls within 5 s', async () => {
    const url = 'https://example.com/fail.jpg';
    fs.downloadAsync.mockImplementationOnce(() => Promise.resolve({ status: 404 }));
    await expect(imageCache.getCachedUri(url)).rejects.toThrow();
    const callsAfterFail = fs.downloadAsync.mock.calls.length;
    await expect(imageCache.getCachedUri(url)).rejects.toThrow(/COOLDOWN/);
    expect(fs.downloadAsync.mock.calls.length).toBe(callsAfterFail);
  });
});
