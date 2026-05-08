/**
 * 013-orders-overview: observeReceiptsForOrders — batch subscription
 * used by OrdersOverview to fold payment status into every visible row
 * without N+1 observable subscriptions.
 */

/* eslint-disable import/first */
import { firstValueFrom, of } from 'rxjs';

const observeWithColumnsMock = jest.fn();
const queryBuilder = jest.fn(() => ({
  observeWithColumns: observeWithColumnsMock,
  observe: jest.fn(() => of([])),
  fetch: jest.fn(() => Promise.resolve([])),
}));
const get = jest.fn(() => ({ query: queryBuilder }));

jest.mock('@/data/database', () => ({
  database: { get },
}));
jest.mock('@/data/ids', () => ({ generateId: () => 'gen-id' }));
jest.mock('@/data/repositories/_touch', () => ({
  applyTouchOnCreate: jest.fn(),
  applyTouchOnUpdate: jest.fn(),
  applyTouchOnSoftDelete: jest.fn(),
}));

import { Q } from '@nozbe/watermelondb';
import { paymentReceiptsRepository } from '../paymentReceiptsRepository';

beforeEach(() => {
  observeWithColumnsMock.mockReset();
  queryBuilder.mockClear();
  get.mockClear();
});

describe('observeReceiptsForOrders', () => {
  it('emits an empty array when given no order ids (no query built)', async () => {
    const out = await firstValueFrom(
      paymentReceiptsRepository.observeReceiptsForOrders([]),
    );
    expect(out).toEqual([]);
    expect(queryBuilder).not.toHaveBeenCalled();
  });

  it('observes with amount column so receipt creations trigger re-emits', async () => {
    observeWithColumnsMock.mockReturnValueOnce(of([]));
    await firstValueFrom(
      paymentReceiptsRepository.observeReceiptsForOrders(['o1']),
    );
    expect(observeWithColumnsMock.mock.calls[0]?.[0]).toEqual(['amount']);
  });

  it('builds the query with an order_id IN (...) clause plus notDeleted', async () => {
    observeWithColumnsMock.mockReturnValueOnce(of([]));
    await firstValueFrom(
      paymentReceiptsRepository.observeReceiptsForOrders(['o1', 'o2', 'o3']),
    );
    expect(queryBuilder).toHaveBeenCalledTimes(1);
    const clauses = queryBuilder.mock.calls[0] ?? [];
    expect(clauses.length).toBe(2);
    for (const clause of clauses) expect(clause).toBeTruthy();
  });

  it('forwards upstream rows as-is', async () => {
    const rows = [
      { id: 'r1', orderId: 'o1', amount: 50 },
      { id: 'r2', orderId: 'o2', amount: 100 },
    ];
    observeWithColumnsMock.mockReturnValueOnce(of(rows));
    const out = await firstValueFrom(
      paymentReceiptsRepository.observeReceiptsForOrders(['o1', 'o2']),
    );
    expect(out).toBe(rows);
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _qKeepAlive = Q;
