/**
 * 012-payment-receipts: append-only contract for paymentReceiptsRepository.
 *
 * Locks the public surface: create + createCorrection + retryAttachmentUpload
 * + observers. Explicitly asserts that update/softDelete/destroy are NOT
 * exported — the static scan (appendOnlyReceipts.test.ts) enforces the
 * same rule at the file level, this test enforces it at the module level.
 */

/* eslint-disable import/first */
import { of } from 'rxjs';

const createMock = jest.fn();
const findMock = jest.fn();
const findAndObserveMock = jest.fn();
const observeMock = jest.fn();
const queryBuilder = jest.fn(() => ({ observe: observeMock }));

const collection = {
  create: createMock,
  find: findMock,
  findAndObserve: findAndObserveMock,
  query: queryBuilder,
};

const writeMock = jest.fn(async (fn: () => Promise<unknown> | unknown) => fn());

jest.mock('@/data/database', () => ({
  database: { get: () => collection, write: writeMock },
}));
jest.mock('@/data/ids', () => ({ generateId: () => 'gen-id' }));
jest.mock('@/data/repositories/_touch', () => ({
  applyTouchOnCreate: jest.fn(),
  applyTouchOnUpdate: jest.fn(),
  applyTouchOnSoftDelete: jest.fn(),
}));

import { DataLayerError } from '@/data/types';

import { paymentReceiptsRepository } from '../paymentReceiptsRepository';

beforeEach(() => {
  createMock.mockReset();
  findMock.mockReset();
  findAndObserveMock.mockReset();
  observeMock.mockReset();
  queryBuilder.mockClear();
  writeMock.mockClear();
});

/**
 * Builds a mock WMDB record whose setters just write to a plain bag.
 * `collection.create((rec) => void)` invokes the callback with this
 * record; we can then inspect `record._bag` to assert what was written.
 */
function mockRecord() {
  const bag: Record<string, unknown> = {};
  const _raw = { id: '' };
  return new Proxy(
    { _raw, _bag: bag, update: async (fn: (r: unknown) => void) => fn(bag) },
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
        if (p === 'update') return t.update;
        return bag[String(p)];
      },
    },
  ) as unknown as { _raw: { id: string }; _bag: Record<string, unknown> };
}

describe('paymentReceiptsRepository.create', () => {
  it('creates a receipt with defaults and zeroed attachment fields', async () => {
    const rec = mockRecord();
    createMock.mockImplementation(async (cb: (r: unknown) => void) => {
      cb(rec);
      return rec;
    });

    await paymentReceiptsRepository.create({
      orderId: 'order-1',
      amount: 150,
      method: 'pix',
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(rec._bag).toMatchObject({
      orderId: 'order-1',
      amount: 150,
      method: 'pix',
      notes: null,
      correctionOfReceiptId: null,
      attachmentLocalPath: null,
      attachmentMimeType: null,
      attachmentSizeBytes: null,
      attachmentUploadState: null,
      attachmentUrl: null,
    });
    expect(typeof rec._bag['receivedAtMs']).toBe('number');
  });

  it('writes attachment metadata with upload_state=pending when an attachment is provided', async () => {
    const rec = mockRecord();
    createMock.mockImplementation(async (cb: (r: unknown) => void) => {
      cb(rec);
      return rec;
    });

    await paymentReceiptsRepository.create({
      orderId: 'order-1',
      amount: 150,
      method: 'pix',
      attachment: {
        localPath: '/tmp/receipts/staging/a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
      },
    });

    expect(rec._bag).toMatchObject({
      attachmentLocalPath: '/tmp/receipts/staging/a.jpg',
      attachmentMimeType: 'image/jpeg',
      attachmentSizeBytes: 2048,
      attachmentUploadState: 'pending',
      attachmentUrl: null,
    });
  });

  it('rejects amount === 0', async () => {
    await expect(
      paymentReceiptsRepository.create({
        orderId: 'order-1',
        amount: 0,
        method: 'pix',
      }),
    ).rejects.toBeInstanceOf(DataLayerError);
  });

  it('rejects amount < 0 (negatives only via createCorrection)', async () => {
    await expect(
      paymentReceiptsRepository.create({
        orderId: 'order-1',
        amount: -10,
        method: 'pix',
      }),
    ).rejects.toBeInstanceOf(DataLayerError);
  });

  it('rejects unknown method values', async () => {
    await expect(
      paymentReceiptsRepository.create({
        orderId: 'order-1',
        amount: 100,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        method: 'boleto' as any,
      }),
    ).rejects.toBeInstanceOf(DataLayerError);
  });

  it('rejects attachments with a disallowed MIME type', async () => {
    await expect(
      paymentReceiptsRepository.create({
        orderId: 'order-1',
        amount: 100,
        method: 'pix',
        attachment: {
          localPath: '/tmp/a.webp',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mimeType: 'image/webp' as any,
          sizeBytes: 1,
        },
      }),
    ).rejects.toBeInstanceOf(DataLayerError);
  });
});

describe('paymentReceiptsRepository.createCorrection', () => {
  it('writes a new row with correction_of_receipt_id set to the original id', async () => {
    const original = { id: 'orig-1', orderId: 'order-42' };
    findMock.mockResolvedValueOnce(original);

    const rec = mockRecord();
    createMock.mockImplementation(async (cb: (r: unknown) => void) => {
      cb(rec);
      return rec;
    });

    await paymentReceiptsRepository.createCorrection({
      originalId: 'orig-1',
      amount: -10,
      method: 'cash',
    });

    expect(findMock).toHaveBeenCalledWith('orig-1');
    expect(rec._bag).toMatchObject({
      orderId: 'order-42', // inherited from the original
      amount: -10,
      method: 'cash',
      correctionOfReceiptId: 'orig-1',
    });
  });

  it('accepts a positive correction amount (upward adjustment)', async () => {
    findMock.mockResolvedValueOnce({ id: 'orig-1', orderId: 'order-42' });
    const rec = mockRecord();
    createMock.mockImplementation(async (cb: (r: unknown) => void) => {
      cb(rec);
      return rec;
    });

    await paymentReceiptsRepository.createCorrection({
      originalId: 'orig-1',
      amount: 500,
      method: 'pix',
    });

    expect(rec._bag).toMatchObject({ amount: 500, correctionOfReceiptId: 'orig-1' });
  });

  it('rejects amount === 0', async () => {
    findMock.mockResolvedValueOnce({ id: 'orig-1', orderId: 'order-42' });
    await expect(
      paymentReceiptsRepository.createCorrection({
        originalId: 'orig-1',
        amount: 0,
        method: 'pix',
      }),
    ).rejects.toBeInstanceOf(DataLayerError);
  });

  it('rejects when the original receipt cannot be found', async () => {
    findMock.mockRejectedValueOnce(new Error('not found'));
    await expect(
      paymentReceiptsRepository.createCorrection({
        originalId: 'missing',
        amount: 100,
        method: 'pix',
      }),
    ).rejects.toBeInstanceOf(DataLayerError);
  });

  it('does NOT mutate the original receipt', async () => {
    const original = { id: 'orig-1', orderId: 'order-42', amount: 10000 };
    const originalSnapshot = { ...original };
    findMock.mockResolvedValueOnce(original);
    const rec = mockRecord();
    createMock.mockImplementation(async (cb: (r: unknown) => void) => {
      cb(rec);
      return rec;
    });

    await paymentReceiptsRepository.createCorrection({
      originalId: 'orig-1',
      amount: -100,
      method: 'pix',
    });

    expect(original).toEqual(originalSnapshot);
  });
});

describe('paymentReceiptsRepository.retryAttachmentUpload', () => {
  it('flips failed → pending', async () => {
    const record = {
      attachmentUploadState: 'failed',
      update: jest.fn(async (fn: (r: unknown) => void) => {
        fn(record);
      }),
    };
    findMock.mockResolvedValueOnce(record);

    await paymentReceiptsRepository.retryAttachmentUpload('rcpt-1');

    expect(record.update).toHaveBeenCalledTimes(1);
    expect(record.attachmentUploadState).toBe('pending');
  });

  it('is a no-op when the receipt has no attachment (upload_state is null)', async () => {
    const record = {
      attachmentUploadState: null,
      update: jest.fn(),
    };
    findMock.mockResolvedValueOnce(record);

    await paymentReceiptsRepository.retryAttachmentUpload('rcpt-1');

    expect(record.update).not.toHaveBeenCalled();
  });

  it('is a no-op when the row is already synced', async () => {
    const record = {
      attachmentUploadState: 'synced',
      update: jest.fn(),
    };
    findMock.mockResolvedValueOnce(record);

    await paymentReceiptsRepository.retryAttachmentUpload('rcpt-1');

    expect(record.update).not.toHaveBeenCalled();
  });
});

describe('paymentReceiptsRepository.observeByOrder', () => {
  it('returns an observable of an array of receipts', async () => {
    observeMock.mockReturnValueOnce(of([{ id: 'r1' }, { id: 'r2' }]));
    const out = paymentReceiptsRepository.observeByOrder('order-1');
    await new Promise<void>((resolve) => {
      out.subscribe((rows) => {
        expect(Array.isArray(rows)).toBe(true);
        expect(rows).toHaveLength(2);
        resolve();
      });
    });
  });
});

describe('append-only surface', () => {
  it('does not export update()', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((paymentReceiptsRepository as any).update).toBeUndefined();
  });

  it('does not export softDelete()', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((paymentReceiptsRepository as any).softDelete).toBeUndefined();
  });

  it('does not export destroy()', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((paymentReceiptsRepository as any).destroy).toBeUndefined();
  });
});
