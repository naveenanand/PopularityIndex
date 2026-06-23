import { getDb, makePeopleRepository, makeJobsRepository } from '@pai/db';

const SPARQL_BASE = process.env['WIKIDATA_SPARQL_BASE'] ?? 'https://query.wikidata.org';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

interface SparqlBinding {
  wikidataQid: { value: string };
  personLabel: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

// Notable occupations — broad but high-signal categories
const OCCUPATION_QUERY = `
SELECT DISTINCT ?wikidataQid ?personLabel WHERE {
  VALUES ?occ {
    wd:Q33999    wd:Q639669   wd:Q483501   wd:Q82955
    wd:Q36180    wd:Q2526255  wd:Q245068   wd:Q947873
    wd:Q488111   wd:Q177220   wd:Q2066131  wd:Q10798782
  }
  ?person wdt:P31 wd:Q5 ;
          wdt:P106 ?occ .
  ?article schema:about ?person ;
           schema:isPartOf <https://en.wikipedia.org/> .
  BIND(REPLACE(STR(?person), "http://www.wikidata.org/entity/", "") AS ?wikidataQid)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
  FILTER(LANG(?personLabel) = "en")
}
ORDER BY ?personLabel
LIMIT 10000
`;

async function fetchPeopleFromWikidata(): Promise<Array<{ wikidataQid: string; displayName: string }>> {
  const url = `${SPARQL_BASE}/sparql?query=${encodeURIComponent(OCCUPATION_QUERY)}&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as SparqlResponse;
  return data.results.bindings
    .filter(b => b.wikidataQid && b.personLabel && b.wikidataQid.value.startsWith('Q'))
    .map(b => ({ wikidataQid: b.wikidataQid.value, displayName: b.personLabel.value }));
}

export async function runExpandPeopleJob(): Promise<void> {
  const db = await getDb();
  const peopleRepo = makePeopleRepository(db);
  const jobsRepo = makeJobsRepository(db);

  const job = await jobsRepo.startJobRun('expand_people');
  console.log(`[job:${job.id}] Fetching people from Wikidata SPARQL...`);

  try {
    const candidates = await fetchPeopleFromWikidata();
    console.log(`[job:${job.id}] Found ${candidates.length} candidates from Wikidata`);

    let added = 0, skipped = 0;
    const BATCH = 50;

    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      await Promise.all(batch.map(async p => {
        try {
          await peopleRepo.upsertFromWikidata({
            wikidataQid: p.wikidataQid,
            displayName: p.displayName,
            normalizedName: p.displayName.toLowerCase(),
          });
          added++;
        } catch {
          skipped++;
        }
      }));
      if ((i + BATCH) % 500 === 0) {
        console.log(`[job:${job.id}] Progress: ${Math.min(i + BATCH, candidates.length)}/${candidates.length}`);
      }
    }

    await jobsRepo.completeJobRun(job.id, added);
    console.log(`[job:${job.id}] Done: ${added} upserted, ${skipped} skipped`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await jobsRepo.failJobRun(job.id, message);
    throw err;
  }
}
