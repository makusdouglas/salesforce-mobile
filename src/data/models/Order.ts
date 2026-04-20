import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, field, relation } from '@nozbe/watermelondb/decorators';

import type { OrderStatus } from '../types';
import type Client from './Client';
import type OrderItem from './OrderItem';
import type PaymentReceipt from './PaymentReceipt';
import type Salesperson from './Salesperson';

export default class Order extends Model {
  static table = 'orders';

  static associations = {
    clients: { type: 'belongs_to' as const, key: 'client_id' },
    salespeople: { type: 'belongs_to' as const, key: 'salesperson_id' },
    order_items: { type: 'has_many' as const, foreignKey: 'order_id' },
    payment_receipts: { type: 'has_many' as const, foreignKey: 'order_id' },
  };

  @field('client_id') clientId!: string;
  @field('salesperson_id') salespersonId!: string;
  @field('status') status!: OrderStatus;
  @field('discount_amount') discountAmount!: number;
  @field('notes') notes!: string | null;
  @field('created_at_ms') createdAtMs!: number;
  @field('sent_at_ms') sentAtMs!: number | null;
  @field('pdf_uri') pdfUri!: string | null;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @relation('clients', 'client_id') client!: Relation<Client>;
  @relation('salespeople', 'salesperson_id') salesperson!: Relation<Salesperson>;
  @children('order_items') items!: Query<OrderItem>;
  @children('payment_receipts') receipts!: Query<PaymentReceipt>;
}
