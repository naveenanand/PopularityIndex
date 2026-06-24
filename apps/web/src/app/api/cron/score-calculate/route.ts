import { NextResponse } from 'next/server';
import { eq, sql, desc } from 'drizzle-orm';
import { people, scoreSnapshots, pageviewObservations } from '@pai/db';
import { db } from '../../../../lib/db';
import { calculateScores } from '@pai/scoring';
import type { ScoringFeatures } from '@pai/shared';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Score up to 20 people per invocation, prioritising never-scored or oldest-scored first.
const BATCH_SIZE = 20;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conn = await db();
  if (!conn) return NextResponse.json({ error: 'No DB' }, { status: 500 });

  // People with oldest scores first (NULLS FIRST = never scored gets top priority)
  const latestScores = conn
    .select({
      personId: scoreSnapshots.personId,
      maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
    })
    .from(scoreSnapshots)
    .groupBy(scoreSnapshots.personId)
    .as('latest_scores');

  const candidates = await conn
    .select({ id: people.id, wikidataQid: people.wikidataQid, displayName: people.displayName })
    .from(people)
    .leftJoin(latestScores, eq(latestScores.personId, people.id))
    .orderBy(sql`${latestScores.maxCalcAt} ASC NULLS FIRST`)
    .limit(BATCH_SIZE);

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, scored: 0, message: 'No people to score' });
  }

  let scored = 0;

  for (const person of candidates) {
    try {
      // Read existing pageview observations from DB (ingested by `pnpm ingest:wikipedia`)
      const pvRows = await conn
        .select({ views: pageviewObservations.views })
        .from(pageviewObservations)
        .where(eq(pageviewObservations.personId, person.id))
        .orderBy(desc(pageviewObservations.date))
        .limit(90);

      const views = pvRows.map(r => r.views);
      const avg30 = views.slice(0, 30).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(30, views.length));
      const avg7 = views.slice(0, 7).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(7, views.length));

      const features: ScoringFeatures = {
        ...(avg30 > 0 ? { wikipediaPageviewAverage30d: avg30 } : {}),
        ...(avg30 > 0 && avg7 > 0 ? { wikipediaPageviewSpike7d: avg7 / Math.max(1, avg30) } : {}),
      };

      const result = calculateScores({ personId: person.id, features });

      await conn.insert(scoreSnapshots).values({
        personId: person.id,
        calculatedAt: new Date(),
        scoreModelVersion: result.scoreModelVersion,
        popularityScore: result.popularityScore,
        heatScore: result.heatScore,
        ...(result.sentimentScore !== null ? { sentimentScore: result.sentimentScore } : {}),
        ...(result.controversyScore !== null ? { controversyScore: result.controversyScore } : {}),
        coverageScore: result.coverageScore,
        confidenceScore: result.confidenceScore,
        explanationJson: result.explanationJson,
      });

      scored++;
    } catch {
      // Non-fatal: continue scoring remaining people
    }
  }

  return NextResponse.json({ ok: true, scored, total: candidates.length });
}
