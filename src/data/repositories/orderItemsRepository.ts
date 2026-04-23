import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import { generateId } from '../ids';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import type { DiscountMode } from '../types';

import { throwNotFound, throwStateTransition, throwValidation } from './_errors';
import { applyTouchOnCreate, applyTouchOnSoftDelete, applyTouchOnUpdate } from './_touch';

const collection = database.get<OrderItem>('order_items');
const orders = database.get<Order>('orders');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

export interface OrderItemCreateInput {
  orderId: string;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  discountMode?: DiscountMode;
}

export interface OrderItemUpdatePatch {
  quantity?: number;
  discountAmount?: number;
  discountMode?: DiscountMode;
}

function validateItem(quantity: number, unitPrice: number, discountAmount: number): void {
  if (quantity <= 0) throwValidation('quantity must be > 0', 'quantity');
  if (unitPrice < 0) throwValidation('unitPrice cannot be negative', 'unitPrice');
  if (discountAmount < 0) {
    throwValidation('discountAmount cannot be negative', 'discountAmount');
  }
  // Note: no >subtotal check here — `computeOrderTotals` clamps display-side
  // (see spec FR-016 and research R-006). The stored discount preserves user
  // intent across qty changes.
}

async function assertParentIsDraft(orderId: string): Promise<void> {
  const parent = await orders.find(orderId).catch(() => null);
  if (!parent) throwNotFound('order', orderId);
  if (parent.status !== 'draft') {
    throwStateTransition('order', parent.status, 'mutate');
  }
}

export const orderItemsRepository = {
  async findById(id: string): Promise<OrderItem | null> {
    return collection.find(id).catch(() => null);
  },

  observe(id: string) {
    return collection.findAndObserve(id).pipe(catchError(() => of<OrderItem | null>(null)));
  },

  observeByOrder(orderId: string) {
    return collection.query(Q.where('order_id', orderId), notDeleted).observe();
  },

  async findByOrder(orderId: string): Promise<OrderItem[]> {
    return collection.query(Q.where('order_id', orderId), notDeleted).fetch();
  },

  async create(input: OrderItemCreateInput): Promise<OrderItem> {
    validateItem(input.quantity, input.unitPrice, input.discountAmount ?? 0);
    if (!input.orderId.trim()) throwValidation('orderId is required', 'orderId');
    if (!input.productVariantId.trim()) {
      throwValidation('productVariantId is required', 'productVariantId');
    }
    await assertParentIsDraft(input.orderId);
    return database.write(async () =>
      collection.create((record) => {
        record._raw.id = generateId();
        record.orderId = input.orderId;
        record.productVariantId = input.productVariantId;
        record.quantity = input.quantity;
        record.unitPrice = input.unitPrice;
        record.discountAmount = input.discountAmount ?? 0;
        record.discountMode = input.discountMode ?? 'amount';
        applyTouchOnCreate(record);
      }),
    );
  },

  async update(id: string, patch: OrderItemUpdatePatch): Promise<OrderItem> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('orderItem', id);
    await assertParentIsDraft(record.orderId);
    const nextQuantity = patch.quantity ?? record.quantity;
    const nextDiscount = patch.discountAmount ?? record.discountAmount;
    validateItem(nextQuantity, record.unitPrice, nextDiscount);
    return database.write(async () =>
      record.update((r) => {
        if (patch.quantity !== undefined) r.quantity = patch.quantity;
        if (patch.discountAmount !== undefined) r.discountAmount = patch.discountAmount;
        if (patch.discountMode !== undefined) r.discountMode = patch.discountMode;
        applyTouchOnUpdate(r);
      }),
    );
  },

  async softDelete(id: string): Promise<void> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('orderItem', id);
    await assertParentIsDraft(record.orderId);
    await database.write(async () => {
      await record.update((r) => {
        applyTouchOnSoftDelete(r);
      });
      await record.markAsDeleted();
    });
  },
};
