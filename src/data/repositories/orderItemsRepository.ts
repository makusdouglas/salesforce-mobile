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
    // Watermelon's plain `.observe()` on a query only re-emits when the
    // *membership* of the result set changes (row added / soft-deleted).
    // It does NOT re-emit when a field on an already-matching row changes,
    // which meant `+`/`-` (quantity) and line-discount edits silently wrote
    // to the DB without the draft screen refreshing until remount.
    // `observeWithColumns([...])` wraps `.observe()` with per-field
    // change propagation for the listed columns — which are exactly the
    // columns the UI reads.
    return collection
      .query(Q.where('order_id', orderId), notDeleted)
      .observeWithColumns(['quantity', 'unit_price', 'discount_amount', 'discount_mode']);
  },

  /**
   * 013-orders-overview: batch observer used by the list to fold the
   * "N itens" label onto every row without N+1 subscriptions. Re-emits
   * on membership changes (item added/removed). The OrdersOverview row
   * only shows the count, so column-level changes don't need to trigger
   * re-renders.
   */
  observeByOrders(orderIds: readonly string[]) {
    if (orderIds.length === 0) return of<readonly OrderItem[]>([]);
    return collection
      .query(Q.where('order_id', Q.oneOf([...orderIds])), notDeleted)
      .observe();
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
