import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { database } from '../database';
import { generateId } from '../ids';
import Client from '../models/Client';

import { throwNotFound, throwValidation } from './_errors';
import { applyTouchOnCreate, applyTouchOnSoftDelete, applyTouchOnUpdate } from './_touch';

const collection = database.get<Client>('clients');
const notDeleted = Q.where('_status', Q.notEq('deleted'));

export interface ClientInput {
  salespersonId: string;
  name: string;
  taxId?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  notes?: string;
}

export const clientsRepository = {
  async findById(id: string): Promise<Client | null> {
    return collection.find(id).catch(() => null);
  },

  query() {
    return collection.query(notDeleted);
  },

  observe(id: string) {
    return collection.findAndObserve(id).pipe(catchError(() => of<Client | null>(null)));
  },

  observeAll() {
    return collection.query(notDeleted).observe();
  },

  observeByOwner(salespersonId: string) {
    return collection.query(Q.where('salesperson_id', salespersonId), notDeleted).observe();
  },

  async create(input: ClientInput): Promise<Client> {
    if (!input.name.trim()) throwValidation('name is required', 'name');
    if (!input.salespersonId.trim()) throwValidation('salespersonId is required', 'salespersonId');
    return database.write(async () =>
      collection.create((record) => {
        record._raw.id = generateId();
        record.salespersonId = input.salespersonId;
        record.name = input.name;
        record.taxId = input.taxId ?? null;
        record.phone = input.phone ?? null;
        record.email = input.email ?? null;
        record.addressLine = input.addressLine ?? null;
        record.notes = input.notes ?? null;
        applyTouchOnCreate(record);
      }),
    );
  },

  async update(id: string, patch: Partial<ClientInput>): Promise<Client> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('client', id);
    if (patch.name !== undefined && !patch.name.trim()) {
      throwValidation('name cannot be empty', 'name');
    }
    return database.write(async () =>
      record.update((r) => {
        if (patch.salespersonId !== undefined) r.salespersonId = patch.salespersonId;
        if (patch.name !== undefined) r.name = patch.name;
        if (patch.taxId !== undefined) r.taxId = patch.taxId;
        if (patch.phone !== undefined) r.phone = patch.phone;
        if (patch.email !== undefined) r.email = patch.email;
        if (patch.addressLine !== undefined) r.addressLine = patch.addressLine;
        if (patch.notes !== undefined) r.notes = patch.notes;
        applyTouchOnUpdate(r);
      }),
    );
  },

  async softDelete(id: string): Promise<void> {
    const record = await collection.find(id).catch(() => null);
    if (!record) throwNotFound('client', id);
    await database.write(async () => {
      await record.update((r) => {
        applyTouchOnSoftDelete(r);
      });
      await record.markAsDeleted();
    });
  },
};
