/**
 * 010-repeat-last-order: ordersService.repeat behaviour lock.
 *
 * The repositories and the Watermelon database are mocked. The tests verify
 * every invariant from contracts/ordersService.repeat.md:
 *   - Clone copies client/salesperson/discount on the order, and
 *     variant/qty/discount on each line.
 *   - Cloned lines use the CURRENT variant price (R-001), not the source's
 *     historical unit_price.
 *   - Returned orderId ≠ source; returned draft has status='draft',
 *     sent_at_ms=null.
 *   - Source row is never mutated (SC-006 lock).
 *   - Draft source → CannotRepeatDraftError (second line of defence).
 *   - Missing source → OrderNotFoundError.
 *   - All variants deleted → AllItemsUnavailableError, no write.
 *   - Partial drop → names surfaced in droppedProductNames, draft created
 *     with fewer lines.
 *   - Two consecutive repeats on the same source produce two distinct
 *     orderIds (no-dedupe edge case).
 */

 
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { generateId } from '@/data/ids';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';
import { productsRepository } from '@/data/repositories/productsRepository';

import {
  AllItemsUnavailableError,
  CannotRepeatDraftError,
  OrderNotFoundError,
  ordersService,
} from '../ordersService';

// ---------- database.write & collection mocks ----------
type RecordCallback = (r: Record<string, unknown>) => void;
const orderCreateMock = jest.fn<(cb: RecordCallback) => Promise<Record<string, unknown>>>();
const lineCreateMock = jest.fn<(cb: RecordCallback) => Promise<Record<string, unknown>>>();
const writeMock = jest.fn<(fn: () => Promise<unknown>) => Promise<unknown>>(async (fn) => fn());

jest.mock('@/data/database', () => ({
  database: {
    write: (fn: () => Promise<unknown>) => writeMock(fn),
    get: (table: string) => {
      if (table === 'orders') return { create: orderCreateMock };
      if (table === 'order_items') return { create: lineCreateMock };
      throw new Error(`unexpected collection ${table}`);
    },
  },
}));

jest.mock('@/data/ids', () => ({
  generateId: jest.fn(() => 'generated-id'),
}));

jest.mock('@/data/repositories/_touch', () => ({
  applyTouchOnCreate: jest.fn(),
}));

jest.mock('@/data/repositories/ordersRepository', () => ({
  ordersRepository: { findById: jest.fn() },
}));

jest.mock('@/data/repositories/orderItemsRepository', () => ({
  orderItemsRepository: { findByOrder: jest.fn() },
}));

jest.mock('@/data/repositories/productVariantsRepository', () => ({
  productVariantsRepository: { findById: jest.fn() },
}));

jest.mock('@/data/repositories/productsRepository', () => ({
  productsRepository: { findById: jest.fn() },
}));

const orders = ordersRepository as jest.Mocked<typeof ordersRepository>;
const items = orderItemsRepository as jest.Mocked<typeof orderItemsRepository>;
const variants = productVariantsRepository as jest.Mocked<typeof productVariantsRepository>;
const products = productsRepository as jest.Mocked<typeof productsRepository>;
const genId = generateId as jest.Mock;

function sourceOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'src-1',
    clientId: 'c-1',
    salespersonId: 'sp-1',
    status: 'sent',
    discountAmount: 5,
    discountMode: 'percent',
    _raw: { _status: 'synced', _changed: '' },
    ...overrides,
  } as never;
}

function liveVariant(id: string, productId: string, price: number) {
  return { id, productId, price, _raw: { _status: 'synced' } } as never;
}

function liveProduct(id: string, name: string, active = true) {
  // 016-product-lifecycle-roles — `active` defaults to true so existing
  // tests keep their meaning. Tests that care about deactivation pass
  // `active=false` explicitly.
  return { id, name, active, _raw: { _status: 'synced' } } as never;
}

function sourceLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'li-1',
    orderId: 'src-1',
    productVariantId: 'v-1',
    quantity: 3,
    unitPrice: 9.99, // HISTORICAL — must NOT be carried over
    discountAmount: 1,
    discountMode: 'amount',
    ...overrides,
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  writeMock.mockImplementation(async (fn) => fn());
  // Default: each create resolves to a "fake" persisted record. The test
  // cares about WHAT fields were written, which is captured by inspecting
  // the callback passed to collection.create.
  orderCreateMock.mockImplementation(async (cb) => {
    const record = { _raw: { id: 'generated-id' } } as Record<string, unknown>;
    cb(record);
    return record;
  });
  lineCreateMock.mockImplementation(async (cb) => {
    const record = { _raw: { id: 'generated-id' } } as Record<string, unknown>;
    cb(record);
    return record;
  });
});

describe('repeat — happy path', () => {
  it('clones a sent order into a fresh draft with cloned discounts and fresh catalog prices', async () => {
    genId.mockReturnValueOnce('new-order').mockReturnValueOnce('new-line-1');
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([sourceLine()]);
    variants.findById.mockResolvedValueOnce(liveVariant('v-1', 'p-1', 12.5)); // current price
    products.findById.mockResolvedValueOnce(liveProduct('p-1', 'Leite Integral 1L'));

    const result = await ordersService.repeat({ sourceOrderId: 'src-1' });

    expect(result.orderId).toBe('new-order');
    expect(result.orderId).not.toBe('src-1');
    expect(result.droppedProductNames).toEqual([]);

    // The order-create callback wrote a draft with source's cloned discounts.
    // Instead of re-invoking the callback (which would need a fresh _raw), we
    // capture the record it mutated the FIRST time it ran in beforeEach's
    // default implementation. So re-use the call args to build a fresh
    // record shape and run the callback against it.
    expect(orderCreateMock).toHaveBeenCalledTimes(1);
    const orderCb = orderCreateMock.mock.calls[0]![0];
    const orderWritten: Record<string, unknown> = { _raw: { id: '' } };
    orderCb(orderWritten);
    expect(orderWritten.clientId).toBe('c-1');
    expect(orderWritten.salespersonId).toBe('sp-1');
    expect(orderWritten.status).toBe('draft');
    expect(orderWritten.discountAmount).toBe(5);
    expect(orderWritten.discountMode).toBe('percent');
    expect(orderWritten.sentAtMs).toBeNull();
    expect(orderWritten.canceledAtMs).toBeNull();

    // The line-create callback wrote the line with CURRENT price + cloned discount.
    expect(lineCreateMock).toHaveBeenCalledTimes(1);
    const lineCb = lineCreateMock.mock.calls[0]![0];
    const lineWritten: Record<string, unknown> = { _raw: { id: '' } };
    lineCb(lineWritten);
    expect(lineWritten.orderId).toBe('new-order');
    expect(lineWritten.productVariantId).toBe('v-1');
    expect(lineWritten.quantity).toBe(3);
    expect(lineWritten.unitPrice).toBe(12.5); // current catalog, NOT 9.99
    expect(lineWritten.discountAmount).toBe(1);
    expect(lineWritten.discountMode).toBe('amount');
  });

  it('does not mutate the source row (SC-006 lock)', async () => {
    const source = sourceOrder({ discountAmount: 7 });
    const rawBefore = JSON.stringify(source);
    orders.findById.mockResolvedValueOnce(source);
    items.findByOrder.mockResolvedValueOnce([]);
    // no lines → AllItemsUnavailable, but the point here is source untouched.
    await expect(ordersService.repeat({ sourceOrderId: 'src-1' })).rejects.toBeInstanceOf(
      AllItemsUnavailableError,
    );
    expect(JSON.stringify(source)).toBe(rawBefore);
  });

  it('produces two distinct orderIds on two consecutive repeats (no dedupe)', async () => {
    genId
      .mockReturnValueOnce('first')
      .mockReturnValueOnce('first-line')
      .mockReturnValueOnce('second')
      .mockReturnValueOnce('second-line');
    orders.findById.mockResolvedValue(sourceOrder());
    items.findByOrder.mockResolvedValue([sourceLine()]);
    variants.findById.mockResolvedValue(liveVariant('v-1', 'p-1', 10));
    products.findById.mockResolvedValue(liveProduct('p-1', 'X'));

    const a = await ordersService.repeat({ sourceOrderId: 'src-1' });
    const b = await ordersService.repeat({ sourceOrderId: 'src-1' });
    expect(a.orderId).not.toBe(b.orderId);
  });
});

describe('repeat — error paths', () => {
  it('throws OrderNotFoundError when source is missing', async () => {
    orders.findById.mockResolvedValueOnce(null);
    await expect(ordersService.repeat({ sourceOrderId: 'nope' })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(orderCreateMock).not.toHaveBeenCalled();
    expect(lineCreateMock).not.toHaveBeenCalled();
  });

  it('throws CannotRepeatDraftError when source is a draft (second line of defence)', async () => {
    orders.findById.mockResolvedValueOnce(sourceOrder({ status: 'draft' }));
    await expect(ordersService.repeat({ sourceOrderId: 'src-1' }))
      .rejects.toMatchObject({ code: 'CANNOT_REPEAT_DRAFT', sourceOrderId: 'src-1' });
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it('allows a canceled source to be repeated', async () => {
    genId.mockReturnValueOnce('o').mockReturnValueOnce('l');
    orders.findById.mockResolvedValueOnce(sourceOrder({ status: 'canceled' }));
    items.findByOrder.mockResolvedValueOnce([sourceLine()]);
    variants.findById.mockResolvedValueOnce(liveVariant('v-1', 'p-1', 5));
    products.findById.mockResolvedValueOnce(liveProduct('p-1', 'X'));
    const out = await ordersService.repeat({ sourceOrderId: 'src-1' });
    expect(out.orderId).toBe('o');
  });
});

describe('repeat — availability gate', () => {
  it('drops a line whose variant is soft-deleted and keeps the others', async () => {
    genId.mockReturnValueOnce('new-o').mockReturnValueOnce('new-l');
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([
      sourceLine({ id: 'li-1', productVariantId: 'v-1' }),
      sourceLine({ id: 'li-2', productVariantId: 'v-2' }),
    ]);
    variants.findById
      .mockResolvedValueOnce({ id: 'v-1', productId: 'p-1', price: 10, _raw: { _status: 'deleted' } } as never)
      .mockResolvedValueOnce(liveVariant('v-2', 'p-2', 20));
    products.findById
      // Order doesn't matter — only v-2's product is fetched because v-1 was filtered.
      .mockResolvedValueOnce(liveProduct('p-2', 'Item B'));
    // Stub the deleted-variant's product lookup for safety even if called.
    products.findById.mockResolvedValue(liveProduct('p-1', 'Item A'));

    const out = await ordersService.repeat({ sourceOrderId: 'src-1' });
    expect(out.droppedProductNames.length).toBe(1);
    expect(lineCreateMock).toHaveBeenCalledTimes(1);
  });

  it('drops a line whose parent product is soft-deleted and surfaces the product name', async () => {
    genId.mockReturnValueOnce('o').mockReturnValueOnce('l');
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([
      sourceLine({ id: 'li-1', productVariantId: 'v-1' }),
      sourceLine({ id: 'li-2', productVariantId: 'v-2' }),
    ]);
    variants.findById
      .mockResolvedValueOnce(liveVariant('v-1', 'p-1', 10))
      .mockResolvedValueOnce(liveVariant('v-2', 'p-2', 20));
    products.findById
      .mockResolvedValueOnce({ id: 'p-1', name: 'Sabão em Pó', _raw: { _status: 'deleted' } } as never)
      .mockResolvedValueOnce(liveProduct('p-2', 'Leite'));

    const out = await ordersService.repeat({ sourceOrderId: 'src-1' });
    expect(out.droppedProductNames).toEqual(['Sabão em Pó']);
    expect(lineCreateMock).toHaveBeenCalledTimes(1);
  });

  it('throws AllItemsUnavailableError and does NOT open a write when every line is unavailable', async () => {
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([
      sourceLine({ productVariantId: 'v-1' }),
      sourceLine({ productVariantId: 'v-2' }),
    ]);
    variants.findById.mockResolvedValue(null);

    await expect(ordersService.repeat({ sourceOrderId: 'src-1' })).rejects.toBeInstanceOf(
      AllItemsUnavailableError,
    );
    expect(writeMock).not.toHaveBeenCalled();
    expect(orderCreateMock).not.toHaveBeenCalled();
    expect(lineCreateMock).not.toHaveBeenCalled();
  });
});

describe('repeat — atomicity (rollback lock, R-005)', () => {
  it('propagates throw from mid-transaction line.create (wrapping database.write), so compensation is single-commit', async () => {
    genId
      .mockReturnValueOnce('o')
      .mockReturnValueOnce('l1')
      .mockReturnValueOnce('l2');
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([sourceLine({ productVariantId: 'v-1' }), sourceLine({ productVariantId: 'v-2' })]);
    variants.findById
      .mockResolvedValueOnce(liveVariant('v-1', 'p-1', 10))
      .mockResolvedValueOnce(liveVariant('v-2', 'p-2', 20));
    products.findById
      .mockResolvedValueOnce(liveProduct('p-1', 'A'))
      .mockResolvedValueOnce(liveProduct('p-2', 'B'));

    // First line succeeds, second throws. Since both live inside the single
    // database.write() callback, the write promise rejects — callers see a
    // rejection and the "transaction" concept is surfaced through writeMock.
    lineCreateMock
      .mockImplementationOnce(async (cb) => {
        cb({ _raw: { id: '' } } as Record<string, unknown>);
        return {};
      })
      .mockImplementationOnce(async () => {
        throw new Error('db blew up');
      });

    await expect(ordersService.repeat({ sourceOrderId: 'src-1' })).rejects.toThrow('db blew up');
    // All the collection.create calls happened INSIDE the single write call.
    expect(writeMock).toHaveBeenCalledTimes(1);
  });
});

// 016-product-lifecycle-roles — discontinued product handling for
// repeat() and the new previewRepeat().
describe('repeat — discontinued products (016)', () => {
  it('drops inactive products and surfaces their names alongside clonable lines', async () => {
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([
      sourceLine({ productVariantId: 'v-1' }),
      sourceLine({ productVariantId: 'v-2', id: 'li-2' }),
    ]);
    variants.findById
      .mockResolvedValueOnce(liveVariant('v-1', 'p-1', 10))
      .mockResolvedValueOnce(liveVariant('v-2', 'p-2', 20));
    products.findById
      .mockResolvedValueOnce(liveProduct('p-1', 'Café Pilão 500g', true))
      .mockResolvedValueOnce(liveProduct('p-2', 'Leite Moça 395g', false)); // discontinued

    const result = await ordersService.repeat({ sourceOrderId: 'src-1' });

    expect(result.droppedProductNames).toEqual(['Leite Moça 395g']);
    // Only the active product was cloned into a line.
    expect(lineCreateMock).toHaveBeenCalledTimes(1);
  });

  it('refuses when EVERY line is inactive (AllItemsUnavailable)', async () => {
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([sourceLine({ productVariantId: 'v-1' })]);
    variants.findById.mockResolvedValueOnce(liveVariant('v-1', 'p-1', 10));
    products.findById.mockResolvedValueOnce(liveProduct('p-1', 'Só esse', false));

    await expect(
      ordersService.repeat({ sourceOrderId: 'src-1' }),
    ).rejects.toBeInstanceOf(AllItemsUnavailableError);
    expect(writeMock).not.toHaveBeenCalled();
  });
});

describe('previewRepeat', () => {
  it('separates discontinued from unavailable and counts clonable lines', async () => {
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([
      sourceLine({ productVariantId: 'v-1', id: 'l1' }),
      sourceLine({ productVariantId: 'v-2', id: 'l2' }),
      sourceLine({ productVariantId: 'v-3', id: 'l3' }),
    ]);
    variants.findById
      .mockResolvedValueOnce(liveVariant('v-1', 'p-1', 10))
      .mockResolvedValueOnce(liveVariant('v-2', 'p-2', 20))
      // v-3 is soft-deleted — resolves to null-ish to emulate missing.
      .mockResolvedValueOnce(null as never);
    products.findById
      .mockResolvedValueOnce(liveProduct('p-1', 'Keeper', true))
      .mockResolvedValueOnce(liveProduct('p-2', 'Descontinuado', false));

    const preview = await ordersService.previewRepeat({ sourceOrderId: 'src-1' });
    expect(preview.clonableCount).toBe(1);
    expect(preview.discontinuedProductNames).toEqual(['Descontinuado']);
    expect(preview.unavailableProductNames).toEqual(['Item indisponível']);
    expect(writeMock).not.toHaveBeenCalled();
  });

  it('returns all clonable when no product is inactive or missing', async () => {
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([sourceLine({ productVariantId: 'v-1' })]);
    variants.findById.mockResolvedValueOnce(liveVariant('v-1', 'p-1', 10));
    products.findById.mockResolvedValueOnce(liveProduct('p-1', 'Keeper', true));

    const preview = await ordersService.previewRepeat({ sourceOrderId: 'src-1' });
    expect(preview.clonableCount).toBe(1);
    expect(preview.discontinuedProductNames).toEqual([]);
    expect(preview.unavailableProductNames).toEqual([]);
  });

  it('returns clonableCount=0 with only discontinued names when every line is inactive', async () => {
    orders.findById.mockResolvedValueOnce(sourceOrder());
    items.findByOrder.mockResolvedValueOnce([sourceLine({ productVariantId: 'v-1' })]);
    variants.findById.mockResolvedValueOnce(liveVariant('v-1', 'p-1', 10));
    products.findById.mockResolvedValueOnce(liveProduct('p-1', 'Só descontinuados', false));

    const preview = await ordersService.previewRepeat({ sourceOrderId: 'src-1' });
    expect(preview.clonableCount).toBe(0);
    expect(preview.discontinuedProductNames).toEqual(['Só descontinuados']);
  });

  it('throws CannotRepeatDraftError for a draft source', async () => {
    orders.findById.mockResolvedValueOnce(sourceOrder({ status: 'draft' }));
    await expect(
      ordersService.previewRepeat({ sourceOrderId: 'src-1' }),
    ).rejects.toBeInstanceOf(CannotRepeatDraftError);
  });

  it('returns error for a missing source via the hook wrapper path', async () => {
    orders.findById.mockResolvedValueOnce(null);
    await expect(
      ordersService.previewRepeat({ sourceOrderId: 'ghost' }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
