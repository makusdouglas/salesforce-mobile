import * as FileSystem from 'expo-file-system/legacy';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

const documentDirectory = FileSystem.documentDirectory ?? '';

export const CACHE_DIR = documentDirectory + 'product-images/';

const EXT_REGEX = /\.([a-z0-9]+)(?:\?.*)?$/i;

export async function mkPath(url: string): Promise<string> {
  const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, url);
  const short = hash.slice(0, 16);
  const match = url.match(EXT_REGEX);
  const ext = match?.[1]?.toLowerCase() ?? '';
  return ext ? `${CACHE_DIR}${short}.${ext}` : `${CACHE_DIR}${short}`;
}
