import {
  pgTable,
  serial,
  integer,
  real,
  text,
  timestamp,
  date,
  varchar,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { people } from './people.js';
import { wikipediaPages } from './people.js';

export const sourceObservations = pgTable('source_observations', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 100 }).notNull(),
  metricType: varchar('metric_type', { length: 100 }).notNull(),
  metricValue: real('metric_value').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  payloadJson: jsonb('payload_json'),
  reliabilityScore: real('reliability_score'),
});

export const pageviewObservations = pgTable(
  'pageview_observations',
  {
    id: serial('id').primaryKey(),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    wikipediaPageId: integer('wikipedia_page_id').references(() => wikipediaPages.id),
    date: date('date').notNull(),
    views: integer('views').notNull(),
    languageCode: varchar('language_code', { length: 10 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('pageview_unique_per_day').on(table.personId, table.date, table.languageCode)],
);

export const newsMentionClusters = pgTable('news_mention_clusters', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  clusterId: text('cluster_id').notNull(),
  articleCount: integer('article_count').notNull(),
  sourcesJson: jsonb('sources_json'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  payloadJson: jsonb('payload_json'),
});

export const searchInterestObservations = pgTable('search_interest_observations', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 100 }).notNull(),
  date: date('date').notNull(),
  interestScore: real('interest_score').notNull(),
  geo: varchar('geo', { length: 10 }),
  observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
  payloadJson: jsonb('payload_json'),
});

export const socialMetricObservations = pgTable('social_metric_observations', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 50 }).notNull(),
  metricType: varchar('metric_type', { length: 100 }).notNull(),
  value: real('value').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  payloadJson: jsonb('payload_json'),
});

export const sentimentObservations = pgTable('sentiment_observations', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 100 }).notNull(),
  sentimentScore: real('sentiment_score').notNull(),
  positiveShare: real('positive_share'),
  neutralShare: real('neutral_share'),
  negativeShare: real('negative_share'),
  controversyScore: real('controversy_score'),
  sentimentConfidence: real('sentiment_confidence'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  payloadJson: jsonb('payload_json'),
});
