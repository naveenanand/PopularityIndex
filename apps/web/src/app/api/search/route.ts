import { NextResponse } from 'next/server';
import { searchPeople } from '../../../lib/api';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchPeople(q);
  return NextResponse.json(
    results.slice(0, 10).map(r => ({
      wikidataQid: r.wikidataQid,
      displayName: r.displayName,
      occupationSummary: r.occupationSummary,
      photoUrl: r.photoUrl ?? null,
    })),
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
