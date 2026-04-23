/**
 * Pure derivation of the clients summary DTO.
 *
 * `null` input represents the bootstrap gap — salespersonId hasn't resolved
 * yet, so we can't observe any repository. In that state the count is 0 and
 * Home renders the empty-state variant of the Clientes card.
 */

export type ClientsSummary = { readonly count: number };

export function deriveClientsSummary(
  clients: readonly { readonly id: string }[] | null,
): ClientsSummary {
  if (clients === null) return { count: 0 };
  return { count: clients.length };
}
