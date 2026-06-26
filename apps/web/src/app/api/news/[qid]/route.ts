import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { people, cacheEntries } from '@pai/db';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

interface NewsArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
}

function parseGoogleNewsRSS(xml: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const match of blocks.slice(0, 10)) {
    const content = match[1];
    if (!content) continue;
    const rawTitle =
      content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
      content.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const decoded = rawTitle
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&apos;/g, "'").trim();
    const dashIdx = decoded.lastIndexOf(' - ');
    const title  = dashIdx > 0 ? decoded.slice(0, dashIdx).trim() : decoded;
    const domain = dashIdx > 0 ? decoded.slice(dashIdx + 3).trim() : '';
    const url =
      content.match(/<link>(https?:\/\/[^\s<]+)<\/link>/)?.[1] ??
      content.match(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/)?.[1] ?? '';
    const pubRaw = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? '';
    const seendate = pubRaw
      ? new Date(pubRaw).toISOString().slice(0, 19).replace(/\D/g, '') + '00000'
      : '';
    if (title && url) items.push({ title, url, domain, seendate });
  }
  return items;
}

async function fetchGoogleNewsRSS(displayName: string): Promise<NewsArticle[]> {
  const q = encodeURIComponent(`"${displayName}"`);
  const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';
  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return parseGoogleNewsRSS(await res.text());
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

  // 1. Check per-person cache (written by this route and the GitHub Actions worker)
  const cacheRows = await conn
    .select({ data: cacheEntries.data })
    .from(cacheEntries)
    .where(eq(cacheEntries.key, `news:${qid}`))
    .limit(1);

  const cached = cacheRows[0]?.data as NewsArticle[] | undefined;
  if (cached && cached.length > 0) return NextResponse.json(cached);

  // 2. Fetch from Google News RSS — no IP blocks, no rate limits
  const personRows = await conn
    .select({ displayName: people.displayName })
    .from(people)
    .where(eq(people.wikidataQid, qid))
    .limit(1);

  const displayName = personRows[0]?.displayName;
  if (!displayName) return NextResponse.json([]);

  const articles = await fetchGoogleNewsRSS(displayName);

  // Write-through: cache result so next visit is instant
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
