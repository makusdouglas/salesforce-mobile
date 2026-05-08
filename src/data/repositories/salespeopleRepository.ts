import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import { generateId } from '../ids';
import Salesperson from '../models/Salesperson';

import { throwNotFound, throwValidation } from './_errors';
import { applyTouchOnCreate, applyTouchOnSoftDelete, applyTouchOnUpdate } from './_touch';

const collection = database.get<Salesperson>('salespeople');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

export const salespeopleRepository = {
  async findById(id: string): Promise<Salesperson | null> {
    return collection.find(id).catch(() => null);
  },

  query() {
    return collection.query(notDeleted);
  },

  observe(id: string) {
    return collection.findAndObserve(id).pipe(catchError(() => of<Salesperson | null>(null)));
  },

  observeAll() {
    return collection.query(notDeleted).observe();
  },

  async create(input: { name: string; email: string }): Promise<Salesperson> {
    if (!input.name.trim()) throwValidation('name is required', 'name');
    if (!input.email.trim()) throwValidation('email is required', 'email');
    return database.write(async () =>
      collection.create((record) => {
        record._raw.id = generateId();
        record.name = input.name;
        record.email = input.email;
        applyTouchOnCreate(record);
      }),
    );
  },

  async update(id: string, patch: Partial<{ name: string; email: string }>): Promise<Salesperson> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('salesperson', id);
    if (patch.name !== undefined && !patch.name.trim()) {
      throwValidation('name cannot be empty', 'name');
    }
    if (patch.email !== undefined && !patch.email.trim()) {
      throwValidation('email cannot be empty', 'email');
    }
    return database.write(async () =>
      record.update((r) => {
        if (patch.name !== undefined) r.name = patch.name;
        if (patch.email !== undefined) r.email = patch.email;
        applyTouchOnUpdate(r);
      }),
    );
  },

  async softDelete(id: string): Promise<void> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('salesperson', id);
    await database.write(async () => {
      await record.update((r) => {
        applyTouchOnSoftDelete(r);
      });
      await record.markAsDeleted();
    });
  },
};
