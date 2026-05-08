import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { migrations } from './schema/migrations';
import { schema } from './schema/tables';

export const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  dbName: 'salesforce',
});
