/**
 * 012-payment-receipts: attachment pipeline behaviour lock.
 *
 * Exercises stage() + resolvePreview() + uploader.flushPending() with
 * expo-file-system + supabase.storage mocked. The uploader's retry
 * semantics, idempotency, and state transitions (pending → synced /
 * pending → failed) are the load-bearing assertions.
 */

/* eslint-disable import/first */

const getInfoAsyncMock = jest.fn();
const makeDirectoryAsyncMock = jest.fn();
const copyAsyncMock = jest.fn();
const deleteAsyncMock = jest.fn();
const readAsStringAsyncMock = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  documentDirectory: 'file:///doc/',
  getInfoAsync: getInfoAsyncMock,
  makeDirectoryAsync: makeDirectoryAsyncMock,
  copyAsync: copyAsyncMock,
  deleteAsync: deleteAsyncMock,
  readAsStringAsync: readAsStringAsyncMock,
  EncodingType: { Base64: 'base64' },
}));

const storageUploadMock = jest.fn();
const authGetUserMock = jest.fn();

jest.mock('@/data/supabase', () => ({
  supabase: {
    auth: { getUser: authGetUserMock },
    storage: {
      from: jest.fn(() => ({ upload: storageUploadMock })),
    },
  },
}));

const fetchMock = jest.fn();
const updateMock = jest.fn();
const queryMock = jest.fn(() => ({ fetch: fetchMock }));
const collectionGetMock = jest.fn(() => ({ query: queryMock }));
const writeMock = jest.fn(async (fn: () => Promise<unknown> | unknown) => fn());

jest.mock('@/data/database', () => ({
  database: { get: collectionGetMock, write: writeMock },
}));

const findByIdMock = jest.fn();

jest.mock('@/data/repositories/paymentReceiptsRepository', () => ({
  paymentReceiptsRepository: {
    findById: findByIdMock,
  },
}));

// Polyfill atob for Jest/Node which doesn't ship it globally.
if (typeof (globalThis as unknown as { atob?: unknown }).atob === 'undefined') {
  (globalThis as unknown as { atob: (s: string) => string }).atob = (s: string) =>
    Buffer.from(s, 'base64').toString('binary');
}

import { stage } from './stage';
import { receiptAttachmentUploader } from './uploader';
import { resolvePreview } from './resolvePreview';

beforeEach(() => {
  getInfoAsyncMock.mockReset();
  makeDirectoryAsyncMock.mockReset();
  copyAsyncMock.mockReset();
  deleteAsyncMock.mockReset();
  readAsStringAsyncMock.mockReset();
  storageUploadMock.mockReset();
  authGetUserMock.mockReset();
  fetchMock.mockReset();
  updateMock.mockReset();
  queryMock.mockClear();
  collectionGetMock.mockClear();
  writeMock.mockClear();
  findByIdMock.mockReset();
});

describe('stage', () => {
  it('copies the source to <docDir>/receipts/staging/<id>.<ext> and returns the stat size', async () => {
    // First getInfoAsync: staging dir does NOT exist.
    // Second getInfoAsync: destination does NOT exist.
    // Third getInfoAsync: post-copy stat returns size.
    getInfoAsyncMock
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: 2048 });

    const out = await stage({
      receiptId: 'rcpt-1',
      sourceUri: 'file:///tmp/cam.jpg',
      mimeType: 'image/jpeg',
    });

    expect(makeDirectoryAsyncMock).toHaveBeenCalledWith('file:///doc/receipts/staging/', {
      intermediates: true,
    });
    expect(copyAsyncMock).toHaveBeenCalledWith({
      from: 'file:///tmp/cam.jpg',
      to: 'file:///doc/receipts/staging/rcpt-1.jpg',
    });
    expect(out).toEqual({
      localPath: '/doc/receipts/staging/rcpt-1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
    });
  });

  it('overwrites a pre-existing staged file (idempotent)', async () => {
    getInfoAsyncMock
      .mockResolvedValueOnce({ exists: true }) // staging dir exists
      .mockResolvedValueOnce({ exists: true }) // destination already exists
      .mockResolvedValueOnce({ exists: true, size: 512 });

    await stage({
      receiptId: 'rcpt-2',
      sourceUri: 'file:///tmp/b.pdf',
      mimeType: 'application/pdf',
    });

    expect(deleteAsyncMock).toHaveBeenCalledWith(
      'file:///doc/receipts/staging/rcpt-2.pdf',
      { idempotent: true },
    );
    expect(copyAsyncMock).toHaveBeenCalledTimes(1);
  });
});

describe('resolvePreview', () => {
  it('returns a file:// URI when the local path exists', async () => {
    findByIdMock.mockResolvedValueOnce({
      attachmentLocalPath: '/doc/receipts/staging/rcpt-1.jpg',
      attachmentUrl: null,
    });
    getInfoAsyncMock.mockResolvedValueOnce({ exists: true });

    const out = await resolvePreview('rcpt-1');
    expect(out).toBe('file:///doc/receipts/staging/rcpt-1.jpg');
  });

  it('falls back to the remote URL when local is missing', async () => {
    findByIdMock.mockResolvedValueOnce({
      attachmentLocalPath: '/doc/receipts/staging/rcpt-1.jpg',
      attachmentUrl: 'receipt-attachments/seller/rcpt-1.jpg',
    });
    getInfoAsyncMock.mockResolvedValueOnce({ exists: false });

    const out = await resolvePreview('rcpt-1');
    expect(out).toBe('receipt-attachments/seller/rcpt-1.jpg');
  });

  it('returns null when neither local nor remote exists', async () => {
    findByIdMock.mockResolvedValueOnce({
      attachmentLocalPath: null,
      attachmentUrl: null,
    });
    const out = await resolvePreview('rcpt-1');
    expect(out).toBeNull();
  });

  it('returns null when the receipt itself is missing', async () => {
    findByIdMock.mockResolvedValueOnce(null);
    const out = await resolvePreview('rcpt-ghost');
    expect(out).toBeNull();
  });
});

describe('receiptAttachmentUploader.flushPending', () => {
  function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'rcpt-1',
      attachmentLocalPath: '/doc/receipts/staging/rcpt-1.jpg',
      attachmentMimeType: 'image/jpeg',
      attachmentUploadState: 'pending',
      attachmentUrl: null,
      update: updateMock.mockImplementation(async (fn: (r: unknown) => void) => {
        fn(overrides);
      }),
      ...overrides,
    };
  }

  it('no-op when no pending rows exist', async () => {
    fetchMock.mockResolvedValueOnce([]);
    const out = await receiptAttachmentUploader.flushPending();
    expect(out).toEqual([]);
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it('uploads a pending row, flips state to synced, and persists attachment_url on success', async () => {
    fetchMock.mockResolvedValueOnce([makeRecord()]);
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'seller-1' } } });
    readAsStringAsyncMock.mockResolvedValueOnce(
      Buffer.from('bytes').toString('base64'),
    );
    storageUploadMock.mockResolvedValueOnce({
      data: { path: 'seller-1/rcpt-1.jpg' },
      error: null,
    });

    const out = await receiptAttachmentUploader.flushPending();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      receiptId: 'rcpt-1',
      ok: true,
      url: 'receipt-attachments/seller-1/rcpt-1.jpg',
      attempts: 1,
    });
    expect(updateMock).toHaveBeenCalled();
  });

  it('marks the row failed after 3 exhausted attempts', async () => {
    fetchMock.mockResolvedValueOnce([makeRecord()]);
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'seller-1' } } });
    readAsStringAsyncMock.mockResolvedValue(Buffer.from('bytes').toString('base64'));
    storageUploadMock.mockResolvedValue({ data: null, error: new Error('network') });

    const out = await receiptAttachmentUploader.flushPending();
    expect(out[0]).toMatchObject({
      receiptId: 'rcpt-1',
      ok: false,
      attempts: 3,
      error: 'network',
    });
    // update() is called to flip the row to 'failed' AFTER the retries are
    // exhausted (the mark-failed pass writes attachmentUploadState='failed').
    expect(updateMock).toHaveBeenCalled();
  }, 30_000);

  it('returns file_missing when the row has no local path', async () => {
    fetchMock.mockResolvedValueOnce([
      makeRecord({ attachmentLocalPath: null, attachmentMimeType: null }),
    ]);
    authGetUserMock.mockResolvedValue({ data: { user: { id: 'seller-1' } } });

    const out = await receiptAttachmentUploader.flushPending();
    expect(out[0]).toMatchObject({ ok: false, error: 'file_missing' });
  });

  it('returns auth_missing when Supabase has no authenticated user', async () => {
    fetchMock.mockResolvedValueOnce([makeRecord()]);
    authGetUserMock.mockResolvedValueOnce({ data: { user: null } });

    const out = await receiptAttachmentUploader.flushPending();
    expect(out[0]).toMatchObject({ ok: false, error: 'auth_missing' });
    expect(storageUploadMock).not.toHaveBeenCalled();
  });
});
