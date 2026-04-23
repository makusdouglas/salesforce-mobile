import { Database } from '@nozbe/watermelondb';

import { adapter } from './adapter';
import {
  Client,
  Order,
  OrderItem,
  OrderNumberCounter,
  PaymentReceipt,
  Product,
  ProductVariant,
  Salesperson,
} from './models';

export const database = new Database({
  adapter,
  modelClasses: [
    Salesperson,
    Client,
    Product,
    ProductVariant,
    Order,
    OrderItem,
    OrderNumberCounter,
    PaymentReceipt,
  ],
});
