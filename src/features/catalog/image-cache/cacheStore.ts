import * as FileSystem from 'expo-file-system/legacy';

import { CACHE_DIR } from './paths';

const urlToPath = new Map<string, string>();
let dirEnsured = false;

export async function ensureCacheDir(): Promise<void> {
  if (dirEnsured) return;
  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  dirEnsured = true;
}

export function get(url: string): string | undefined {
  return urlToPath.get(url);
}

export function set(url: string, filePath: string): void {
  urlToPath.set(url, filePath);
}

export function remove(url: string): void {
  urlToPath.delete(url);
}

export function entries(): [string, string][] {
  return Array.from(urlToPath.entries());
}

export function _reset(): void {
  urlToPath.clear();
  dirEnsured = false;
}
