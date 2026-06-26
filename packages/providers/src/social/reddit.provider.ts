import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';

const CLIENT_ID = process.env['REDDIT_CLIENT_ID'];
const CLIENT_SECRET = process.env['REDDIT_CLIENT_SECRET'];
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

// ─── OAuth path (used when credentials are configured) ───────────────────────
interface RedditTokenResponse { access_token: string; expires_in: number }

let _token: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (_token && _token.expiresAt > Date.now()) return _token.value;
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Reddit auth ${res.status}`);
  const data = (await res.json()) as RedditTokenResponse;
  _token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return _token.value;
}

async function countOAuth(name: string, timeframe: 'week' | 'month', token: string): Promise<number> {
  const params = new URLSearchParams({ q: `"${name}"`, sort: 'new', t: timeframe, type: 'link', limit: '100' });
  const res = await fetch(`https://oauth.reddit.com/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as { data: { dist: number } };
  return data.data.dist;
}

// ─── Public API path (no credentials needed) ─────────────────────────────────
// Reddit's public search endpoint works without auth at up to 600 req/10 min
// with a valid User-Agent. Returns dist = number of results on current page
// (max 100) — enough to compare relative mention volume across people.
async function countPublic(name: string, timeframe: 'week' | 'month'): Promise<number> {
  const params = new URLSearchParams({ q: `"${name}"`, sort: 'new', t: timeframe, limit: '100', type: 'link' });
  const res = await fetch(`https://www.reddit.com/search.json?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as { data: { dist: number } };
  return data.data.dist;
}

async function countMentions(name: string, timeframe: 'week' | 'month'): Promise<number> {
  if (CLIENT_ID && CLIENT_SECRET) {
    const token = await getToken();
    return countOAuth(name, timeframe, token);
  }
  return countPublic(name, timeframe);
}

export class RedditConversationProvider implements AttentionProvider {
  readonly providerName = 'reddit_conversation';
  // live via public API even without OAuth credentials
  readonly providerType = 'live' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    const name = input.displayName;
    if (!name) {
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'NO_NAME', message: 'displayName required', retryable: false }], fetchedAt: now };
    }

    try {
      const [weekCount, monthCount] = await Promise.all([
        countMentions(name, 'week'),
        countMentions(name, 'month'),
      ]);
      const weekRate  = weekCount / 7;
      const monthRate = (monthCount - weekCount) / 23;
      const velocity  = monthRate > 0 ? weekRate / monthRate : 1.0;

      return {
        providerName: this.providerName, providerType: this.providerType, success: true,
        observations: [
          { metricType: 'conversation_volume_7d', metricValue: weekCount,  observedAt: now, payload: { provider: 'reddit', query: name, auth: CLIENT_ID ? 'oauth' : 'public' }, reliabilityScore: 0.8 },
          { metricType: 'conversation_velocity',  metricValue: velocity,   observedAt: now, payload: { provider: 'reddit' }, reliabilityScore: 0.75 },
        ],
        errors: [], fetchedAt: now,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'REDDIT_ERROR', message, retryable: true }], fetchedAt: now };
    }
  }
}
