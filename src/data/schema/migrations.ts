import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'products',
          columns: [{ name: 'category', type: 'string', isOptional: true, isIndexed: true }],
        }),
      ],
    },
  ],
});
