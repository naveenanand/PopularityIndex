import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { people, cacheEntries, scoreSnapshots } from '@pai/db';
import { db } from '../../../../lib/db';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface NewsArticle { title: string; domain: string }

function buildTemplateSummary(
  name: string,
  occupation: string,
  popularity: number,
  heat: number,
  headlines: string[],
): string {
  const level = popularity >= 80 ? 'one of the most-watched' : popularity >= 60 ? 'a highly followed' : 'a notable';
  const trend = heat >= 70 ? 'is currently trending strongly' : heat >= 40 ? 'is seeing elevated attention' : 'maintains a consistent public presence';
  const firstHeadline = headlines[0];
  const headlinePart = firstHeadline
    ? ` Recent coverage includes ${firstHeadline.replace(/\s*[-–]\s*\S+$/, '').trim().toLowerCase()}.`
    : '';
  const occ = occupation ? ` ${occupation}` : '';
  return `${name} is ${level}${occ} with a popularity score of ${Math.round(popularity)}, and ${trend} with a heat score of ${Math.round(heat)}.${headlinePart}`;
}

async function generateWithClaude(
  name: string,
  occupation: string,
  popularity: number,
  heat: number,
  headlines: string[],
): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return buildTemplateSummary(name, occupation, popularity, heat, headlines);

  const headlineLines = headlines.length > 0
    ? headlines.slice(0, 5).map((h, i) => `${i + 1}. ${h}`).join('\n')
    : '(no recent headlines available)';

  const prompt = `You are writing a brief summary for a public attention tracking dashboard.

Person: ${name}
${occupation ? `Role: ${occupation}` : ''}
Popularity Score: ${Math.round(popularity)}/100 (overall public mindshare)
Heat Score: ${Math.round(heat)}/100 (current trending momentum)
Recent headlines:
${headlineLines}

Write exactly 2–3 sentences in present tense summarizing what is happening with this person right now and why they are in the public eye. Be factual and journalistic. Start directly with their name. Do not mention the scoring system.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 160,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = msg.content[0];
    if (block?.type === 'text' && block.text.trim()) return block.text.trim();
  } catch {
    // fall through to template
  }

  return buildTemplateSummary(name, occupation, popularity, heat, headlines);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ qid: string }> },
) {
  const { qid } = await params;
  const conn = await db();
  if (!conn) return NextResponse.json({ text: '' });

  // Check 24h cache first
  const cacheRow = await conn
    .select({ data: cacheEntries.data, updatedAt: cacheEntries.updatedAt })
    .from(cacheEntries)
    .where(eq(cacheEntries.key, `summary:${qid}`))
    .limit(1);

  if (cacheRow[0]) {
    const age = Date.now() - new Date(cacheRow[0].updatedAt).getTime();
    if (age < CACHE_TTL_MS) return NextResponse.json(cacheRow[0].data);
  }

  // Load person
  const personRow = await conn
    .select({ id: people.id, displayName: people.displayName, occupationSummary: people.occupationSummary })
    .from(people)
    .where(eq(people.wikidataQid, qid))
    .limit(1);

  const person = personRow[0];
  if (!person) return NextResponse.json({ text: '' });

  // Load latest score
  const scoreRow = await conn
    .select({ popularityScore: scoreSnapshots.popularityScore, heatScore: scoreSnapshots.heatScore })
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.personId, person.id))
    .orderBy(desc(scoreSnapshots.calculatedAt))
    .limit(1);

  // Load cached news headlines
  const newsRow = await conn
    .select({ data: cacheEntries.data })
    .from(cacheEntries)
    .where(eq(cacheEntries.key, `news:${qid}`))
    .limit(1);

  const news = (newsRow[0]?.data ?? []) as NewsArticle[];
  const headlines = news.slice(0, 5).map(a => a.title);
  const popularity = scoreRow[0]?.popularityScore ?? 50;
  const heat = scoreRow[0]?.heatScore ?? 30;
  const occupation = (person.occupationSummary ?? '').replace(/_/g, ' ');

  const text = await generateWithClaude(person.displayName, occupation, popularity, heat, headlines);
  const result = { text, generatedAt: new Date().toISOString() };

  await conn
    .insert(cacheEntries)
    .values({ key: `summary:${qid}`, data: result, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: result, updatedAt: new Date() },
    });

  return NextResponse.json(result);
}
