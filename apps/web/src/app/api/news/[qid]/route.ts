import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { people, cacheEntries } from '@pai/db';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

interface GDELTArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
}

async function fetchLiveGDELT(displayName: string): Promise<GDELTArticle[]> {
  const params = new URLSearchParams({
    query: `"${displayName}"`,
    mode: 'artlist',
    maxrecords: '10',
    format: 'json',
    timespan: '10080', // 7 days
    sort: 'DateDesc',
  });
  const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000), // 15s — gives GDELT time even when slow
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.startsWith('{') && !text.startsWith('[')) return [];
    const data = JSON.parse(text) as { articles?: GDELTArticle[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ qid: string }> },
) {
  const { qid } = await params;

  const conn = await db();
  if (!conn) return NextResponse.json([]);

  // 1. Check per-person cache (key: news:<qid>) — written by GitHub Actions worker
  //    every 15min and by this route on successful GDELT fetch (write-through).
  const cacheRows = await conn
    .select({ data: cacheEntries.data })
    .from(cacheEntries)
    .where(eq(cacheEntries.key, `news:${qid}`))
    .limit(1);

  const cached = cacheRows[0]?.data as GDELTArticle[] | undefined;
  if (cached && cached.length > 0) {
    return NextResponse.json(cached);
  }

  // 2. Live GDELT fallback — single-name query, much less likely to get 429 than OR batches
  const personRows = await conn
    .select({ displayName: people.displayName })
    .from(people)
    .where(eq(people.wikidataQid, qid))
    .limit(1);

  const displayName = personRows[0]?.displayName;
  if (!displayName) return NextResponse.json([]);

  const articles = await fetchLiveGDELT(displayName);

  // Write-through: save to DB so next visit is instant (no GDELT call needed)
  if (articles.length > 0) {
    await conn
      .insert(cacheEntries)
      .values({ key: `news:${qid}`, data: articles, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: cacheEntries.key,
        set: { data: articles, updatedAt: new Date() },
      });
  }

  return NextResponse.json(articles);
}
