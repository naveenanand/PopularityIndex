import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  varchar,
  jsonb,
} from 'drizzle-orm/pg-core';
import { people } from './people.js';

export const sourceProviders = pgTable('source_providers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  type: varchar('type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  configJson: jsonb('config_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const entityMatchReviews = pgTable('entity_match_reviews', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  candidateEntity: text('candidate_entity').notNull(),
  platform: varchar('platform', { length: 50 }).notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const jobRuns = pgTable('job_runs', {
  id: serial('id').primaryKey(),
  jobType: varchar('job_type', { length: 100 }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull(),
  recordsProcessed: integer('records_processed').default(0),
  errorMessage: text('error_message'),
  metadataJson: jsonb('metadata_json'),
});
