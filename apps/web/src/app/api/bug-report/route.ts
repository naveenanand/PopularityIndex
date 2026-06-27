import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GITHUB_REPO = 'naveenanand/PopularityIndex';
const LABELS = ['bug', 'user-report'];

export async function POST(request: Request) {
  let title: string, description: string, pageUrl: string;
  try {
    const body = await request.json() as { title?: unknown; description?: unknown; pageUrl?: unknown };
    title = typeof body.title === 'string' ? body.title.trim() : '';
    description = typeof body.description === 'string' ? body.description.trim() : '';
    pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!title || title.length < 5) {
    return NextResponse.json({ error: 'Title too short' }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'Title too long' }, { status: 400 });
  }

  const token = process.env['GITHUB_ISSUE_TOKEN'];
  if (!token) {
    return NextResponse.json({ error: 'Bug reporting not configured' }, { status: 503 });
  }

  const body = [
    description ? `### Description\n${description}` : null,
    pageUrl ? `### Page\n${pageUrl}` : null,
    `### Reported via\nIn-app bug report form`,
  ].filter(Boolean).join('\n\n');

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: `[User Report] ${title}`, body, labels: LABELS }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('GitHub issue creation failed:', res.status, err);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 502 });
  }

  const issue = await res.json() as { number: number; html_url: string };
  return NextResponse.json({ ok: true, issueNumber: issue.number, issueUrl: issue.html_url });
}
