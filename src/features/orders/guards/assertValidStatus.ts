// 009-order-assembly: D4 runtime gate.
// TypeScript already narrows the OrderStatus union at compile time. This
// runtime assertion catches any value that slips past TS (dynamic data from
// a future import, a test fixture with a typo, etc.) and fails loud.

import type { OrderStatus } from '@/data/types';

export type Status = OrderStatus;

const ALLOWED: readonly Status[] = ['draft', 'sent', 'canceled'];

export class InvalidStatusError extends Error {
  readonly code = 'INVALID_STATUS';

  constructor(value: unknown) {
    super(
      `Invalid order status "${String(value)}". Allowed: ${ALLOWED.join(', ')}.`,
    );
    this.name = 'InvalidStatusError';
  }
}

export function assertValidStatus(value: unknown): asserts value is Status {
  if (value !== 'draft' && value !== 'sent' && value !== 'canceled') {
    throw new InvalidStatusError(value);
  }
}

export { ALLOWED as ORDER_STATUSES };
