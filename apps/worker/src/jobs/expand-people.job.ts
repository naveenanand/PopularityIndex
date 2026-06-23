import { getDb, makePeopleRepository, makeJobsRepository } from '@pai/db';

const SPARQL_BASE = process.env['WIKIDATA_SPARQL_BASE'] ?? 'https://query.wikidata.org';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

interface SparqlBinding {
  wikidataQid: { value: string };
  personLabel: { value: string };
  occupation?: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

function buildQuery(offset: number, limit = 10000): string {
  return `
SELECT DISTINCT ?wikidataQid ?personLabel (SAMPLE(?occLabel) AS ?occupation) WHERE {
  ?person wdt:P31 wd:Q5 .
  ?enwiki schema:about ?person ;
          schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL {
    ?person wdt:P106 ?occ .
    ?occ rdfs:label ?occLabel .
    FILTER(LANG(?occLabel) = "en")
  }
  BIND(REPLACE(STR(?person), "http://www.wikidata.org/entity/", "") AS ?wikidataQid)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
  FILTER(LANG(?personLabel) = "en")
}
GROUP BY ?wikidataQid ?personLabel
ORDER BY ?wikidataQid
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}

async function fetchPage(offset: number): Promise<Array<{ wikidataQid: string; displayName: string; occupation?: string }>> {
  const query = buildQuery(offset);
  const url = `${SPARQL_BASE}/sparql?query=${encodeURIComponent(query)}&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as SparqlResponse;
  return data.results.bindings
    .filter(b => b.wikidataQid?.value?.startsWith('Q') && b.personLabel?.value)
    .map(b => ({
      wikidataQid: b.wikidataQid.value,
      displayName: b.personLabel.value,
      occupation: b.occupation?.value,
    }));
}

export async function runExpandPeopleJob(startOffset = 0): Promise<void> {
  const db = await getDb();
  const peopleRepo = makePeopleRepository(db);
  const jobsRepo = makeJobsRepository(db);

  const job = await jobsRepo.startJobRun('expand_people');
  console.log(`[job:${job.id}] Expanding people from Wikidata (offset=${startOffset})...`);

  let added = 0, skipped = 0, offset = startOffset;
  const BATCH_SIZE = 50;

  try {
    // Fetch pages until we get fewer results than the page size (last page)
    while (true) {
      console.log(`[job:${job.id}] Fetching SPARQL page at offset=${offset}...`);
      let candidates: Awaited<ReturnType<typeof fetchPage>>;
      try {
        candidates = await fetchPage(offset);
      } catch (err) {
        console.warn(`[job:${job.id}] SPARQL failed at offset=${offset}, stopping:`, err);
        break;
      }

      if (candidates.length === 0) {
        console.log(`[job:${job.id}] No more results at offset=${offset}, done.`);
        break;
      }

      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async p => {
          try {
            await peopleRepo.upsertFromWikidata({
              wikidataQid: p.wikidataQid,
              displayName: p.displayName,
              normalizedName: p.displayName.toLowerCase(),
              ...(p.occupation ? { occupationSummary: p.occupation } : {}),
            });
            added++;
          } catch {
            skipped++;
          }
        }));
      }

      console.log(`[job:${job.id}] offset=${offset}: +${candidates.length} (total added=${added})`);
      offset += candidates.length;

      // Stop after one page per job run — the cron increments offset next run
      // Remove this break to fetch all pages in one run (risky for timeouts)
      break;
    }

    await jobsRepo.completeJobRun(job.id, added);
    console.log(`[job:${job.id}] Done: offset=${offset}, added=${added}, skipped=${skipped}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await jobsRepo.failJobRun(job.id, message);
    throw err;
  }
}
