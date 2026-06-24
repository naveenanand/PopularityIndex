import { NextResponse } from 'next/server';
import { isNull, eq } from 'drizzle-orm';
import { people } from '@pai/db';
import { db } from '../../../../lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';
const BATCH_SIZE = 50;

async function fetchPhotoUrl(displayName: string): Promise<string | null> {
  const title = encodeURIComponent(displayName.replace(/ /g, '_'));
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail?: { source: string } };
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conn = await db();
  if (!conn) return NextResponse.json({ error: 'No DB' }, { status: 500 });

  const rows = await conn
    .select({ id: people.id, displayName: people.displayName })
    .from(people)
    .where(isNull(people.photoUrl))
    .limit(BATCH_SIZE);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: 'All photos already populated' });
  }

  // Fetch in batches of 10 to avoid overwhelming Wikipedia
  let updated = 0;
  const CONCURRENT = 10;
  for (let i = 0; i < rows.length; i += CONCURRENT) {
    const batch = rows.slice(i, i + CONCURRENT);
    await Promise.all(
      batch.map(async p => {
        const photoUrl = await fetchPhotoUrl(p.displayName);
        if (photoUrl) {
          await conn.update(people).set({ photoUrl }).where(eq(people.id, p.id));
          updated++;
        }
      }),
    );
  }

  return NextResponse.json({ ok: true, updated, checked: rows.length });
}
