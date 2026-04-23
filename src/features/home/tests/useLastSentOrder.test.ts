import { useLastSentOrder } from '../hooks/useLastSentOrder';

describe('useLastSentOrder (placeholder)', () => {
  test('returns null (contract lock for 009-orders swap-in)', () => {
    expect(useLastSentOrder()).toBeNull();
  });
});
