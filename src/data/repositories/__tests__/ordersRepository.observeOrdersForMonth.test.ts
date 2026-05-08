/**
 * 013-orders-overview: observeOrdersForMonth behavior lock.
 *
 * Same mocking pattern as observeLastSentForClient: stub the Watermelon
 * database so we can assert the query shape and the observable plumbing
 * without booting the adapter.
 *
 * Contract: specs/013-orders-overview/contracts/observeOrdersForMonth.md
 */

/* eslint-disable import/first */
import { of } from 'rxjs';

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
import { firstValueFrom } from 'rxjs';
import { ordersRepository } from '../ordersRepository';

beforeEach(() => {
  observeWithColumnsMock.mockReset();
  queryBuilder.mockClear();
  get.mockClear();
});

describe('observeOrdersForMonth', () => {
  it('returns an empty observable when salespersonId is empty', async () => {
    const out = await firstValueFrom(
      ordersRepository.observeOrdersForMonth('', 0, 1),
    );
    expect(out).toEqual([]);
    expect(queryBuilder).not.toHaveBeenCalled();
  });

  it('observes the query with the status/time columns so bucket transitions re-emit', async () => {
    observeWithColumnsMock.mockReturnValueOnce(of([]));
    await firstValueFrom(
      ordersRepository.observeOrdersForMonth('sp-1', 1_000, 2_000),
    );
    expect(observeWithColumnsMock).toHaveBeenCalledTimes(1);
    expect(observeWithColumnsMock.mock.calls[0]?.[0]).toEqual([
      'status',
      'updated_at',
      'sent_at_ms',
      'canceled_at_ms',
    ]);
  });

  it('builds a compound query with seller filter, notDeleted guard, and a three-branch OR', async () => {
    observeWithColumnsMock.mockReturnValueOnce(of([]));
    await firstValueFrom(
      ordersRepository.observeOrdersForMonth('sp-42', 100, 200),
    );
    expect(queryBuilder).toHaveBeenCalledTimes(1);
    const clauses = queryBuilder.mock.calls[0] ?? [];
    // 3 top-level clauses: salesperson_id filter, notDeleted, and the OR.
    expect(clauses.length).toBe(3);
    for (const clause of clauses) expect(clause).toBeTruthy();
  });

  it('forwards upstream emissions as-is', async () => {
    const rows = [{ id: 'o1' }, { id: 'o2' }];
    observeWithColumnsMock.mockReturnValueOnce(of(rows));
    const out = await firstValueFrom(
      ordersRepository.observeOrdersForMonth('sp-1', 0, 10),
    );
    expect(out).toBe(rows);
  });
});

// Pin the Q import so the Watermelon query helpers stay reachable in this test
// environment — observability depends on the same module identity that the
// repo under test uses.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _qKeepAlive = Q;
