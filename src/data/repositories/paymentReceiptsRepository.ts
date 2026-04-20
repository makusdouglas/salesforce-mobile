import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import PaymentReceipt from '../models/PaymentReceipt';
import type { PaymentMethod } from '../types';

import { throwNotFound, throwValidation } from './_errors';
import { applyTouchOnCreate, applyTouchOnSoftDelete, applyTouchOnUpdate } from './_touch';

const collection = database.get<PaymentReceipt>('payment_receipts');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'pix', 'transfer', 'card', 'other'];

function isValidMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export interface PaymentReceiptCreateInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  receivedAtMs?: number;
  imageUrl?: string;
  notes?: string;
}

export interface PaymentReceiptUpdatePatch {
  amount?: number;
  method?: PaymentMethod;
  imageUrl?: string | null;
  notes?: string | null;
}

export const paymentReceiptsRepository = {
  async findById(id: string): Promise<PaymentReceipt | null> {
    return collection.find(id).catch(() => null);
  },

  observe(id: string) {
    return collection.findAndObserve(id).pipe(catchError(() => of<PaymentReceipt | null>(null)));
  },

  observeByOrder(orderId: string) {
    return collection.query(Q.where('order_id', orderId), notDeleted).observe();
  },

  async create(input: PaymentReceiptCreateInput): Promise<PaymentReceipt> {
    if (!input.orderId.trim()) throwValidation('orderId is required', 'orderId');
    if (input.amount <= 0) throwValidation('amount must be > 0', 'amount');
    if (!isValidMethod(input.method)) {
      throwValidation(`method must be one of ${PAYMENT_METHODS.join(', ')}`, 'method');
    }
    return database.write(async () =>
      collection.create((record) => {
        record.orderId = input.orderId;
        record.amount = input.amount;
        record.method = input.method;
        record.receivedAtMs = input.receivedAtMs ?? Date.now();
        record.imageUrl = input.imageUrl ?? null;
        record.notes = input.notes ?? null;
        applyTouchOnCreate(record);
      }),
    );
  },

  async update(id: string, patch: PaymentReceiptUpdatePatch): Promise<PaymentReceipt> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('paymentReceipt', id);
    if (patch.amount !== undefined && patch.amount <= 0) {
      throwValidation('amount must be > 0', 'amount');
    }
    if (patch.method !== undefined && !isValidMethod(patch.method)) {
      throwValidation(`method must be one of ${PAYMENT_METHODS.join(', ')}`, 'method');
    }
    return database.write(async () =>
      record.update((r) => {
        if (patch.amount !== undefined) r.amount = patch.amount;
        if (patch.method !== undefined) r.method = patch.method;
        if (patch.imageUrl !== undefined) r.imageUrl = patch.imageUrl;
        if (patch.notes !== undefined) r.notes = patch.notes;
        applyTouchOnUpdate(r);
      }),
    );
  },

  async softDelete(id: string): Promise<void> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('paymentReceipt', id);
    await database.write(async () => {
      await record.update((r) => {
        applyTouchOnSoftDelete(r);
      });
      await record.markAsDeleted();
    });
  },
};
