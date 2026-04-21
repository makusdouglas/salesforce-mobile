import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import { generateId } from '../ids';
import OrderItem from '../models/OrderItem';

import { throwNotFound, throwValidation } from './_errors';
import { applyTouchOnCreate, applyTouchOnSoftDelete, applyTouchOnUpdate } from './_touch';

const collection = database.get<OrderItem>('order_items');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

export interface OrderItemCreateInput {
  orderId: string;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
}

export interface OrderItemUpdatePatch {
  quantity?: number;
  discountAmount?: number;
}

function validateItem(quantity: number, unitPrice: number, discountAmount: number): void {
  if (quantity <= 0) throwValidation('quantity must be > 0', 'quantity');
  if (unitPrice < 0) throwValidation('unitPrice cannot be negative', 'unitPrice');
  if (discountAmount < 0) {
    throwValidation('discountAmount cannot be negative', 'discountAmount');
  }
  if (discountAmount > quantity * unitPrice) {
    throwValidation(
      'discountAmount cannot exceed line subtotal (quantity × unitPrice)',
      'discountAmount',
    );
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

  async create(input: OrderItemCreateInput): Promise<OrderItem> {
    validateItem(input.quantity, input.unitPrice, input.discountAmount ?? 0);
    if (!input.orderId.trim()) throwValidation('orderId is required', 'orderId');
    if (!input.productVariantId.trim()) {
      throwValidation('productVariantId is required', 'productVariantId');
    }
    return database.write(async () =>
      collection.create((record) => {
        record._raw.id = generateId();
        record.orderId = input.orderId;
        record.productVariantId = input.productVariantId;
        record.quantity = input.quantity;
        record.unitPrice = input.unitPrice;
        record.discountAmount = input.discountAmount ?? 0;
        applyTouchOnCreate(record);
      }),
    );
  },

  async update(id: string, patch: OrderItemUpdatePatch): Promise<OrderItem> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('orderItem', id);
    const nextQuantity = patch.quantity ?? record.quantity;
    const nextDiscount = patch.discountAmount ?? record.discountAmount;
    validateItem(nextQuantity, record.unitPrice, nextDiscount);
    return database.write(async () =>
      record.update((r) => {
        if (patch.quantity !== undefined) r.quantity = patch.quantity;
        if (patch.discountAmount !== undefined) r.discountAmount = patch.discountAmount;
        applyTouchOnUpdate(r);
      }),
    );
  },

  async softDelete(id: string): Promise<void> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('orderItem', id);
    await database.write(async () => {
      await record.update((r) => {
        applyTouchOnSoftDelete(r);
      });
      await record.markAsDeleted();
    });
  },
};
