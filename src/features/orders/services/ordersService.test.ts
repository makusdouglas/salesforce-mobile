/**
 * 009-order-assembly: ordersService orchestration test.
 *
 * The three repositories are mocked (no real WatermelonDB adapter runs in
 * Jest). This test locks the invariants the service is responsible for:
 *   - D4 status transitions (draft → sent / draft → canceled; mutation gate)
 *   - R5 "never write to products / product_variants" (verified via the
 *     fact that no mocked catalog write API is ever called)
 *   - The contract-level error shapes (OrderNotFoundError, OrderNotDraftError,
 *     AlreadyTerminalError, EmptyDraftError, LineNotFoundError,
 *     VariantNotFoundError)
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// 010-repeat-last-order: ordersService now imports `database` directly so
// that repeat() can run multi-row writes inside a single database.write().
// The transactional path isn't exercised by THIS test (only repeat.test.ts
// does), so a minimal no-op mock is sufficient to keep the SQLite adapter
// out of jest's module graph.
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

jest.mock('@/data/repositories/ordersRepository', () => ({
  ordersRepository: {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    markSent: jest.fn(),
    cancel: jest.fn(),
  },
}));
jest.mock('@/data/repositories/orderItemsRepository', () => ({
  orderItemsRepository: {
    findById: jest.fn(),
    findByOrder: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  },
}));
jest.mock('@/data/repositories/productVariantsRepository', () => ({
  productVariantsRepository: { findById: jest.fn() },
}));

import { ordersRepository } from '@/data/repositories/ordersRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';

import {
  AlreadyTerminalError,
  EmptyDraftError,
  LineNotFoundError,
  OrderNotDraftError,
  OrderNotFoundError,
  VariantNotFoundError,
  ordersService,
} from './ordersService';

const orders = ordersRepository as jest.Mocked<typeof ordersRepository>;
const items = orderItemsRepository as jest.Mocked<typeof orderItemsRepository>;
const variants = productVariantsRepository as jest.Mocked<typeof productVariantsRepository>;

function draft(overrides: Record<string, unknown> = {}) {
  return { id: 'o1', status: 'draft', ...overrides } as never;
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    orderId: 'o1',
    productVariantId: 'v1',
    quantity: 1,
    unitPrice: 10,
    discountAmount: 0,
    discountMode: 'amount',
    ...overrides,
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createDraft', () => {
  it('creates an order via ordersRepository with status=draft defaults', async () => {
    orders.create.mockResolvedValueOnce(draft({ id: 'abc' }));
    const res = await ordersService.createDraft({ clientId: 'c1', salespersonId: 's1' });
    expect(res).toEqual({ orderId: 'abc' });
    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'c1',
        salespersonId: 's1',
        discountAmount: 0,
        discountMode: 'amount',
      }),
    );
  });
});

describe('addItem', () => {
  it('creates a new line with unit-price snapshot when no line exists for the variant', async () => {
    orders.findById.mockResolvedValueOnce(draft());
    variants.findById.mockResolvedValueOnce({ id: 'v1', price: 39 } as never);
    items.findByOrder.mockResolvedValueOnce([]);
    items.create.mockResolvedValueOnce(line({ id: 'newLine' }));

    const res = await ordersService.addItem({ orderId: 'o1', productVariantId: 'v1' });

    expect(res).toEqual({ orderItemId: 'newLine' });
    expect(items.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'o1',
        productVariantId: 'v1',
        quantity: 1,
        unitPrice: 39,
        discountMode: 'amount',
      }),
    );
  });

  it('merges quantity onto the existing line when the same variant is already present', async () => {
    orders.findById.mockResolvedValueOnce(draft());
    variants.findById.mockResolvedValueOnce({ id: 'v1', price: 39 } as never);
    items.findByOrder.mockResolvedValueOnce([line({ id: 'existing', quantity: 2 })]);
    items.update.mockResolvedValueOnce(line({ id: 'existing', quantity: 5 }));

    const res = await ordersService.addItem({
      orderId: 'o1',
      productVariantId: 'v1',
      quantity: 3,
    });

    expect(res).toEqual({ orderItemId: 'existing' });
    expect(items.update).toHaveBeenCalledWith('existing', { quantity: 5 });
    expect(items.create).not.toHaveBeenCalled();
  });

  it('throws OrderNotFoundError when orderId is unknown', async () => {
    orders.findById.mockResolvedValueOnce(null);
    await expect(
      ordersService.addItem({ orderId: 'missing', productVariantId: 'v1' }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('throws AlreadyTerminalError when the order is sent', async () => {
    orders.findById.mockResolvedValueOnce(draft({ status: 'sent' }));
    await expect(
      ordersService.addItem({ orderId: 'o1', productVariantId: 'v1' }),
    ).rejects.toBeInstanceOf(AlreadyTerminalError);
  });

  it('throws VariantNotFoundError when the variant does not exist', async () => {
    orders.findById.mockResolvedValueOnce(draft());
    variants.findById.mockResolvedValueOnce(null);
    await expect(
      ordersService.addItem({ orderId: 'o1', productVariantId: 'gone' }),
    ).rejects.toBeInstanceOf(VariantNotFoundError);
  });
});

describe('updateLineQty', () => {
  it('soft-deletes the line when quantity drops to 0', async () => {
    items.findById.mockResolvedValueOnce(line());
    await ordersService.updateLineQty({ orderItemId: 'i1', quantity: 0 });
    expect(items.softDelete).toHaveBeenCalledWith('i1');
    expect(items.update).not.toHaveBeenCalled();
  });

  it('updates quantity when > 0', async () => {
    items.findById.mockResolvedValueOnce(line());
    await ordersService.updateLineQty({ orderItemId: 'i1', quantity: 4 });
    expect(items.update).toHaveBeenCalledWith('i1', { quantity: 4 });
  });

  it('throws LineNotFoundError on missing line', async () => {
    items.findById.mockResolvedValueOnce(null);
    await expect(
      ordersService.updateLineQty({ orderItemId: 'ghost', quantity: 2 }),
    ).rejects.toBeInstanceOf(LineNotFoundError);
  });

  it('rejects non-integer or negative quantity', async () => {
    items.findById.mockResolvedValue(line());
    await expect(
      ordersService.updateLineQty({ orderItemId: 'i1', quantity: 1.5 }),
    ).rejects.toThrow(/integer/);
    await expect(
      ordersService.updateLineQty({ orderItemId: 'i1', quantity: -1 }),
    ).rejects.toThrow(/integer/);
  });
});

describe('setLineDiscount / setOrderDiscount', () => {
  it('writes mode + value on the line', async () => {
    items.findById.mockResolvedValueOnce(line());
    await ordersService.setLineDiscount({
      orderItemId: 'i1',
      discount: { mode: 'percent', value: 10 },
    });
    expect(items.update).toHaveBeenCalledWith('i1', {
      discountAmount: 10,
      discountMode: 'percent',
    });
  });

  it('clearing the line discount resets to amount=0', async () => {
    items.findById.mockResolvedValueOnce(line());
    await ordersService.setLineDiscount({ orderItemId: 'i1', discount: null });
    expect(items.update).toHaveBeenCalledWith('i1', {
      discountAmount: 0,
      discountMode: 'amount',
    });
  });

  it('writes mode + value on the order', async () => {
    orders.findById.mockResolvedValueOnce(draft());
    await ordersService.setOrderDiscount({
      orderId: 'o1',
      discount: { mode: 'amount', value: 5 },
    });
    expect(orders.update).toHaveBeenCalledWith('o1', {
      discountAmount: 5,
      discountMode: 'amount',
    });
  });

  it('rejects a negative discount value', async () => {
    items.findById.mockResolvedValueOnce(line());
    await expect(
      ordersService.setLineDiscount({
        orderItemId: 'i1',
        discount: { mode: 'amount', value: -1 },
      }),
    ).rejects.toThrow();
  });

  it('setOrderDiscount refuses to mutate a sent order', async () => {
    orders.findById.mockResolvedValueOnce(draft({ status: 'sent' }));
    await expect(
      ordersService.setOrderDiscount({
        orderId: 'o1',
        discount: { mode: 'amount', value: 1 },
      }),
    ).rejects.toBeInstanceOf(AlreadyTerminalError);
  });
});

describe('send', () => {
  it('transitions draft → sent when there is at least one item', async () => {
    orders.findById.mockResolvedValueOnce(draft());
    items.findByOrder.mockResolvedValueOnce([line()]);
    await ordersService.send({ orderId: 'o1' });
    expect(orders.markSent).toHaveBeenCalledWith('o1');
  });

  it('throws EmptyDraftError when the draft has zero items', async () => {
    orders.findById.mockResolvedValueOnce(draft());
    items.findByOrder.mockResolvedValueOnce([]);
    await expect(ordersService.send({ orderId: 'o1' })).rejects.toBeInstanceOf(EmptyDraftError);
    expect(orders.markSent).not.toHaveBeenCalled();
  });

  it('throws AlreadyTerminalError when the order is already sent', async () => {
    orders.findById.mockResolvedValueOnce(draft({ status: 'sent' }));
    await expect(ordersService.send({ orderId: 'o1' })).rejects.toBeInstanceOf(AlreadyTerminalError);
  });

  it('throws OrderNotFoundError on missing order', async () => {
    orders.findById.mockResolvedValueOnce(null);
    await expect(ordersService.send({ orderId: 'x' })).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

describe('cancel', () => {
  it('transitions draft → canceled', async () => {
    orders.findById.mockResolvedValueOnce(draft());
    await ordersService.cancel({ orderId: 'o1' });
    expect(orders.cancel).toHaveBeenCalledWith('o1');
  });

  it('throws AlreadyTerminalError when called on sent', async () => {
    orders.findById.mockResolvedValueOnce(draft({ status: 'sent' }));
    await expect(ordersService.cancel({ orderId: 'o1' })).rejects.toBeInstanceOf(
      AlreadyTerminalError,
    );
  });

  it('throws AlreadyTerminalError when called on already canceled', async () => {
    orders.findById.mockResolvedValueOnce(draft({ status: 'canceled' }));
    await expect(ordersService.cancel({ orderId: 'o1' })).rejects.toBeInstanceOf(
      AlreadyTerminalError,
    );
  });
});

describe('R5 — product / variant rows are never mutated', () => {
  it('addItem reads the variant price but does not write to the variant', async () => {
    orders.findById.mockResolvedValueOnce(draft());
    variants.findById.mockResolvedValueOnce({ id: 'v1', price: 10 } as never);
    items.findByOrder.mockResolvedValueOnce([]);
    items.create.mockResolvedValueOnce(line());

    await ordersService.addItem({ orderId: 'o1', productVariantId: 'v1' });

    // variantsRepository exposes ONLY read methods in its surface (see
    // productVariantsRepository.ts docblock "READ-ONLY"). We assert no
    // unexpected write method was invoked on the mock. A test that scans
    // the whole orders module for write verbs lives in noCatalogWrites.
    const mockAsRecord = variants as unknown as Record<string, jest.Mock | unknown>;
    for (const key of Object.keys(mockAsRecord)) {
      if (key === 'findById') continue;
      const maybeMock = mockAsRecord[key];
      if (typeof maybeMock === 'function' && 'mock' in (maybeMock as object)) {
        expect((maybeMock as jest.Mock).mock.calls).toEqual([]);
      }
    }
  });
});

describe('D4 — assertValidStatus catches rogue statuses in loaded orders', () => {
  it('a stored order with an unexpected status value is rejected at mutation time', async () => {
    orders.findById.mockResolvedValueOnce(draft({ status: 'archived' }) as never);
    await expect(
      ordersService.setOrderDiscount({
        orderId: 'o1',
        discount: { mode: 'amount', value: 0 },
      }),
    ).rejects.toThrow(/Invalid order status/);
  });
});
