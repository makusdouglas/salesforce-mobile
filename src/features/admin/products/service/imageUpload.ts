import NetInfo from '@react-native-community/netinfo';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/data/supabase';

export type ImageUploadResult =
  | { status: 'ok'; url: string }
  | { status: 'cancelled' }
  | { status: 'permission_denied' }
  | { status: 'offline' }
  | { status: 'error'; message: string };

const BUCKET = 'product-images';
// Product images are always cropped to 4:3 landscape — this matches the
// list/detail thumbnails in the seller app and keeps every catalogue
// shot visually consistent.
const ASPECT_RATIO: [number, number] = [4, 3];
// Medium-low quality: 900 px wide (→ 675 px tall at 4:3) + 0.7 JPEG
// quality lands around 150–250 KB, keeping storage cost and seller-side
// list rendering snappy on low-end devices.
const TARGET_WIDTH = 900;
const TARGET_HEIGHT = Math.round((TARGET_WIDTH * ASPECT_RATIO[1]) / ASPECT_RATIO[0]);
const JPEG_QUALITY = 0.7;

export type ImageSource = 'library' | 'camera';

/**
 * Reliable connectivity check before attempting any storage write.
 * `isInternetReachable` is the authoritative flag — a device may be
 * connected to a captive portal but have no real internet.
 */
async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false) return false;
  // `isInternetReachable` can be null right after app start. Treat
  // null as "probably online" — we'd rather try and fail with a precise
  // error than spuriously block the save.
  return state.isInternetReachable !== false;
}

async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  // expo-file-system's File#arrayBuffer() is more reliable than
  // `fetch(file://...)` for local URIs produced by ImagePicker /
  // ImageManipulator — `fetch` used to fail with "Network request
  // failed" even when there was no network call in flight, which was
  // triggering a spurious offline banner.
  return await new File(uri).arrayBuffer();
}

function buildObjectPath(productId: string): string {
  const safeId = /^[a-zA-Z0-9-]+$/.test(productId) ? productId : 'new';
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `products/${safeId}/${unique}.jpg`;
}

function mapUploadErrorMessage(message: string): ImageUploadResult {
  // Narrow offline mapping: only the exact Supabase/RN fetch failure
  // string counts. Any other message is bubbled up so the admin sees
  // the real reason (RLS denial, Storage policy mismatch, file too big…).
  if (message === 'Network request failed' || message.startsWith('Network request failed')) {
    return { status: 'offline' };
  }
  return { status: 'error', message: message || 'Falha no upload da imagem.' };
}

async function runUploadPipeline(
  productId: string,
  sourceUri: string,
): Promise<ImageUploadResult> {
  // The picker already enforced 4:3 via `allowsEditing + aspect`, so the
  // manipulator only needs to resize to the target width. Height is
  // implicit — it follows the 4:3 ratio.
  const manipulated = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: TARGET_WIDTH, height: TARGET_HEIGHT } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  const buffer = await readFileAsArrayBuffer(manipulated.uri);
  const path = buildObjectPath(productId);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) {
    return mapUploadErrorMessage(uploadError.message ?? '');
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { status: 'ok', url: data.publicUrl };
}

export async function pickAndUploadImage(productId: string): Promise<ImageUploadResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { status: 'permission_denied' };
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Force a 4:3 crop step before we even hit the manipulator so the
      // admin sees the final framing in the native UI.
      allowsEditing: true,
      aspect: ASPECT_RATIO,
      quality: 1,
    });
    if (picked.canceled || picked.assets.length === 0) {
      return { status: 'cancelled' };
    }

    const asset = picked.assets[0];
    if (!asset) return { status: 'cancelled' };
    if (!(await isOnline())) return { status: 'offline' };
    return await runUploadPipeline(productId, asset.uri);
  } catch (err) {
    const message = (err as { message?: string })?.message ?? '';
    return mapUploadErrorMessage(message);
  }
}

export async function takePhotoAndUpload(productId: string): Promise<ImageUploadResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { status: 'permission_denied' };
    }

    const captured = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      // Force the post-capture crop step at 4:3 so the admin can adjust
      // the framing before the image is uploaded.
      allowsEditing: true,
      aspect: ASPECT_RATIO,
      // Expo already downsamples at capture time with lower quality,
      // which is cheap; the manipulator pass below still enforces the
      // final size + JPEG quality budget.
      quality: 0.8,
    });
    if (captured.canceled || captured.assets.length === 0) {
      return { status: 'cancelled' };
    }

    const asset = captured.assets[0];
    if (!asset) return { status: 'cancelled' };
    if (!(await isOnline())) return { status: 'offline' };
    return await runUploadPipeline(productId, asset.uri);
  } catch (err) {
    const message = (err as { message?: string })?.message ?? '';
    return mapUploadErrorMessage(message);
  }
}
