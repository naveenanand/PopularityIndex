import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, people } from '@pai/db';
import { isNull, eq } from 'drizzle-orm';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const WIKIMEDIA_UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';
const LIMIT = parseInt(process.argv[2] ?? '500', 10);

async function fetchPhotoUrl(displayName: string): Promise<string | null> {
  const title = encodeURIComponent(displayName.replace(/ /g, '_'));
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail?: { source: string } };
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

const db = await getDb();

const rows = await db
  .select({ id: people.id, displayName: people.displayName })
  .from(people)
  .where(isNull(people.photoUrl))
  .limit(LIMIT);

console.log(`Updating photos for ${rows.length} people without photo_url...`);

let updated = 0;
const BATCH = 10;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  await Promise.all(batch.map(async (p) => {
    const photoUrl = await fetchPhotoUrl(p.displayName);
    if (photoUrl) {
      await db.update(people).set({ photoUrl }).where(eq(people.id, p.id));
      updated++;
    }
  }));
  if (i % 100 === 0 && i > 0) console.log(`  ${i}/${rows.length} processed, ${updated} photos found`);
}

console.log(`Done. Updated ${updated}/${rows.length} people with photo URLs.`);
