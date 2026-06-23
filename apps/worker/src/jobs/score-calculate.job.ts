import {
  getDb,
  makePeopleRepository,
  makeObservationsRepository,
  makeScoresRepository,
  makeJobsRepository,
} from '@pai/db';
import {
  GDELTNewsProvider,
  RedditConversationProvider,
  YouTubeSocialProvider,
  WikipediaTrendingProvider,
} from '@pai/providers';
import { calculateScores } from '@pai/scoring';
import { buildScoringFeatures } from '../lib/features.js';
import type { ProviderRequest, RawObservation } from '@pai/shared';
import pLimit from 'p-limit';

const CONCURRENCY = parseInt(process.env['PROVIDER_CONCURRENCY'] ?? '3', 10);

const gdelt = new GDELTNewsProvider();
const reddit = new RedditConversationProvider();
const youtube = new YouTubeSocialProvider();
const trending = new WikipediaTrendingProvider();

export async function runScoreCalculateJob(): Promise<void> {
  const db = await getDb();
  const peopleRepo = makePeopleRepository(db);
  const obsRepo = makeObservationsRepository(db);
  const scoresRepo = makeScoresRepository(db);
  const jobsRepo = makeJobsRepository(db);

  const job = await jobsRepo.startJobRun('score_calculate');
  console.log(`[job:${job.id}] Score calculation started`);
  console.log(`[job:${job.id}] Providers: GDELT(news+sentiment) | Reddit(${reddit.providerType}) | YouTube(${youtube.providerType}) | WikipediaTrending(search)`);

  const limit = pLimit(CONCURRENCY);
  let processed = 0;
  let failed = 0;

  try {
    const allPeople = await peopleRepo.findAll(5000, 0);
    console.log(`[job:${job.id}] Calculating scores for ${allPeople.length} people...`);

    await Promise.all(allPeople.map(person => limit(async () => {
      try {
        const liveObs = await obsRepo.getLatestSourceObservations(person.id);
        const pageviewObs = await obsRepo.getRecentPageviews(person.id, 90);

        // YouTube channel ID stored by WikidataProvider saves 100 quota units per person
        const ytChannelObs = liveObs.find(o => o.metricType === 'youtube_channel_id');
        const youtubeChannelId = (ytChannelObs?.payloadJson as { channelId?: string } | null)?.channelId;

        const req: ProviderRequest = {
          personId: person.id,
          wikidataQid: person.wikidataQid,
          displayName: person.displayName,
          wikipediaPageTitle: person.displayName.replace(/ /g, '_'),
          ...(youtubeChannelId ? { youtubeChannelId } : {}),
        };

        const [gdeltResult, redditResult, youtubeResult, trendingResult] = await Promise.all([
          gdelt.getObservations(req),
          reddit.getObservations(req),
          youtube.getObservations(req),
          trending.getObservations(req),
        ]);

        const externalObs: RawObservation[] = [
          ...gdeltResult.observations,
          ...redditResult.observations,
          ...youtubeResult.observations,
          ...trendingResult.observations,
        ];

        const liveObsMapped = liveObs.map(o => ({ metricType: o.metricType, metricValue: o.metricValue, provider: o.provider }));
        const pageviewsMapped = pageviewObs.map(p => ({ date: p.date, views: p.views }));
        const externalObsMapped = externalObs.map(o => ({ metricType: o.metricType, metricValue: o.metricValue, provider: (o.payload?.['provider'] as string | undefined) ?? 'live' }));

        const features = buildScoringFeatures(liveObsMapped, pageviewsMapped, externalObsMapped);
        const result = calculateScores({ personId: person.id, features });

        await scoresRepo.insertScoreSnapshot({
          personId: person.id,
          calculatedAt: new Date(),
          scoreModelVersion: result.scoreModelVersion,
          popularityScore: result.popularityScore,
          heatScore: result.heatScore,
          sentimentScore: result.sentimentScore,
          controversyScore: result.controversyScore,
          coverageScore: result.coverageScore,
          confidenceScore: result.confidenceScore,
          explanationJson: result.explanationJson,
        });

        processed++;
        if (processed % 25 === 0 || processed === allPeople.length) {
          console.log(`[job:${job.id}] Progress: ${processed}/${allPeople.length}`);
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
