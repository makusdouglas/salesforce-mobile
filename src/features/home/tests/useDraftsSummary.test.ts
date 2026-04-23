import { useDraftsSummary } from '../hooks/useDraftsSummary';

describe('useDraftsSummary (placeholder)', () => {
  test('returns { count: 0 } (contract lock for 009-orders swap-in)', () => {
    expect(useDraftsSummary()).toEqual({ count: 0 });
  });
});
