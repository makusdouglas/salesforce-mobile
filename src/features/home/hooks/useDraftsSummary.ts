/**
 * PLACEHOLDER — drafts do not exist yet in the data model.
 *
 * Returns a constant `{ count: 0 }`. Because the body calls no other hook,
 * this function is callable from Node in tests as a plain function.
 *
 * TODO(009-orders): replace body with an observation over
 * ordersRepository.observeByStatus('draft', salespersonId).
 * Signature MUST stay `() => { count: number }`.
 */

export type DraftsSummary = { readonly count: number };

export function useDraftsSummary(): DraftsSummary {
  return { count: 0 };
}
