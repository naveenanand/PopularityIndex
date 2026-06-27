import { NextResponse } from 'next/server';
import { getDb, newsletterSubscribers } from '@pai/db';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendWelcomeEmail(email: string, unsubscribeToken: string): Promise<void> {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) return;

  const unsubscribeUrl = `https://popularityindex.naveenanand.com/api/newsletter/unsubscribe?token=${unsubscribeToken}`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'PAI <newsletter@popularityindex.naveenanand.com>',
      to: [email],
      subject: 'Welcome to the Public Attention Index',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">
          <h2 style="color:#dc2626">Public Attention Index</h2>
          <p>You're subscribed! We'll send you a weekly digest of who's trending — athletes, politicians, entertainers — and what's driving their attention spikes.</p>
          <p style="color:#71717a;font-size:13px">
            <a href="${unsubscribeUrl}" style="color:#71717a">Unsubscribe</a>
          </p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(8_000),
  });
}

export async function POST(request: Request) {
  let email: string;
  try {
    const body = await request.json() as { email?: unknown };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const conn = await getDb();
  if (!conn) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  // Check if already subscribed
  const existing = await conn
    .select({ id: newsletterSubscribers.id })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ ok: true, message: 'already_subscribed' });
  }

  const unsubscribeToken = randomBytes(32).toString('hex');

  await conn.insert(newsletterSubscribers).values({ email, unsubscribeToken });

  // Fire-and-forget welcome email — don't fail the subscription if Resend is down
  sendWelcomeEmail(email, unsubscribeToken).catch(() => undefined);

  return NextResponse.json({ ok: true, message: 'subscribed' });
}
