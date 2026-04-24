import type {
  OrderOverviewRowDTO,
  OrdersOverviewSummaryDTO,
} from '../types';

/**
 * 013-orders-overview: summary band math.
 *
 * Given rows already narrowed to the active filter window, roll them
 * into a single DTO. Only sent orders contribute to `billed` and
 * `received`; drafts and canceled orders are excluded from financial
 * rollups (they have no payment expectation).
 *
 * `received` is per-row-capped at `row.total` so an overpayment on one
 * order cannot produce a negative `pending` once other rows are added
 * in. Adjust-status rows therefore contribute at most their own total.
 *
 * Contract:
 *   specs/013-orders-overview/contracts/computeOrdersOverviewSummary.md
 */
export function computeOrdersOverviewSummary(
  rows: readonly OrderOverviewRowDTO[],
): OrdersOverviewSummaryDTO {
  let billed = 0;
  let received = 0;

  for (const row of rows) {
    if (row.status !== 'sent') continue;
    billed += row.total;
    received += Math.min(row.received, row.total);
  }

  const pending = Math.max(0, billed - received);
  const progressRatio =
    billed === 0 ? 0 : Math.min(1, Math.max(0, received / billed));

  return {
    ordersCount: rows.length,
    billed,
    received,
    pending,
    progressRatio,
  };
}
