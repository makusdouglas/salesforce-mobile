/**
 * Public data-layer barrel.
 *
 * Re-exports only what feature code may consume: the typed repositories plus
 * the shared types and the error class. The `Database` singleton, Model
 * classes, SQLite adapter, and schema internals are intentionally NOT
 * re-exported — see contracts/repository.md "What repositories do NOT expose".
 */

export {
  clientsRepository,
  orderItemsRepository,
  ordersRepository,
  paymentReceiptsRepository,
  productsRepository,
  productVariantsRepository,
  salespeopleRepository,
} from './repositories';

export {
  DataLayerError,
  type DataLayerErrorCode,
  type OrderStatus,
  type PaymentMethod,
  type SyncStatus,
} from './types';

export type { default as Client } from './models/Client';
export type { default as Order } from './models/Order';
export type { default as OrderItem } from './models/OrderItem';
export type { default as PaymentReceipt } from './models/PaymentReceipt';
export type { default as Product } from './models/Product';
export type { default as ProductVariant } from './models/ProductVariant';
export type { default as Salesperson } from './models/Salesperson';

export type { ClientInput } from './repositories/clientsRepository';
export type { OrderCreateInput, OrderUpdatePatch } from './repositories/ordersRepository';
export type {
  OrderItemCreateInput,
  OrderItemUpdatePatch,
} from './repositories/orderItemsRepository';
export type {
  PaymentReceiptCreateInput,
  PaymentReceiptUpdatePatch,
} from './repositories/paymentReceiptsRepository';

export { supabase } from './supabase';

export { generateId } from './ids';
