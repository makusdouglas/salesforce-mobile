// 011-order-email-delivery: thin wrapper around the order_number_counters
// collection. All methods expect to be called INSIDE a caller-supplied
// `database.write(...)` action — the allocator is always bundled with the
// order row write so the two stay atomic.

import type OrderNumberCounter from '../models/OrderNumberCounter';
import { database } from '../database';
import { applyTouchOnCreate, applyTouchOnUpdate } from './_touch';

const COLLECTION = 'order_number_counters';

export const orderNumberCountersRepository = {
  /** Returns the counter row for the year, or null if never allocated. */
  async findByYear(year: number): Promise<OrderNumberCounter | null> {
    try {
      return await database.get<OrderNumberCounter>(COLLECTION).find(String(year));
    } catch {
      return null;
    }
  },

  /**
   * Reads + atomically bumps the counter for `year`. MUST run inside a
   * `database.write(...)` action the caller opens. Returns the value that
   * was allocated (pre-bump), so the caller formats `#YYYY-<value>`.
   */
  async allocateNext(year: number): Promise<number> {
    const collection = database.get<OrderNumberCounter>(COLLECTION);
    const existing = await this.findByYear(year);
    if (existing) {
      const allocated = existing.nextValue;
      await existing.update((record) => {
        record.nextValue = allocated + 1;
        applyTouchOnUpdate(record);
      });
      return allocated;
    }
    // First allocation for this year — create the row with next=2 and
    // return 1 as the allocated value.
    await collection.create((record) => {
      record._raw.id = String(year);
      record.year = year;
      record.nextValue = 2;
      applyTouchOnCreate(record);
    });
    return 1;
  },

  /**
   * Force the counter for `year` to a specific next-value. Used by the
   * sync-time conflict reconciliation path when the local counter must jump
   * ahead of a taken number. Caller owns the transaction.
   */
  async setNextValue(year: number, nextValue: number): Promise<void> {
    const collection = database.get<OrderNumberCounter>(COLLECTION);
    const existing = await this.findByYear(year);
    if (existing) {
      await existing.update((record) => {
        record.nextValue = nextValue;
        applyTouchOnUpdate(record);
      });
      return;
    }
    await collection.create((record) => {
      record._raw.id = String(year);
      record.year = year;
      record.nextValue = nextValue;
      applyTouchOnCreate(record);
    });
  },
};
