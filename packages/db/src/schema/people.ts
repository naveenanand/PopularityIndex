import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  real,
} from 'drizzle-orm/pg-core';

export const people = pgTable('people', {
  id: serial('id').primaryKey(),
  wikidataQid: varchar('wikidata_qid', { length: 20 }).notNull().unique(),
  displayName: text('display_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  dateOfBirth: text('date_of_birth'),
  occupationSummary: text('occupation_summary'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const personAliases = pgTable('person_aliases', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
  aliasType: varchar('alias_type', { length: 50 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const wikipediaPages = pgTable('wikipedia_pages', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  languageCode: varchar('language_code', { length: 10 }).notNull(),
  pageTitle: text('page_title').notNull(),
  pageId: integer('page_id'),
  isPrimary: boolean('is_primary').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const socialAccounts = pgTable('social_accounts', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 50 }).notNull(),
  handle: text('handle'),
  platformAccountId: text('platform_account_id'),
  verified: boolean('verified').default(false).notNull(),
  matchConfidence: real('match_confidence'),
  matchMethod: varchar('match_method', { length: 100 }),
  sourceUrl: text('source_url'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
});
