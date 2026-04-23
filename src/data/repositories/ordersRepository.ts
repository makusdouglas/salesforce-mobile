import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import { generateId } from '../ids';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import type { DiscountMode, OrderStatus } from '../types';

import { throwNotFound, throwStateTransition, throwValidation } from './_errors';
import { applyTouchOnCreate, applyTouchOnSoftDelete, applyTouchOnUpdate } from './_touch';

const orders = database.get<Order>('orders');
const orderItems = database.get<OrderItem>('order_items');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

export interface OrderCreateInput {
  clientId: string;
  salespersonId: string;
  discountAmount?: number;
  discountMode?: DiscountMode;
  notes?: string;
}

export interface OrderUpdatePatch {
  discountAmount?: number;
  discountMode?: DiscountMode;
  notes?: string | null;
  pdfUri?: string | null;
}

export const ordersRepository = {
  async findById(id: string): Promise<Order | null> {
    return orders.find(id).catch(() => null);
  },

  observe(id: string) {
    return orders.findAndObserve(id).pipe(catchError(() => of<Order | null>(null)));
  },

  observeByClient(clientId: string) {
    return orders.query(Q.where('client_id', clientId), notDeleted).observe();
  },

  observeDraftsForSalesperson(salespersonId: string) {
    return orders
      .query(
        Q.where('salesperson_id', salespersonId),
        Q.where('status', 'draft' satisfies OrderStatus),
        notDeleted,
        Q.sortBy('updated_at', Q.desc),
      )
      .observe();
  },

  async create(input: OrderCreateInput): Promise<Order> {
    if (!input.clientId.trim()) throwValidation('clientId is required', 'clientId');
    if (!input.salespersonId.trim()) throwValidation('salespersonId is required', 'salespersonId');
    if (input.discountAmount !== undefined && input.discountAmount < 0) {
      throwValidation('discountAmount cannot be negative', 'discountAmount');
    }
    return database.write(async () =>
      orders.create((record) => {
        record._raw.id = generateId();
        record.clientId = input.clientId;
        record.salespersonId = input.salespersonId;
        record.status = 'draft';
        record.discountAmount = input.discountAmount ?? 0;
        record.discountMode = input.discountMode ?? 'amount';
        record.notes = input.notes ?? null;
        record.createdAtMs = Date.now();
        record.sentAtMs = null;
        record.canceledAtMs = null;
        record.pdfUri = null;
        applyTouchOnCreate(record);
      }),
    );
  },

  async update(id: string, patch: OrderUpdatePatch): Promise<Order> {
    const record = await orders.find(id).catch(() => null);
    if (!record) throwNotFound('order', id);
    if (patch.discountAmount !== undefined && patch.discountAmount < 0) {
      throwValidation('discountAmount cannot be negative', 'discountAmount');
    }
    // Draft-only mutation gate. R5 + D4: sent/canceled orders are immutable.
    if (record.status !== 'draft') {
      throwStateTransition('order', record.status, 'mutate');
    }
    return database.write(async () =>
      record.update((r) => {
        if (patch.discountAmount !== undefined) r.discountAmount = patch.discountAmount;
        if (patch.discountMode !== undefined) r.discountMode = patch.discountMode;
        if (patch.notes !== undefined) r.notes = patch.notes;
        if (patch.pdfUri !== undefined) r.pdfUri = patch.pdfUri;
        applyTouchOnUpdate(r);
      }),
    );
  },

  async markSent(id: string): Promise<Order> {
    const record = await orders.find(id).catch(() => null);
    if (!record) throwNotFound('order', id);
    if (record.status !== 'draft') {
      throwStateTransition('order', record.status, 'sent');
    }
    return database.write(async () =>
      record.update((r) => {
        r.status = 'sent';
        r.sentAtMs = Date.now();
        applyTouchOnUpdate(r);
      }),
    );
  },

  async cancel(id: string): Promise<Order> {
    const record = await orders.find(id).catch(() => null);
    if (!record) throwNotFound('order', id);
    if (record.status === 'canceled') {
      return record;
    }
    if (record.status !== 'draft') {
      throwStateTransition('order', record.status, 'canceled');
    }
    return database.write(async () =>
      record.update((r) => {
        r.status = 'canceled';
        r.canceledAtMs = Date.now();
        applyTouchOnUpdate(r);
      }),
    );
  },

  async softDelete(id: string): Promise<void> {
    const record = await orders.find(id).catch(() => null);
    if (!record) throwNotFound('order', id);
    const items = await orderItems.query(Q.where('order_id', id), notDeleted).fetch();
    await database.write(async () => {
      for (const item of items) {
        await item.update((r) => {
          applyTouchOnSoftDelete(r);
        });
        await item.markAsDeleted();
      }
      await record.update((r) => {
        applyTouchOnSoftDelete(r);
      });
      await record.markAsDeleted();
    });
  },
};
