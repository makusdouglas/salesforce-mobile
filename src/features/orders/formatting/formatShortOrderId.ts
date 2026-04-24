/**
 * 013-orders-overview: derive a short, seller-friendly order identifier
 * from a UUID. Last 4 hex characters, uppercased, prefixed with '#'.
 *
 * Rationale (R8): gives the seller something tappable to search by or
 * reference on the phone ("#2041") without leaking the full UUID.
 * 65k suffixes is enough headroom for a solo seller's practical
 * catalog of orders.
 *
 * Note: feature 011 introduced an optional human-readable
 * `order_number` column (#YYYY-NNNN). Prefer that when present; fall
 * back to the uuid-suffix derivation for legacy / un-synced rows.
 */
export function formatShortOrderId(params: {
  id: string;
  orderNumber?: string | null;
}): string {
  if (params.orderNumber && params.orderNumber.trim() !== '') {
    return params.orderNumber.startsWith('#')
      ? params.orderNumber
      : `#${params.orderNumber}`;
  }
  const tail = params.id.replace(/-/g, '').slice(-4);
  return `#${tail.toUpperCase()}`;
}
