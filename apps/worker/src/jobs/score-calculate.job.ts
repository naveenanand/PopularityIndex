import {
  getDb,
  makePeopleRepository,
  makeObservationsRepository,
  makeScoresRepository,
  makeJobsRepository,
  scoreSnapshots,
  people,
} from '@pai/db';
import {
  GoogleNewsProvider,
  RedditConversationProvider,
  YouTubeSocialProvider,
  WikipediaTrendingProvider,
} from '@pai/providers';
import { calculateScores } from '@pai/scoring';
import { buildScoringFeatures } from '../lib/features.js';
import type { ProviderRequest, RawObservation } from '@pai/shared';
import { desc, eq, sql } from 'drizzle-orm';
import pLimit from 'p-limit';

// Limit concurrent provider calls — Google News RSS is fast but be courteous
const CONCURRENCY = parseInt(process.env['PROVIDER_CONCURRENCY'] ?? '2', 10);

const googleNews = new GoogleNewsProvider();
const reddit     = new RedditConversationProvider();
const youtube    = new YouTubeSocialProvider();
const trending   = new WikipediaTrendingProvider();

export async function runScoreCalculateJob(): Promise<void> {
  const db = await getDb();
  const peopleRepo = makePeopleRepository(db);
  const obsRepo    = makeObservationsRepository(db);
  const scoresRepo = makeScoresRepository(db);
  const jobsRepo   = makeJobsRepository(db);

  const job = await jobsRepo.startJobRun('score_calculate');
  console.log(`[job:${job.id}] Score calculation started`);
  console.log(`[job:${job.id}] News: google_news(live) | Reddit(${reddit.providerType}) | YouTube(${youtube.providerType}) | WikipediaTrending(live)`);

  const limit = pLimit(CONCURRENCY);
  let processed = 0;
  let failed = 0;

  try {
    // Only score people who already have score_snapshots (the top 200-ish important people).
    // Avoids making thousands of provider calls for unscored people in the 100k DB.
    const latestScores = db
      .select({
        personId: scoreSnapshots.personId,
        maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
      })
      .from(scoreSnapshots)
      .groupBy(scoreSnapshots.personId)
      .as('latest_scores');

    const scoredPeople = await db
      .select({ id: people.id, wikidataQid: people.wikidataQid, displayName: people.displayName })
      .from(people)
      .innerJoin(latestScores, eq(latestScores.personId, people.id))
      .orderBy(desc(latestScores.maxCalcAt))
      .limit(500);

    console.log(`[job:${job.id}] Scoring ${scoredPeople.length} people with existing scores...`);

    await Promise.all(scoredPeople.map(person => limit(async () => {
      try {
        const liveObs    = await obsRepo.getLatestSourceObservations(person.id);
        const pageviewObs = await obsRepo.getRecentPageviews(person.id, 90);

        const ytChannelObs   = liveObs.find(o => o.metricType === 'youtube_channel_id');
        const youtubeChannelId = (ytChannelObs?.payloadJson as { channelId?: string } | null)?.channelId;

        const req: ProviderRequest = {
          personId:           person.id,
          wikidataQid:        person.wikidataQid,
          displayName:        person.displayName,
          wikipediaPageTitle: person.displayName.replace(/ /g, '_'),
          ...(youtubeChannelId ? { youtubeChannelId } : {}),
        };

        const [newsResult, redditResult, youtubeResult, trendingResult] = await Promise.all([
          googleNews.getObservations(req),
          reddit.getObservations(req),
          youtube.getObservations(req),
          trending.getObservations(req),
        ]);

        const externalObs: RawObservation[] = [
          ...newsResult.observations,
          ...redditResult.observations,
          ...youtubeResult.observations,
          ...trendingResult.observations,
        ];

        const liveObsMapped    = liveObs.map(o => ({ metricType: o.metricType, metricValue: o.metricValue, provider: o.provider }));
        const pageviewsMapped  = pageviewObs.map(p => ({ date: p.date, views: p.views }));
        const externalObsMapped = externalObs.map(o => ({
          metricType:  o.metricType,
          metricValue: o.metricValue,
          provider:    (o.payload?.['provider'] as string | undefined) ?? 'live',
        }));

        const features = buildScoringFeatures(liveObsMapped, pageviewsMapped, externalObsMapped);
        const result   = calculateScores({ personId: person.id, features });

        await scoresRepo.insertScoreSnapshot({
          personId:           person.id,
          calculatedAt:       new Date(),
          scoreModelVersion:  result.scoreModelVersion,
          popularityScore:    result.popularityScore,
          heatScore:          result.heatScore,
          sentimentScore:     result.sentimentScore,
          controversyScore:   result.controversyScore,
          coverageScore:      result.coverageScore,
          confidenceScore:    result.confidenceScore,
          explanationJson:    result.explanationJson,
        });

        processed++;
        if (processed % 25 === 0 || processed === scoredPeople.length) {
          console.log(`[job:${job.id}] Progress: ${processed}/${scoredPeople.length}`);
        }
      } catch (err) {
        failed++;
        console.error(`[job:${job.id}] Error scoring ${person.displayName}:`, err);
      }
    })));

    await jobsRepo.completeJobRun(job.id, processed);
    console.log(`[job:${job.id}] Done: ${processed} scored, ${failed} failed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await jobsRepo.failJobRun(job.id, message);
    throw err;
  }
}
