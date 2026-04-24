import { findProductByBarcode, type ProductWithVariants } from './productsApi';

export type BarcodeLookupResult =
  | { status: 'match'; product: ProductWithVariants }
  | { status: 'no_match' }
  | { status: 'offline' }
  | { status: 'error'; message: string };

export function normalizeBarcode(raw: string): string {
  return raw.trim();
}

export async function lookupBarcode(code: string): Promise<BarcodeLookupResult> {
  const normalized = normalizeBarcode(code);
  if (normalized.length === 0) return { status: 'no_match' };
  try {
    const product = await findProductByBarcode(normalized);
    if (product) return { status: 'match', product };
    return { status: 'no_match' };
  } catch (err) {
    const e = err as { kind?: string; message?: string };
    if (e?.kind === 'offline' || /fetch|network/i.test(e?.message ?? '')) {
      return { status: 'offline' };
    }
    return { status: 'error', message: e?.message ?? 'Erro ao verificar o código.' };
  }
}
