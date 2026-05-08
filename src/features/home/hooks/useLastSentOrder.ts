import type { RecentActivityDTO } from '../types';

/**
 * PLACEHOLDER — the "last sent order" entity does not exist yet.
 *
 * Returns a constant `null`. Because the body calls no other hook, this
 * function is callable from Node in tests as a plain function.
 *
 * TODO(009-orders): replace body with an observation over
 * ordersRepository.observeLastSent(salespersonId) joined with the client's
 * name and the line-items total. Signature MUST stay
 * `() => RecentActivityDTO | null`.
 */

export function useLastSentOrder(): RecentActivityDTO | null {
  return null;
}
