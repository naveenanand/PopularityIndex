import { pgTable, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const cacheEntries = pgTable('cache_entries', {
  key: varchar('key', { length: 100 }).primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
