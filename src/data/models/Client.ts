import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, field, relation } from '@nozbe/watermelondb/decorators';

import type Order from './Order';
import type Salesperson from './Salesperson';

export default class Client extends Model {
  static table = 'clients';

  static associations = {
    salespeople: { type: 'belongs_to' as const, key: 'salesperson_id' },
    orders: { type: 'has_many' as const, foreignKey: 'client_id' },
  };

  @field('salesperson_id') salespersonId!: string;
  @field('name') name!: string;
  @field('tax_id') taxId!: string | null;
  @field('phone') phone!: string | null;
  @field('email') email!: string | null;
  @field('address_line') addressLine!: string | null;
  @field('notes') notes!: string | null;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @relation('salespeople', 'salesperson_id') salesperson!: Relation<Salesperson>;
  @children('orders') orders!: Query<Order>;
}
