/**
 * 012-payment-receipts: offline behavioural lock (T031).
 *
 * Replaces the send-path-style `noNetworkOnReceiptCreate.test.ts` static
 * scan with a behavioural assertion — the create path legitimately
 * touches the file system (attachment staging) and might reach the sync
 * engine (the uploader), but it MUST complete and return a persisted row
 * even when every network call is stubbed to reject.
 *
 * This does NOT exercise the uploader (the uploader runs inside the sync
 * engine, not inside create). It exercises `paymentReceiptsRepository
 * .create()` and `.createCorrection()` with the Supabase client failing
 * hard, proving the create path is truly offline-first.
 */

/* eslint-disable import/first */

const createMock = jest.fn();
const findMock = jest.fn();
const writeMock = jest.fn(async (fn: () => Promise<unknown> | unknown) => fn());

const collection = { create: createMock, find: findMock };

jest.mock('@/data/database', () => ({
  database: { get: () => collection, write: writeMock },
}));
jest.mock('@/data/ids', () => ({ generateId: () => 'gen-id' }));
jest.mock('@/data/repositories/_touch', () => ({
  applyTouchOnCreate: jest.fn(),
  applyTouchOnUpdate: jest.fn(),
  applyTouchOnSoftDelete: jest.fn(),
}));

// Stub Supabase so that ANY call throws. The create path must NOT touch it.
jest.mock('@/data/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get: () => {
        throw new Error('create() path must not reach the network');
      },
    },
  ),
}));

import { paymentReceiptsRepository } from '@/data/repositories/paymentReceiptsRepository';

beforeEach(() => {
  createMock.mockReset();
  findMock.mockReset();
  writeMock.mockClear();
});

function mockRecord() {
  const bag: Record<string, unknown> = {};
  const _raw = { id: '' };
  return new Proxy(
    { _raw, _bag: bag },
    {
      set(_t, p, v) {
        if (p === '_raw') {
          _raw.id = (v as { id: string }).id;
          return true;
        }
        bag[String(p)] = v;
        return true;
      },
      get(t, p) {
        if (p === '_raw') return _raw;
        if (p === '_bag') return bag;
        return bag[String(p)];
      },
    },
  ) as unknown as { _raw: { id: string }; _bag: Record<string, unknown> };
}

describe('receipt create path is offline-first', () => {
  it('create() completes without touching Supabase', async () => {
    const rec = mockRecord();
    createMock.mockImplementation(async (cb: (r: unknown) => void) => {
      cb(rec);
      return rec;
    });

    await expect(
      paymentReceiptsRepository.create({
        orderId: 'o-1',
        amount: 100,
        method: 'pix',
      }),
    ).resolves.toBeTruthy();

    // A pending attachment (when present) must persist with state='pending'
    // and attachmentUrl=null — uploader runs separately, not from here.
    expect(rec._bag).toMatchObject({
      orderId: 'o-1',
      amount: 100,
      method: 'pix',
      attachmentUrl: null,
    });
  });

  it('create() persists attachment metadata with upload_state=pending (not synced)', async () => {
    const rec = mockRecord();
    createMock.mockImplementation(async (cb: (r: unknown) => void) => {
      cb(rec);
      return rec;
    });

    await paymentReceiptsRepository.create({
      orderId: 'o-1',
      amount: 100,
      method: 'pix',
      attachment: {
        localPath: '/tmp/staging/a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      },
    });

    expect(rec._bag).toMatchObject({
      attachmentLocalPath: '/tmp/staging/a.jpg',
      attachmentMimeType: 'image/jpeg',
      attachmentSizeBytes: 1024,
      attachmentUploadState: 'pending',
      attachmentUrl: null,
    });
  });

  it('createCorrection() completes without touching Supabase', async () => {
    findMock.mockResolvedValueOnce({ id: 'orig-1', orderId: 'o-1' });
    const rec = mockRecord();
    createMock.mockImplementation(async (cb: (r: unknown) => void) => {
      cb(rec);
      return rec;
    });

    await expect(
      paymentReceiptsRepository.createCorrection({
        originalId: 'orig-1',
        amount: -50,
        method: 'cash',
      }),
    ).resolves.toBeTruthy();

    expect(rec._bag).toMatchObject({
      orderId: 'o-1',
      amount: -50,
      correctionOfReceiptId: 'orig-1',
    });
  });
});
