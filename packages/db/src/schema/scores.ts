import {
  pgTable,
  serial,
  integer,
  real,
  timestamp,
  date,
  varchar,
  jsonb,
} from 'drizzle-orm/pg-core';
import { people } from './people.js';

export const featureSnapshots = pgTable('feature_snapshots', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  snapshotDate: date('snapshot_date').notNull(),
  featuresJson: jsonb('features_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scoreSnapshots = pgTable('score_snapshots', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull(),
  scoreModelVersion: varchar('score_model_version', { length: 20 }).notNull(),
  popularityScore: real('popularity_score').notNull(),
  heatScore: real('heat_score').notNull(),
  sentimentScore: real('sentiment_score'),
  controversyScore: real('controversy_score'),
  coverageScore: real('coverage_score').notNull(),
  confidenceScore: real('confidence_score').notNull(),
  explanationJson: jsonb('explanation_json').notNull(),
});
