import {
  PAYMENT_STATUS_EPS,
  derivePaymentStatus,
  type OrderPaymentStatus,
} from './derivePaymentStatus';

describe('derivePaymentStatus — non-sent orders carry no expectation', () => {
  it.each([
    ['draft' as const, 100, 0],
    ['draft' as const, 100, 50],
    ['canceled' as const, 100, 0],
    ['canceled' as const, 100, 100],
    // Edge: a canceled order can still have receipts attached for audit —
    // status is still null because the order is not collectable.
    ['canceled' as const, 100, 150],
  ])('status=%s total=%d received=%d → null', (status, total, received) => {
    expect(derivePaymentStatus({ status, total, received })).toBeNull();
  });
});

describe('derivePaymentStatus — sent orders', () => {
  const cases: Array<[number, number, OrderPaymentStatus]> = [
    // [total, received, expected]
    [100, 100, 'paid'],
    [100, 99.996, 'paid'], // within EPS
    [100, 100.004, 'paid'], // within EPS above
    [100, 50, 'partial'],
    [100, 0.01, 'partial'],
    [100, 0, 'pending'],
    [100, 150, 'adjust'], // overpayment
    [100, -10, 'adjust'], // over-correction
    [100, -0.001, 'adjust'], // any negative → adjust
  ];
  it.each(cases)('total=%d received=%d → %s', (total, received, expected) => {
    expect(derivePaymentStatus({ status: 'sent', total, received })).toBe(
      expected,
    );
  });
});

describe('derivePaymentStatus — EPS boundary', () => {
  it('received just inside EPS below total is paid', () => {
    expect(
      derivePaymentStatus({
        status: 'sent',
        total: 100,
        received: 100 - PAYMENT_STATUS_EPS + 0.001,
      }),
    ).toBe('paid');
  });

  it('received just outside EPS below total is partial', () => {
    expect(
      derivePaymentStatus({
        status: 'sent',
        total: 100,
        received: 100 - PAYMENT_STATUS_EPS - 0.001,
      }),
    ).toBe('partial');
  });

  it('received just inside EPS above total is paid', () => {
    expect(
      derivePaymentStatus({
        status: 'sent',
        total: 100,
        received: 100 + PAYMENT_STATUS_EPS - 0.001,
      }),
    ).toBe('paid');
  });

  it('received just outside EPS above total is adjust', () => {
    expect(
      derivePaymentStatus({
        status: 'sent',
        total: 100,
        received: 100 + PAYMENT_STATUS_EPS + 0.001,
      }),
    ).toBe('adjust');
  });
});

describe('derivePaymentStatus — purity', () => {
  it('same inputs always produce same output (referentially transparent)', () => {
    const input = { status: 'sent' as const, total: 780, received: 500 };
    const first = derivePaymentStatus(input);
    const second = derivePaymentStatus(input);
    expect(first).toBe(second);
    expect(first).toBe('partial');
  });
});
