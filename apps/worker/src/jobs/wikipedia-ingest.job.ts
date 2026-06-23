import pLimit from 'p-limit';
import {
  getDb,
  makePeopleRepository,
  makeObservationsRepository,
  makeJobsRepository,
} from '@pai/db';
import { WikipediaPageviewsProvider, WikipediaMetadataProvider, WikidataProvider } from '@pai/providers';
import { withRetry } from '../lib/retry.js';

export interface IngestJobOptions {
  personIds?: number[];
  days?: number;
  concurrency?: number;
}

export async function runWikipediaIngestJob(options: IngestJobOptions = {}): Promise<void> {
  const { days = 90, concurrency = 3 } = options;

  const db = await getDb();
  const peopleRepo = makePeopleRepository(db);
  const obsRepo = makeObservationsRepository(db);
  const jobsRepo = makeJobsRepository(db);

  const job = await jobsRepo.startJobRun('wikipedia_ingest', { days, concurrency });
  console.log(`[job:${job.id}] Wikipedia ingest started`);

  const pageviewsProvider = new WikipediaPageviewsProvider();
  const metadataProvider = new WikipediaMetadataProvider();
  const wikidataProvider = new WikidataProvider();

  try {
    const allPeopleWithPages = await peopleRepo.getAllWithWikipediaPages();

    // Filter to requested personIds if provided
    const targets = options.personIds
      ? allPeopleWithPages.filter((r) => options.personIds!.includes(r.person.id))
      : allPeopleWithPages;

    // Filter out entries with no wikipedia page
    const valid = targets.filter((r) => r.wikiPage?.pageTitle);

    console.log(`[job:${job.id}] Processing ${valid.length} people...`);

    const limit = pLimit(concurrency);
    let processed = 0;
    let failed = 0;

    await Promise.all(
      valid.map((record) =>
        limit(async () => {
          const { person, wikiPage } = record;
          if (!wikiPage) return;

          try {
            // Wikipedia pageviews
            const pageviewResult = await withRetry(
              () =>
                pageviewsProvider.getObservations({
                  personId: person.id,
                  wikidataQid: person.wikidataQid,
                  wikipediaPageTitle: wikiPage.pageTitle,
                  languageCode: 'en',
                }),
              { label: `pageviews/${person.displayName}` },
            );

            for (const obs of pageviewResult.observations) {
              if (obs.metricType === 'wikipedia_daily_pageviews' && obs.payload?.['date']) {
                const dateStr = String(obs.payload['date']);
                const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
                await obsRepo.upsertPageview({
                  personId: person.id,
                  wikipediaPageId: wikiPage.id,
                  date: formattedDate,
                  views: obs.metricValue,
                  languageCode: 'en',
                });
              } else {
                await obsRepo.upsertSourceObservation({
                  personId: person.id,
                  provider: pageviewResult.providerName,
                  metricType: obs.metricType,
                  metricValue: obs.metricValue,
                  observedAt: obs.observedAt,
                  payloadJson: obs.payload,
                  reliabilityScore: obs.reliabilityScore,
                });
              }
            }

            // Wikipedia metadata
            const metaResult = await withRetry(
              () =>
                metadataProvider.getObservations({
                  personId: person.id,
                  wikidataQid: person.wikidataQid,
                  wikipediaPageTitle: wikiPage.pageTitle,
                }),
              { label: `metadata/${person.displayName}` },
            );

            for (const obs of metaResult.observations) {
              await obsRepo.upsertSourceObservation({
                personId: person.id,
                provider: metaResult.providerName,
                metricType: obs.metricType,
                metricValue: obs.metricValue,
                observedAt: obs.observedAt,
                payloadJson: obs.payload,
                reliabilityScore: obs.reliabilityScore,
              });
            }

            // Wikidata sitelinks
            const wikidataResult = await withRetry(
              () =>
                wikidataProvider.getObservations({
                  personId: person.id,
                  wikidataQid: person.wikidataQid,
                }),
              { label: `wikidata/${person.displayName}` },
            );

            for (const obs of wikidataResult.observations) {
              await obsRepo.upsertSourceObservation({
                personId: person.id,
                provider: wikidataResult.providerName,
                metricType: obs.metricType,
                metricValue: obs.metricValue,
                observedAt: obs.observedAt,
                payloadJson: obs.payload,
                reliabilityScore: obs.reliabilityScore,
              });
            }

            processed++;
            if (processed % 10 === 0) {
              console.log(`[job:${job.id}] Progress: ${processed}/${valid.length}`);
            }
          } catch (err) {
            failed++;
            console.error(`[job:${job.id}] Error processing ${person.displayName}:`, err);
          }
        }),
      ),
    );

    await jobsRepo.completeJobRun(job.id, processed);
    console.log(`[job:${job.id}] Done: ${processed} processed, ${failed} failed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await jobsRepo.failJobRun(job.id, message);
    throw err;
  }
}
