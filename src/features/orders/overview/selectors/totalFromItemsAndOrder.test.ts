import { totalFromItemsAndOrder } from './totalFromItemsAndOrder';

describe('totalFromItemsAndOrder', () => {
  it('sums q*p per matching item minus item + order discount', () => {
    const order = { id: 'o1', discountAmount: 5 };
    const items = [
      { orderId: 'o1', quantity: 2, unitPrice: 10, discountAmount: 0 }, // 20
      { orderId: 'o1', quantity: 3, unitPrice: 4, discountAmount: 2 }, // 10
      { orderId: 'OTHER', quantity: 100, unitPrice: 99, discountAmount: 0 }, // ignored
    ];
    expect(totalFromItemsAndOrder(order, items)).toBe(25);
  });

  it('clamps to 0 when order discount exceeds subtotal', () => {
    const order = { id: 'o1', discountAmount: 1000 };
    const items = [{ orderId: 'o1', quantity: 1, unitPrice: 10, discountAmount: 0 }];
    expect(totalFromItemsAndOrder(order, items)).toBe(0);
  });

  it('no items for the order → 0', () => {
    expect(totalFromItemsAndOrder({ id: 'o1', discountAmount: 0 }, [])).toBe(0);
  });

  it('per-row item discount is subtracted before the order discount', () => {
    const order = { id: 'o1', discountAmount: 0 };
    const items = [
      { orderId: 'o1', quantity: 1, unitPrice: 100, discountAmount: 25 }, // 75
    ];
    expect(totalFromItemsAndOrder(order, items)).toBe(75);
  });
});
