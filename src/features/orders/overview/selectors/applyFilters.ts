import type {
  OrdersOverviewFilter,
  OrdersOverviewStatusFilter,
  OrderOverviewRowDTO,
} from '../types';

/**
 * Normalize a string for search: lowercase + strip diacritics.
 * Exposed for tests; internal callers use `matchesQuery` below.
 */
export function normalizeForSearch(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function matchesStatus(
  row: OrderOverviewRowDTO,
  filter: OrdersOverviewStatusFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'draft':
      return row.status === 'draft';
    case 'canceled':
      return row.status === 'canceled';
    case 'paid':
      return row.status === 'sent' && row.paymentStatus === 'paid';
    case 'pending':
      // `Pendente pagamento` chip intentionally bundles pending + partial
      // + adjust — all flavors of "money still in the air". Matches the
      // design copy of "Pendente" on the chip.
      return (
        row.status === 'sent' &&
        (row.paymentStatus === 'pending' ||
          row.paymentStatus === 'partial' ||
          row.paymentStatus === 'adjust')
      );
  }
}

function matchesQuery(row: OrderOverviewRowDTO, query: string): boolean {
  const normalized = normalizeForSearch(query);
  if (normalized === '') return true;
  const clientHit = normalizeForSearch(row.clientName).includes(normalized);
  // Short id comparison: allow the seller to type '#2041', '2041', or even
  // part of the suffix. normalizeForSearch lowercases letters; shortId is
  // already uppercase hex so also lowercase-match for consistency.
  const shortIdHit = row.shortId.toLowerCase().includes(normalized);
  return clientHit || shortIdHit;
}

/**
 * 013-orders-overview: narrow an OrderOverviewRowDTO list by status
 * chip + free-text search. Month is already handled upstream by the
 * observable (observeOrdersForMonth), so this function is pure
 * post-processing.
 */
export function applyFilters(
  rows: readonly OrderOverviewRowDTO[],
  filter: Pick<OrdersOverviewFilter, 'status' | 'query'>,
): readonly OrderOverviewRowDTO[] {
  return rows.filter(
    (row) => matchesStatus(row, filter.status) && matchesQuery(row, filter.query),
  );
}
