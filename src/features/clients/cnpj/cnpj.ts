/**
 * CNPJ helpers. Format-only — no checksum, no duplicate detection.
 * Per constitution D3 and spec FR-007/FR-008/FR-009.
 */

export function normalize(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidFormat(raw: string): boolean {
  const digits = normalize(raw);
  return digits.length === 0 || digits.length === 14;
}
