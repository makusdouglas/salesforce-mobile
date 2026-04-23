/**
 * Extract a first-name-ish label from the signed-in user's email.
 *
 * "markus@acme.com" → "markus"
 * null              → null           (GreetingBlock falls back to plain "Olá")
 * "no-at-sign"      → "no-at-sign"   (defensive: whole string, preserves unicode)
 *
 * Pure function. No network, no I/O.
 */
export function deriveGreetingName(email: string | null): string | null {
  if (email === null) return null;
  const trimmed = email.trim();
  if (trimmed.length === 0) return null;
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) return trimmed;
  if (atIndex === 0) return null;
  return trimmed.slice(0, atIndex);
}
