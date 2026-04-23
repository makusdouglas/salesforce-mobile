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

import { ordersRepository } from '@/data/repositories/ordersRepository';
import { orderItemsRepository } from '@/data/repositories/orderItemsRepository';
import { productVariantsRepository } from '@/data/repositories/productVariantsRepository';

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

export interface CreateDraftInput {
  clientId: string;
  salespersonId: string;
}

export interface AddItemInput {
  orderId: string;
  productVariantId: string;
  quantity?: number;
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
};
