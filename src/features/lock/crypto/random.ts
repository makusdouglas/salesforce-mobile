import * as Crypto from 'expo-crypto';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i] ?? 0;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

export async function generateSaltHex(byteLength: number = 16): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return toHex(bytes);
}
