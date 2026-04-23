// 009-order-assembly: the only write path to orders / order_items in the app.
//
// Every method wraps its mutations through the repositories (which already
// run inside `database.write(...)`). Every method that reads a status value
// passes it through `assertValidStatus` so D4 is enforced at runtime even
// against rogue imports or bad migrations.
//
// R5: no method accepts a product/variant id as a *mutation target*. Variants
// are read-only inputs to `addItem` (for the unit-price snapshot) and are
// never written to by this module. Enforced in code shape + by the static
// `noCatalogWrites.test.ts` repo-wide scan.

import { database } from '@/data/database';
import { generateId } from '@/data/ids';
import Order from '@/data/models/Order';
import OrderItem from '@/data/models/OrderItem';
import { ordersRepository } from '@/data/repositories/ordersRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { productsRepository } from '@/data/repositories/productsRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';
import { applyTouchOnCreate } from '@/data/repositories/_touch';

import { assertValidStatus } from '../guards/assertValidStatus';
import type { DiscountInput } from '../totals/types';

export class OrderNotFoundError extends Error {
  readonly code = 'ORDER_NOT_FOUND';
  constructor(orderId: string) {
    super(`Order "${orderId}" not found.`);
    this.name = 'OrderNotFoundError';
  }
}

export class OrderNotDraftError extends Error {
  readonly code = 'ORDER_NOT_DRAFT';
  constructor(orderId: string, currentStatus: string) {
    super(`Order "${orderId}" is "${currentStatus}", expected "draft".`);
    this.name = 'OrderNotDraftError';
  }
}

export class AlreadyTerminalError extends Error {
  readonly code = 'ALREADY_TERMINAL';
  constructor(orderId: string, currentStatus: string) {
    super(
      `Order "${orderId}" already reached terminal status "${currentStatus}".`,
    );
    this.name = 'AlreadyTerminalError';
  }
}

export class EmptyDraftError extends Error {
  readonly code = 'EMPTY_DRAFT';
  constructor(orderId: string) {
    super(`Cannot send order "${orderId}": draft has zero line items.`);
    this.name = 'EmptyDraftError';
  }
}

export class LineNotFoundError extends Error {
  readonly code = 'LINE_NOT_FOUND';
  constructor(lineId: string) {
    super(`Order line "${lineId}" not found.`);
    this.name = 'LineNotFoundError';
  }
}

export class VariantNotFoundError extends Error {
  readonly code = 'VARIANT_NOT_FOUND';
  constructor(variantId: string) {
    super(`Product variant "${variantId}" not found.`);
    this.name = 'VariantNotFoundError';
  }
}

// 010-repeat-last-order: repeat() rejects Draft sources at the service
// boundary so a future caller that bypasses useRepeatOrder still cannot
// silently produce a duplicate draft. The UI hook is expected to branch to
// "resume" before ever calling repeat(), but this throw is the second line
// of defence (see research R-003).
export class CannotRepeatDraftError extends Error {
  readonly code = 'CANNOT_REPEAT_DRAFT';
  readonly sourceOrderId: string;
  constructor(sourceOrderId: string) {
    super(
      `Cannot repeat order "${sourceOrderId}": source is a draft — resume it instead of cloning.`,
    );
    this.name = 'CannotRepeatDraftError';
    this.sourceOrderId = sourceOrderId;
  }
}

// 010-repeat-last-order: repeat() aborts before opening a database.write()
// action when every source line's variant (or its parent product) is
// soft-deleted. This guarantees the all-unavailable path touches zero rows
// (FR-008 / SC-005).
export class AllItemsUnavailableError extends Error {
  readonly code = 'ALL_ITEMS_UNAVAILABLE';
  constructor(sourceOrderId: string) {
    super(
      `Cannot repeat order "${sourceOrderId}": every item is unavailable in the current catalog.`,
    );
    this.name = 'AllItemsUnavailableError';
  }
}

export interface CreateDraftInput {
  clientId: string;
  salespersonId: string;
}

export interface AddItemInput {
  orderId: string;
  productVariantId: string;
  quantity?: number;
}

// 010-repeat-last-order: repeat() clones an existing order into a brand-new
// draft attached to the same client + salesperson. Prices are re-resolved
// from the CURRENT catalog, discounts are copied verbatim, and lines whose
// variant/product has since been soft-deleted are dropped (their names are
// returned so the UI can present a notice). Draft sources are rejected —
// the UI hook is expected to branch to "resume" before calling repeat().
export interface RepeatInput {
  sourceOrderId: string;
}

export interface RepeatResult {
  orderId: string;
  droppedProductNames: string[];
}

// Watermelon returns soft-deleted rows from `.find()` (the query-level
// `notDeleted` filter doesn't apply to findById). The repeat() availability
// gate therefore has to check `_raw._status` on each record itself. We
// deliberately do NOT declare this as a type predicate — product/variant
// records have plenty of fields, and narrowing them down to only `_raw`
// would lose the product.name access downstream.
function isLive(record: { _raw?: { _status?: string } } | null | undefined): boolean {
  if (!record) return false;
  return record._raw?._status !== 'deleted';
}

async function loadDraft(orderId: string) {
  const order = await ordersRepository.findById(orderId);
  if (!order) throw new OrderNotFoundError(orderId);
  assertValidStatus(order.status);
  if (order.status !== 'draft') {
    if (order.status === 'sent' || order.status === 'canceled') {
      throw new AlreadyTerminalError(orderId, order.status);
    }
    throw new OrderNotDraftError(orderId, order.status);
  }
  return order;
}

export const ordersService = {
  async createDraft(input: CreateDraftInput): Promise<{ orderId: string }> {
    const order = await ordersRepository.create({
      clientId: input.clientId,
      salespersonId: input.salespersonId,
      discountAmount: 0,
      discountMode: 'amount',
    });
    return { orderId: order.id };
  },

  /**
   * Adds a line. If a non-deleted line already exists for the same variant,
   * its quantity is incremented (merge semantics) and no new line is created.
   */
  async addItem(input: AddItemInput): Promise<{ orderItemId: string }> {
    await loadDraft(input.orderId);

    const variant = await productVariantsRepository.findById(input.productVariantId);
    if (!variant) throw new VariantNotFoundError(input.productVariantId);

    const addQty = input.quantity ?? 1;
    if (addQty <= 0) {
      throw new Error('quantity must be > 0');
    }

    const existing = await orderItemsRepository.findByOrder(input.orderId);
    const existingLine = existing.find(
      (line) => line.productVariantId === input.productVariantId,
    );
    if (existingLine) {
      await orderItemsRepository.update(existingLine.id, {
        quantity: existingLine.quantity + addQty,
      });
      return { orderItemId: existingLine.id };
    }

    const created = await orderItemsRepository.create({
      orderId: input.orderId,
      productVariantId: input.productVariantId,
      quantity: addQty,
      unitPrice: variant.price,
      discountAmount: 0,
      discountMode: 'amount',
    });
    return { orderItemId: created.id };
  },

  async updateLineQty(input: { orderItemId: string; quantity: number }): Promise<void> {
    const line = await orderItemsRepository.findById(input.orderItemId);
    if (!line) throw new LineNotFoundError(input.orderItemId);
    if (!Number.isInteger(input.quantity) || input.quantity < 0) {
      throw new Error('quantity must be an integer ≥ 0');
    }
    // The repo asserts the parent is draft; no need to double-check here.
    if (input.quantity === 0) {
      await orderItemsRepository.softDelete(input.orderItemId);
      return;
    }
    await orderItemsRepository.update(input.orderItemId, { quantity: input.quantity });
  },

  async removeLine(input: { orderItemId: string }): Promise<void> {
    const line = await orderItemsRepository.findById(input.orderItemId);
    if (!line) throw new LineNotFoundError(input.orderItemId);
    await orderItemsRepository.softDelete(input.orderItemId);
  },

  async setLineDiscount(input: {
    orderItemId: string;
    discount: DiscountInput | null;
  }): Promise<void> {
    const line = await orderItemsRepository.findById(input.orderItemId);
    if (!line) throw new LineNotFoundError(input.orderItemId);
    const discount: DiscountInput = input.discount ?? { mode: 'amount', value: 0 };
    if (discount.value < 0) throw new Error('discount value must be ≥ 0');
    await orderItemsRepository.update(input.orderItemId, {
      discountAmount: discount.value,
      discountMode: discount.mode,
    });
  },

  async setOrderDiscount(input: {
    orderId: string;
    discount: DiscountInput | null;
  }): Promise<void> {
    await loadDraft(input.orderId);
    const discount: DiscountInput = input.discount ?? { mode: 'amount', value: 0 };
    if (discount.value < 0) throw new Error('discount value must be ≥ 0');
    await ordersRepository.update(input.orderId, {
      discountAmount: discount.value,
      discountMode: discount.mode,
    });
  },

  async send(input: { orderId: string }): Promise<void> {
    await loadDraft(input.orderId);
    const items = await orderItemsRepository.findByOrder(input.orderId);
    if (items.length === 0) {
      throw new EmptyDraftError(input.orderId);
    }
    await ordersRepository.markSent(input.orderId);
  },

  async cancel(input: { orderId: string }): Promise<void> {
    // loadDraft would throw AlreadyTerminalError on sent; we want the same.
    await loadDraft(input.orderId);
    await ordersRepository.cancel(input.orderId);
  },

  // 010-repeat-last-order. See contracts/ordersService.repeat.md for the
  // full behaviour contract. Summary:
  //   - Refuses to clone a Draft source (callers should resume instead).
  //   - Resolves each source line's variant+product; drops lines whose
  //     variant (or parent product) is soft-deleted and collects their names.
  //   - If ZERO lines remain → AllItemsUnavailableError, no DB write.
  //   - Otherwise, creates the new order row + N new line rows inside a
  //     single database.write(...) action. The source row is not mutated.
  //   - Line `unit_price` is read from the CURRENT catalog (variant.price),
  //     not from the source line's historical snapshot (R-001).
  async repeat(input: RepeatInput): Promise<RepeatResult> {
    // 1. Load source.
    const source = await ordersRepository.findById(input.sourceOrderId);
    if (!source) throw new OrderNotFoundError(input.sourceOrderId);
    assertValidStatus(source.status);

    // 2. Status gate. Draft sources must be resumed, not cloned.
    if (source.status === 'draft') {
      throw new CannotRepeatDraftError(input.sourceOrderId);
    }

    // 3. Load source's active lines (findByOrder already filters _status=deleted).
    const sourceLines = await orderItemsRepository.findByOrder(input.sourceOrderId);

    // 4. Availability gate. Resolve variant + parent product for each line
    //    and classify as kept (live variant + live product) or dropped.
    type KeptPlan = {
      productVariantId: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      discountMode: 'amount' | 'percent';
    };
    const kept: KeptPlan[] = [];
    const droppedProductNames: string[] = [];
    for (const line of sourceLines) {
      const variant = await productVariantsRepository.findById(line.productVariantId);
      if (!variant || !isLive(variant)) {
        droppedProductNames.push('Item indisponível');
        continue;
      }
      const product = await productsRepository.findById(variant.productId);
      if (!product || !isLive(product)) {
        droppedProductNames.push(product?.name ?? 'Item indisponível');
        continue;
      }
      kept.push({
        productVariantId: line.productVariantId,
        quantity: line.quantity,
        unitPrice: variant.price, // CURRENT catalog price (R-001).
        discountAmount: line.discountAmount,
        discountMode: line.discountMode,
      });
    }

    // 5. All-unavailable → abort before opening any transaction.
    if (kept.length === 0) {
      throw new AllItemsUnavailableError(input.sourceOrderId);
    }

    // 6. Atomic clone. One database.write = one commit; any throw inside
    //    rolls the whole transaction back (see research R-005).
    const ordersCollection = database.get<Order>('orders');
    const lineItemsCollection = database.get<OrderItem>('order_items');
    const newOrderId = generateId();

    await database.write(async () => {
      await ordersCollection.create((record) => {
        record._raw.id = newOrderId;
        record.clientId = source.clientId;
        record.salespersonId = source.salespersonId;
        record.status = 'draft';
        record.discountAmount = source.discountAmount;
        record.discountMode = source.discountMode;
        record.notes = null;
        record.createdAtMs = Date.now();
        record.sentAtMs = null;
        record.canceledAtMs = null;
        record.pdfUri = null;
        applyTouchOnCreate(record);
      });
      for (const plan of kept) {
        await lineItemsCollection.create((record) => {
          record._raw.id = generateId();
          record.orderId = newOrderId;
          record.productVariantId = plan.productVariantId;
          record.quantity = plan.quantity;
          record.unitPrice = plan.unitPrice;
          record.discountAmount = plan.discountAmount;
          record.discountMode = plan.discountMode;
          applyTouchOnCreate(record);
        });
      }
    });

    return { orderId: newOrderId, droppedProductNames };
  },
};
