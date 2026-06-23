import { eq, and, gte, desc } from 'drizzle-orm';
import type { Db } from '../client.js';
import {
  pageviewObservations,
  sourceObservations,
  sentimentObservations,
  socialMetricObservations,
  searchInterestObservations,
  newsMentionClusters,
} from '../schema/index.js';

export function makeObservationsRepository(db: Db) {
  return {
    async upsertPageview(data: {
      personId: number;
      wikipediaPageId?: number;
      date: string;
      views: number;
      languageCode: string;
    }) {
      await db
        .insert(pageviewObservations)
        .values({
          personId: data.personId,
          wikipediaPageId: data.wikipediaPageId,
          date: data.date,
          views: data.views,
          languageCode: data.languageCode,
          observedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            pageviewObservations.personId,
            pageviewObservations.date,
            pageviewObservations.languageCode,
          ],
          set: {
            views: data.views,
            observedAt: new Date(),
          },
        });
    },

    async upsertSourceObservation(data: {
      personId: number;
      provider: string;
      metricType: string;
      metricValue: number;
      observedAt: Date;
      payloadJson?: Record<string, unknown>;
      reliabilityScore?: number;
    }) {
      await db.insert(sourceObservations).values({
        personId: data.personId,
        provider: data.provider,
        metricType: data.metricType,
        metricValue: data.metricValue,
        observedAt: data.observedAt,
        payloadJson: data.payloadJson,
        reliabilityScore: data.reliabilityScore,
      });
    },

    async getRecentPageviews(personId: number, days: number) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().slice(0, 10);

      return db
        .select()
        .from(pageviewObservations)
        .where(
          and(
            eq(pageviewObservations.personId, personId),
            gte(pageviewObservations.date, sinceStr),
            eq(pageviewObservations.languageCode, 'en'),
          ),
        )
        .orderBy(desc(pageviewObservations.date));
    },

    async getLatestSourceObservations(personId: number) {
      return db
        .select()
        .from(sourceObservations)
        .where(eq(sourceObservations.personId, personId))
        .orderBy(desc(sourceObservations.observedAt));
    },
  };
}
