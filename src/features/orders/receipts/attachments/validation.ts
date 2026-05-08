/**
 * 012-payment-receipts: attachment size + MIME gates.
 *
 * FR-013: MIME allow-list is image/jpeg, image/png, image/heic,
 *         application/pdf.
 * FR-014: size cap is 10 MB. Images > 10 MB are shrunk via
 *         expo-image-manipulator (compress: 0.75, max 2048px). PDFs >
 *         10 MB are rejected outright.
 *
 * Research R6 justifies the shrink-on-images path over a hard reject —
 * modern phones routinely capture > 10 MB photos and asking the user to
 * "try again with a smaller file" is poor UX. See contracts.
 */

import * as ImageManipulator from 'expo-image-manipulator';

import type { AttachmentMimeType } from '@/data/types';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_DIMENSION = 2048; // longer side
const SHRINK_COMPRESSION = 0.75;

const ALLOWED_MIME_TYPES: readonly AttachmentMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/pdf',
];

export class AttachmentValidationError extends Error {
  constructor(
    public readonly reason:
      | 'mime_not_allowed'
      | 'size_exceeded_pdf'
      | 'size_exceeded_image_even_after_shrink'
      | 'shrink_failed',
    message: string,
  ) {
    super(message);
    this.name = 'AttachmentValidationError';
  }
}

export interface ValidationInput {
  uri: string;
  mimeType: AttachmentMimeType;
  sizeBytes: number;
}

export interface ValidationOutput {
  uri: string;
  mimeType: AttachmentMimeType;
  sizeBytes: number;
  /** True when the returned URI is a newly-created manipulated file. */
  wasShrunk: boolean;
}

function isAllowedMime(raw: string): raw is AttachmentMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(raw);
}

/**
 * Validates + (optionally) shrinks an attachment. Returns a new
 * `ValidationOutput` whose URI / size reflect the shrink outcome when
 * one happened.
 */
export async function validateAttachment(input: ValidationInput): Promise<ValidationOutput> {
  if (!isAllowedMime(input.mimeType)) {
    throw new AttachmentValidationError(
      'mime_not_allowed',
      `Tipo de arquivo não suportado: ${input.mimeType}`,
    );
  }

  // Fast path: already within the cap.
  if (input.sizeBytes <= MAX_SIZE_BYTES) {
    return { ...input, wasShrunk: false };
  }

  if (input.mimeType === 'application/pdf') {
    // Cannot re-encode PDFs cheaply on-device; reject.
    throw new AttachmentValidationError(
      'size_exceeded_pdf',
      'O PDF ultrapassa 10 MB. Escolha um arquivo menor.',
    );
  }

  // Image path: shrink via expo-image-manipulator and re-check size.
  let result: ImageManipulator.ImageResult;
  try {
    result = await ImageManipulator.manipulateAsync(
      input.uri,
      [{ resize: { width: MAX_IMAGE_DIMENSION } }],
      {
        compress: SHRINK_COMPRESSION,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
  } catch (err) {
    throw new AttachmentValidationError(
      'shrink_failed',
      `Falha ao otimizar a imagem: ${err instanceof Error ? err.message : 'desconhecido'}`,
    );
  }

  // The manipulator does not report the new file size; the caller (stage.ts)
  // re-stat's the file after copying. We pass through a size of 0 here as
  // a sentinel and let the staging step write the true size.
  return {
    uri: result.uri,
    mimeType: 'image/jpeg', // manipulator output is JPEG after compress
    sizeBytes: 0, // will be filled by stage()
    wasShrunk: true,
  };
}

export const __TEST_ONLY__ = {
  MAX_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
  SHRINK_COMPRESSION,
  ALLOWED_MIME_TYPES,
};
