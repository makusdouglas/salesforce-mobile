// 011-order-email-delivery: two tiny pure helpers for the send path.
//
// - `clientSlug(name)`: a filesystem-safe slug used in the stable PDF
//   filename `pedido-<orderNumber>-<slug>.pdf`. Strips accents, lowercases,
//   collapses non-alphanumerics to dashes, truncates to 40 chars.
// - `isLikelyEmail(s)`: a minimal shape check (NOT RFC-strict) used both
//   by the SendHint copy and by orderSendService to decide between the
//   mail-composer intent and the generic-share fallback (FR-004 + U1).

const MAX_SLUG_LEN = 40;
const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clientSlug(rawName: string | null | undefined): string {
  if (!rawName) return 'cliente';
  const normalized = rawName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_LEN);
  return normalized || 'cliente';
}

export function isLikelyEmail(s: string | null | undefined): boolean {
  if (!s) return false;
  const trimmed = String(s).trim();
  if (!trimmed) return false;
  return EMAIL_SHAPE_RE.test(trimmed);
}
