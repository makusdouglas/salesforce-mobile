/**
 * 012-payment-receipts: two entry points to the device's capture / library
 * pickers. The capture form exposes "Câmera" and "Galeria / PDF" —
 * `pickFromCamera` implements the first; `pickFromLibrary` implements the
 * second and accepts either an image (via expo-image-picker) or a PDF
 * (via expo-document-picker), selected through an action sheet in the UI.
 *
 * Research R5 (specs/012-payment-receipts/research.md) justifies the
 * dual-picker split: iOS's photo picker does not return PDFs, so we route
 * documents through expo-document-picker and keep a uniform UX across
 * platforms.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { AttachmentMimeType } from '@/data/types';

export interface PickedFile {
  /** File:// URI produced by the picker. Caller stages this via `stage()`. */
  uri: string;
  mimeType: AttachmentMimeType;
  sizeBytes: number;
}

function normalizeImageMime(raw: string | undefined): AttachmentMimeType {
  const lower = raw?.toLowerCase() ?? 'image/jpeg';
  if (lower === 'image/png') return 'image/png';
  if (lower === 'image/heic' || lower === 'image/heif') return 'image/heic';
  // Default to JPEG — the most common camera output across platforms.
  return 'image/jpeg';
}

function ensureGranted(status: ImagePicker.PermissionStatus): void {
  if (status === 'granted') return;
  throw new Error('permission_denied');
}

/**
 * Opens the device camera and returns a single photo, or null if the user
 * cancels. Throws only when a permission is denied — the caller surfaces
 * this as an inline error in the form.
 */
export async function pickFromCamera(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  ensureGranted(perm.status);

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
    allowsEditing: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset === undefined) return null;
  return {
    uri: asset.uri,
    mimeType: normalizeImageMime(asset.mimeType),
    sizeBytes: asset.fileSize ?? 0,
  };
}

/**
 * Opens the OS library picker. The UI renders two buttons that both reach
 * this function: one routes to the image library (`kind: 'image'`), the
 * other to the document picker (`kind: 'pdf'`) via an action sheet.
 */
export async function pickFromLibrary(params: {
  kind: 'image' | 'pdf';
}): Promise<PickedFile | null> {
  if (params.kind === 'image') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    ensureGranted(perm.status);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (asset === undefined) return null;
    return {
      uri: asset.uri,
      mimeType: normalizeImageMime(asset.mimeType),
      sizeBytes: asset.fileSize ?? 0,
    };
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset === undefined) return null;
  return {
    uri: asset.uri,
    mimeType: 'application/pdf',
    sizeBytes: asset.size ?? 0,
  };
}
