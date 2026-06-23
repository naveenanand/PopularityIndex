import { eq, desc, sql, and } from 'drizzle-orm';
import type { Db } from '../client.js';
import { scoreSnapshots, people } from '../schema/index.js';
import type { ScoreExplanation } from '@pai/shared';

export interface InsertScoreSnapshotData {
  personId: number;
  calculatedAt: Date;
  scoreModelVersion: string;
  popularityScore: number;
  heatScore: number;
  sentimentScore: number | null;
  controversyScore: number | null;
  coverageScore: number;
  confidenceScore: number;
  explanationJson: ScoreExplanation;
}

export function makeScoresRepository(db: Db) {
  return {
    async insertScoreSnapshot(data: InsertScoreSnapshotData) {
      const [snapshot] = await db
        .insert(scoreSnapshots)
        .values({
          personId: data.personId,
          calculatedAt: data.calculatedAt,
          scoreModelVersion: data.scoreModelVersion,
          popularityScore: data.popularityScore,
          heatScore: data.heatScore,
          sentimentScore: data.sentimentScore,
          controversyScore: data.controversyScore,
          coverageScore: data.coverageScore,
          confidenceScore: data.confidenceScore,
          explanationJson: data.explanationJson as Record<string, unknown>,
        })
        .returning();
      return snapshot;
    },

    async getLatestScore(personId: number) {
      const rows = await db
        .select()
        .from(scoreSnapshots)
        .where(eq(scoreSnapshots.personId, personId))
        .orderBy(desc(scoreSnapshots.calculatedAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async getScoreHistory(personId: number, days = 30) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      return db
        .select()
        .from(scoreSnapshots)
        .where(eq(scoreSnapshots.personId, personId))
        .orderBy(desc(scoreSnapshots.calculatedAt))
        .limit(days);
    },

    async getLeaderboard(
      sortBy: 'popularity' | 'heat' = 'popularity',
      limit = 100,
      offset = 0,
    ) {
      const sortCol =
        sortBy === 'heat' ? scoreSnapshots.heatScore : scoreSnapshots.popularityScore;

      // Get latest score per person using a subquery approach
      const latestScores = db
        .select({
          personId: scoreSnapshots.personId,
          maxCalcAt: sql<Date>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
        })
        .from(scoreSnapshots)
        .groupBy(scoreSnapshots.personId)
        .as('latest_scores');

      return db
        .select({
          person: people,
          score: scoreSnapshots,
        })
        .from(people)
        .innerJoin(latestScores, eq(latestScores.personId, people.id))
        .innerJoin(
          scoreSnapshots,
          and(
            eq(scoreSnapshots.personId, people.id),
            eq(scoreSnapshots.calculatedAt, latestScores.maxCalcAt),
          ),
        )
        .orderBy(desc(sortCol))
        .limit(limit)
        .offset(offset);
    },
  };
}

