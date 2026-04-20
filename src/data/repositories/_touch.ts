import type { Model } from '@nozbe/watermelondb';

/**
 * Fields the data layer manages manually on every writable record.
 *
 * `_status` and `_changed` are handled by WatermelonDB's built-in sync
 * machinery (set automatically on create/update/markAsDeleted), so they are
 * intentionally NOT in this interface. Only `serverId` and `updatedAt` are
 * our responsibility.
 */
export interface TouchableRecord extends Model {
  serverId: string | null;
  updatedAt: number;
}

export function applyTouchOnCreate(record: TouchableRecord): void {
  record.serverId = null;
  record.updatedAt = Date.now();
}

export function applyTouchOnUpdate(record: TouchableRecord): void {
  record.updatedAt = Date.now();
}

export function applyTouchOnSoftDelete(record: TouchableRecord): void {
  record.updatedAt = Date.now();
}
