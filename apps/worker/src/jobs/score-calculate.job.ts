import {
  getDb,
  makePeopleRepository,
  makeObservationsRepository,
  makeScoresRepository,
  makeJobsRepository,
} from '@pai/db';
import {
  MockSearchInterestProvider,
  MockNewsCoverageProvider,
  MockSocialReachProvider,
  MockConversationProvider,
  MockSentimentProvider,
} from '@pai/providers';
import { calculateScores } from '@pai/scoring';
import { buildScoringFeatures } from '../lib/features.js';
import type { ProviderRequest, RawObservation } from '@pai/shared';

export async function runScoreCalculateJob(): Promise<void> {
  const db = await getDb();
  const peopleRepo = makePeopleRepository(db);
  const obsRepo = makeObservationsRepository(db);
  const scoresRepo = makeScoresRepository(db);
  const jobsRepo = makeJobsRepository(db);

  const job = await jobsRepo.startJobRun('score_calculate');
  console.log(`[job:${job.id}] Score calculation started`);

  const mockProviders = [
    new MockSearchInterestProvider(),
    new MockNewsCoverageProvider(),
    new MockSocialReachProvider(),
    new MockConversationProvider(),
    new MockSentimentProvider(),
  ];

  try {
    const allPeople = await peopleRepo.findAll(1000, 0);
    console.log(`[job:${job.id}] Calculating scores for ${allPeople.length} people...`);

    let processed = 0;
    let failed = 0;

    for (const person of allPeople) {
      try {
        // Get live observations from DB
        const liveObs = await obsRepo.getLatestSourceObservations(person.id);
        const pageviewObs = await obsRepo.getRecentPageviews(person.id, 90);

        // Run mock providers at calculate-time (deterministic, no DB storage)
        const providerRequest: ProviderRequest = {
          personId: person.id,
          wikidataQid: person.wikidataQid,
        };

        const mockObsList: RawObservation[] = [];
        for (const provider of mockProviders) {
          const result = await provider.getObservations(providerRequest);
          mockObsList.push(...result.observations);
        }

        // Map DB rows to the shape buildScoringFeatures expects
        const liveObsMapped = liveObs.map((o) => ({
          metricType: o.metricType,
          metricValue: o.metricValue,
          provider: o.provider,
        }));

        const pageviewsMapped = pageviewObs.map((p) => ({
          date: p.date,
          views: p.views,
        }));

        const mockObsMapped = mockObsList.map((o) => ({
          metricType: o.metricType,
          metricValue: o.metricValue,
          provider: 'mock',
        }));

        const features = buildScoringFeatures(liveObsMapped, pageviewsMapped, mockObsMapped);
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
        if (processed % 25 === 0) {
          console.log(`[job:${job.id}] Progress: ${processed}/${allPeople.length}`);
        }
      } catch (err) {
        failed++;
        console.error(`[job:${job.id}] Error scoring ${person.displayName}:`, err);
      }
    }

    await jobsRepo.completeJobRun(job.id, processed);
    console.log(`[job:${job.id}] Done: ${processed} scored, ${failed} failed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await jobsRepo.failJobRun(job.id, message);
    throw err;
  }
}
