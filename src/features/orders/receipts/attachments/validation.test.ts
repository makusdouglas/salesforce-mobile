/**
 * 012-payment-receipts: attachment validation unit tests.
 *
 * Covers FR-013 MIME allow-list + FR-014 10 MB cap behaviour (shrink for
 * images, reject for PDFs), plus the manipulator-failure surface.
 */

/* eslint-disable import/first */
const manipulateAsyncMock = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: manipulateAsyncMock,
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

import {
  AttachmentValidationError,
  validateAttachment,
  __TEST_ONLY__,
} from './validation';

beforeEach(() => {
  manipulateAsyncMock.mockReset();
});

describe('validateAttachment', () => {
  it('accepts a 1 MB JPEG as-is (no shrink)', async () => {
    const out = await validateAttachment({
      uri: 'file:///tmp/a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1_048_576,
    });
    expect(out.wasShrunk).toBe(false);
    expect(out.uri).toBe('file:///tmp/a.jpg');
    expect(manipulateAsyncMock).not.toHaveBeenCalled();
  });

  it('accepts a 9 MB PDF as-is', async () => {
    const out = await validateAttachment({
      uri: 'file:///tmp/a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 9 * 1024 * 1024,
    });
    expect(out.wasShrunk).toBe(false);
    expect(manipulateAsyncMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown MIME type', async () => {
    await expect(
      validateAttachment({
        uri: 'file:///tmp/a.webp',
         
        mimeType: 'image/webp' as any,
        sizeBytes: 1024,
      }),
    ).rejects.toMatchObject({
      name: 'AttachmentValidationError',
      reason: 'mime_not_allowed',
    });
  });

  it('rejects a PDF > 10 MB outright (no shrink attempt)', async () => {
    await expect(
      validateAttachment({
        uri: 'file:///tmp/a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 15 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({
      name: 'AttachmentValidationError',
      reason: 'size_exceeded_pdf',
    });
    expect(manipulateAsyncMock).not.toHaveBeenCalled();
  });

  it('shrinks an oversized image via expo-image-manipulator', async () => {
    manipulateAsyncMock.mockResolvedValueOnce({ uri: 'file:///tmp/shrunk.jpg' });
    const out = await validateAttachment({
      uri: 'file:///tmp/big.heic',
      mimeType: 'image/heic',
      sizeBytes: 15 * 1024 * 1024,
    });
    expect(manipulateAsyncMock).toHaveBeenCalledTimes(1);
    expect(out.wasShrunk).toBe(true);
    expect(out.uri).toBe('file:///tmp/shrunk.jpg');
    // Output is normalized to JPEG regardless of input format.
    expect(out.mimeType).toBe('image/jpeg');
    // sizeBytes is the sentinel 0 — stage() re-stats post-copy.
    expect(out.sizeBytes).toBe(0);
  });

  it('propagates manipulator errors as AttachmentValidationError(shrink_failed)', async () => {
    manipulateAsyncMock.mockRejectedValueOnce(new Error('native module crash'));
    await expect(
      validateAttachment({
        uri: 'file:///tmp/big.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(AttachmentValidationError);
  });

  it('exposes sanity constants for the test surface', () => {
    expect(__TEST_ONLY__.MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(__TEST_ONLY__.MAX_IMAGE_DIMENSION).toBe(2048);
    expect(__TEST_ONLY__.ALLOWED_MIME_TYPES).toContain('application/pdf');
  });
});
