import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';

const CLIENT_ID = process.env['REDDIT_CLIENT_ID'];
const CLIENT_SECRET = process.env['REDDIT_CLIENT_SECRET'];
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

interface RedditTokenResponse { access_token: string; expires_in: number }
interface RedditSearchResponse { data: { dist: number } }

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

async function countMentions(name: string, timeframe: 'week' | 'month', token: string): Promise<number> {
  const params = new URLSearchParams({ q: `"${name}"`, sort: 'new', t: timeframe, type: 'link', limit: '1' });
  const res = await fetch(`https://oauth.reddit.com/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as RedditSearchResponse;
  return data.data.dist;
}

export class RedditConversationProvider implements AttentionProvider {
  readonly providerName = 'reddit_conversation';
  readonly providerType = (CLIENT_ID ? 'live' : 'unavailable') as 'live' | 'unavailable';

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return { providerName: this.providerName, providerType: 'unavailable', success: false, observations: [], errors: [{ code: 'NO_CREDENTIALS', message: 'REDDIT_CLIENT_ID/SECRET not set', retryable: false }], fetchedAt: now };
    }
    const name = input.displayName;
    if (!name) {
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'NO_NAME', message: 'displayName required', retryable: false }], fetchedAt: now };
    }

    try {
      const token = await getToken();
      const [weekCount, monthCount] = await Promise.all([
        countMentions(name, 'week', token),
        countMentions(name, 'month', token),
      ]);
      const weekRate = weekCount / 7;
      const monthRate = (monthCount - weekCount) / 23;
      const velocity = monthRate > 0 ? weekRate / monthRate : 1.0;

      return {
        providerName: this.providerName, providerType: this.providerType, success: true,
        observations: [
          { metricType: 'conversation_volume_7d', metricValue: weekCount, observedAt: now, payload: { provider: 'reddit', query: name }, reliabilityScore: 0.8 },
          { metricType: 'conversation_velocity', metricValue: velocity, observedAt: now, payload: { provider: 'reddit' }, reliabilityScore: 0.75 },
        ],
        errors: [], fetchedAt: now,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'REDDIT_ERROR', message, retryable: true }], fetchedAt: now };
    }
  }
}
