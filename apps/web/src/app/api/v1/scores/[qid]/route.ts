import { NextResponse } from 'next/server';
import { getPersonWithScores } from '../../../../../lib/api';

interface RouteParams {
  params: Promise<{ qid: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { qid } = await params;

  if (!/^Q\d+$/i.test(qid)) {
    return NextResponse.json({ error: 'Invalid QID format. Expected Q followed by digits.' }, { status: 400 });
  }

  const data = await getPersonWithScores(qid.toUpperCase());
  if (!data) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  }

  const { person, latestScore, scoreHistory } = data;

  const response = {
    qid: person.wikidataQid,
    name: person.displayName,
    occupation: person.occupationSummary ?? null,
    photoUrl: person.photoUrl ?? null,
    scores: latestScore
      ? {
          popularity: Math.round(latestScore.popularityScore * 10) / 10,
          heat: Math.round(latestScore.heatScore * 10) / 10,
          coverage: Math.round(latestScore.coverageScore),
          confidence: Math.round(latestScore.confidenceScore),
          calculatedAt: latestScore.calculatedAt,
        }
      : null,
    history: scoreHistory.slice(0, 30).map(h => ({
      date: h.calculatedAt,
      popularity: Math.round(h.popularityScore * 10) / 10,
      heat: Math.round(h.heatScore * 10) / 10,
    })),
    _meta: {
      source: 'Popularity Index (popularityindex.naveenanand.com)',
      license: 'Data sourced from Wikimedia and public APIs. Not for commercial use without permission.',
    },
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
