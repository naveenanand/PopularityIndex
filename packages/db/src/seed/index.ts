import { getDb } from '../client.js';
import { makePeopleRepository } from '../repositories/people.repository.js';
import { SEED_REGISTRY } from './registry.js';

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function seed() {
  console.log('Seeding database with PAI registry...');

  const db = await getDb();
  const peopleRepo = makePeopleRepository(db);

  // Deduplicate by QID (registry may have duplicates for testing)
  const seen = new Set<string>();
  const unique = SEED_REGISTRY.filter((p) => {
    if (seen.has(p.wikidataQid)) return false;
    seen.add(p.wikidataQid);
    return true;
  });

  console.log(`Seeding ${unique.length} people...`);

  let seeded = 0;
  let failed = 0;

  for (const person of unique) {
    try {
      await peopleRepo.upsertFromWikidata({
        wikidataQid: person.wikidataQid,
        displayName: person.displayName,
        normalizedName: normalizeName(person.displayName),
        occupationSummary: person.category,
        wikipediaPageTitle: person.wikipediaTitle,
      });
      seeded++;
      if (seeded % 25 === 0) {
        console.log(`  Progress: ${seeded}/${unique.length}`);
      }
    } catch (err) {
      failed++;
      console.error(`  Failed to seed ${person.displayName} (${person.wikidataQid}):`, err);
    }
  }

  console.log(`\nSeeding complete: ${seeded} seeded, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

seed().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
