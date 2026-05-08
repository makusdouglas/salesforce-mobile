import { Model, type Query } from '@nozbe/watermelondb';
import { children, field } from '@nozbe/watermelondb/decorators';

import type Client from './Client';
import type Order from './Order';

export default class Salesperson extends Model {
  static table = 'salespeople';

  static associations = {
    clients: { type: 'has_many' as const, foreignKey: 'salesperson_id' },
    orders: { type: 'has_many' as const, foreignKey: 'salesperson_id' },
  };

  @field('name') name!: string;
  @field('email') email!: string;

  @field('server_id') serverId!: string | null;
  @field('updated_at') updatedAt!: number;

  @children('clients') clients!: Query<Client>;
  @children('orders') orders!: Query<Order>;
}
