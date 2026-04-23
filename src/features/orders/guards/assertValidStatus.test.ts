import { describe, expect, it } from '@jest/globals';

import { InvalidStatusError, ORDER_STATUSES, assertValidStatus } from './assertValidStatus';

describe('assertValidStatus', () => {
  it.each(['draft', 'sent', 'canceled'] as const)('accepts %s', (value) => {
    expect(() => {
      assertValidStatus(value);
    }).not.toThrow();
  });

  it.each(['archived', 'pending', '', 'DRAFT', ' draft', null, undefined, 0, {}])(
    'rejects %p',
    (value) => {
      expect(() => {
        assertValidStatus(value);
      }).toThrow(InvalidStatusError);
    },
  );

  it('ORDER_STATUSES contains exactly the three D4 values', () => {
    expect([...ORDER_STATUSES]).toEqual(['draft', 'sent', 'canceled']);
  });
});
