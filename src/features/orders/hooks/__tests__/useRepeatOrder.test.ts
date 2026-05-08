/**
 * 010-repeat-last-order: useRepeatOrder behaviour lock.
 *
 * The hook's core flow is exported as `runRepeatOrder` so we can unit-test
 * it without any React test harness.
 */

 
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ordersRepository } from '@/data/repositories/ordersRepository';
import { AllItemsUnavailableError, OrderNotFoundError, ordersService } from '../../services/ordersService';
import { runRepeatOrder } from '../useRepeatOrder';

// ordersService (required below via requireActual to get the real error
// classes) transitively imports `@/data/database`, which pulls the SQLite
// adapter into jest's module graph. Stub it.
jest.mock('@/data/database', () => ({
  database: {
    write: (fn: () => Promise<unknown>) => fn(),
    get: () => ({ create: jest.fn() }),
  },
}));
jest.mock('@/data/ids', () => ({ generateId: () => 'gen-id' }));
jest.mock('@/data/repositories/_touch', () => ({ applyTouchOnCreate: jest.fn() }));
jest.mock('@/data/repositories/productsRepository', () => ({
  productsRepository: { findById: jest.fn() },
}));
jest.mock('@/data/repositories/productVariantsRepository', () => ({
  productVariantsRepository: { findById: jest.fn() },
}));
jest.mock('@/data/repositories/orderItemsRepository', () => ({
  orderItemsRepository: { findByOrder: jest.fn() },
}));

jest.mock('@/data/repositories/ordersRepository', () => ({
  ordersRepository: { findById: jest.fn() },
}));

jest.mock('../../services/ordersService', () => {
  const actual = jest.requireActual<typeof import('../../services/ordersService')>(
    '../../services/ordersService',
  );
  return {
    ...actual,
    ordersService: {
      ...actual.ordersService,
      repeat: jest.fn(),
    },
  };
});

const orders = ordersRepository as jest.Mocked<typeof ordersRepository>;
const repeatMock = ordersService.repeat as jest.MockedFunction<typeof ordersService.repeat>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runRepeatOrder', () => {
  it('calls ordersService.repeat for a SENT source and returns landed outcome', async () => {
    orders.findById.mockResolvedValueOnce({ id: 's-1', status: 'sent' } as never);
    repeatMock.mockResolvedValueOnce({ orderId: 'new-1', droppedProductNames: ['X'] });

    const outcome = await runRepeatOrder('s-1');

    expect(repeatMock).toHaveBeenCalledWith({ sourceOrderId: 's-1' });
    expect(outcome).toEqual({ kind: 'landed', orderId: 'new-1', droppedNames: ['X'] });
  });

  it('calls ordersService.repeat for a CANCELED source too', async () => {
    orders.findById.mockResolvedValueOnce({ id: 's-1', status: 'canceled' } as never);
    repeatMock.mockResolvedValueOnce({ orderId: 'new-1', droppedProductNames: [] });
    await runRepeatOrder('s-1');
    expect(repeatMock).toHaveBeenCalled();
  });

  it('short-circuits to resume for a DRAFT source (does NOT call repeat)', async () => {
    orders.findById.mockResolvedValueOnce({ id: 's-draft', status: 'draft' } as never);
    const outcome = await runRepeatOrder('s-draft');
    expect(repeatMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'landed', orderId: 's-draft', droppedNames: [] });
  });

  it('maps AllItemsUnavailableError to a blocked outcome', async () => {
    orders.findById.mockResolvedValueOnce({ id: 's-1', status: 'sent' } as never);
    repeatMock.mockRejectedValueOnce(new AllItemsUnavailableError('s-1'));
    const outcome = await runRepeatOrder('s-1');
    expect(outcome).toEqual({ kind: 'blocked', reason: 'all_unavailable' });
  });

  it('maps a hook-level missing source to a not_found outcome', async () => {
    orders.findById.mockResolvedValueOnce(null);
    const outcome = await runRepeatOrder('missing');
    expect(repeatMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'error', reason: 'not_found' });
  });

  it('maps service-level OrderNotFoundError to not_found too', async () => {
    orders.findById.mockResolvedValueOnce({ id: 's-1', status: 'sent' } as never);
    repeatMock.mockRejectedValueOnce(new OrderNotFoundError('s-1'));
    const outcome = await runRepeatOrder('s-1');
    expect(outcome).toEqual({ kind: 'error', reason: 'not_found' });
  });

  it('rethrows unknown errors from ordersService.repeat', async () => {
    orders.findById.mockResolvedValueOnce({ id: 's-1', status: 'sent' } as never);
    repeatMock.mockRejectedValueOnce(new Error('boom'));
    await expect(runRepeatOrder('s-1')).rejects.toThrow('boom');
  });
});
