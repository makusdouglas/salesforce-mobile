import { deriveClientsSummary } from '../hooks/clientsSummary';

describe('deriveClientsSummary', () => {
  test('null → count 0 (bootstrap gap)', () => {
    expect(deriveClientsSummary(null)).toEqual({ count: 0 });
  });

  test('empty array → count 0', () => {
    expect(deriveClientsSummary([])).toEqual({ count: 0 });
  });

  test('populated array → count matches length', () => {
    expect(
      deriveClientsSummary([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]),
    ).toEqual({ count: 3 });
  });
});
