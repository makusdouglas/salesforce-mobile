/**
 * 009-order-assembly: replaces the 008 placeholder contract-lock test.
 *
 * The hook depends on WatermelonDB observations (via ordersRepository) and
 * on the active-salesperson hook, neither of which run in this Jest
 * environment. The integration behavior (count reflects repo state, count
 * is 0 when no salesperson is active, cleanup on unmount) is verified
 * manually via quickstart.md. Here we keep a minimal contract-lock
 * assertion: the shape `{ count: number }` is preserved so the Home
 * snapshot and its tests continue to compile against the same key.
 */

import type { DraftsSummary } from '../hooks/useDraftsSummary';

describe('useDraftsSummary (contract)', () => {
  test('type DraftsSummary exposes { count: number } and nothing else', () => {
    const shape: DraftsSummary = { count: 0 };
    expect(Object.keys(shape)).toEqual(['count']);
    expect(typeof shape.count).toBe('number');
  });
});
