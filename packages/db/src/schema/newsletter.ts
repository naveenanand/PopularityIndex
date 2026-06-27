import { pgTable, serial, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id:               serial('id').primaryKey(),
  email:            varchar('email', { length: 255 }).unique().notNull(),
  unsubscribeToken: varchar('unsubscribe_token', { length: 64 }).notNull(),
  confirmed:        boolean('confirmed').notNull().default(false),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
