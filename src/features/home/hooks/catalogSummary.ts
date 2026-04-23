/**
 * Pure derivation of the catalog summary DTO from an observed array.
 *
 * Kept separate from the hook (`useCatalogSummary`) so the logic is testable
 * in Node without a React renderer. Follows the 007 pattern
 * (resolveActiveSalesperson ↔ useActiveSalespersonId).
 */

export type CatalogSummary = { readonly count: number };

export function deriveCatalogSummary(products: readonly { readonly id: string }[]): CatalogSummary {
  return { count: products.length };
}
