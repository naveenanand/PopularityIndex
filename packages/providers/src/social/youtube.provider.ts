import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';

const API_KEY = process.env['YOUTUBE_API_KEY'];
const YT = 'https://www.googleapis.com/youtube/v3';
const SPARQL = process.env['WIKIDATA_SPARQL_BASE'] ?? 'https://query.wikidata.org/sparql';
const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

// ─── YouTube Data API (when API_KEY is set) ──────────────────────────────────
interface SearchResponse  { items?: Array<{ id: { channelId: string } }> }
interface ChannelResponse { items?: Array<{ statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string } }> }

async function findChannelId(name: string): Promise<string | undefined> {
  const params = new URLSearchParams({ q: name, type: 'channel', part: 'snippet', maxResults: '3', key: API_KEY! });
  const res = await fetch(`${YT}/search?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return undefined;
  return ((await res.json()) as SearchResponse).items?.[0]?.id.channelId;
}

async function getChannelStats(channelId: string): Promise<{ subscribers: number; views: number; videos: number } | undefined> {
  const params = new URLSearchParams({ id: channelId, part: 'statistics', key: API_KEY! });
  const res = await fetch(`${YT}/channels?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return undefined;
  const s = ((await res.json()) as ChannelResponse).items?.[0]?.statistics;
  if (!s) return undefined;
  return {
    subscribers: parseInt(s.subscriberCount ?? '0', 10),
    views: parseInt(s.viewCount ?? '0', 10),
    videos: parseInt(s.videoCount ?? '1', 10),
  };
}

async function getYouTubeObservations(input: ProviderRequest): Promise<ProviderResult['observations']> {
  const name = input.displayName;
  if (!name) return [];
  const channelId = input.youtubeChannelId ?? await findChannelId(name);
  if (!channelId) return [];
  const stats = await getChannelStats(channelId);
  if (!stats || stats.subscribers < 10_000) return [];
  const engagementRate = stats.videos > 0
    ? Math.min(0.5, stats.views / (stats.subscribers * Math.max(1, stats.videos)) / 100)
    : 0;
  const now = new Date();
  return [
    { metricType: 'social_follower_count',  metricValue: stats.subscribers, observedAt: now, payload: { provider: 'youtube', channelId }, reliabilityScore: 0.92 },
    { metricType: 'social_engagement_rate', metricValue: engagementRate,    observedAt: now, payload: { provider: 'youtube', channelId }, reliabilityScore: 0.78 },
  ];
}

// ─── Wikidata P8687 fallback (when API_KEY is not set) ───────────────────────
// P8687 = "social media followers" — Wikidata tracks this for many public figures.
// We sum across all platforms as a proxy for total social reach (no API key needed).
interface SparqlResult { results: { bindings: Array<{ followers?: { value: string } }> } }

async function getWikidataFollowers(qid: string): Promise<number> {
  if (!qid) return 0;
  const query = `SELECT ?followers WHERE { wd:${qid} p:P8687 ?s . ?s ps:P8687 ?followers . }`;
  const url = `${SPARQL}?query=${encodeURIComponent(query)}&format=json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as SparqlResult;
    const counts = data.results.bindings
      .map(b => parseInt(b.followers?.value ?? '0', 10))
      .filter(n => !isNaN(n) && n > 0);
    // Use the largest single-platform count (avoids double-counting cross-platform totals)
    return counts.length > 0 ? Math.max(...counts) : 0;
  } catch {
    return 0;
  }
}

async function getWikidataObservations(input: ProviderRequest): Promise<ProviderResult['observations']> {
  const followers = await getWikidataFollowers(input.wikidataQid);
  if (followers < 1_000) return [];
  const now = new Date();
  return [
    { metricType: 'social_follower_count',  metricValue: followers, observedAt: now, payload: { provider: 'wikidata_p8687', qid: input.wikidataQid }, reliabilityScore: 0.65 },
    { metricType: 'social_engagement_rate', metricValue: 0,         observedAt: now, payload: { provider: 'wikidata_p8687', note: 'engagement unavailable without YouTube key' }, reliabilityScore: 0 },
  ];
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export class YouTubeSocialProvider implements AttentionProvider {
  readonly providerName = 'youtube_social';
  // live via YouTube API when key is present, falls back to Wikidata P8687 without key
  readonly providerType = 'live' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    const name = input.displayName;
    if (!name) {
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'NO_NAME', message: 'displayName required', retryable: false }], fetchedAt: now };
    }

    try {
      const observations = API_KEY
        ? await getYouTubeObservations(input)
        : await getWikidataObservations(input);

      return { providerName: this.providerName, providerType: this.providerType, success: true, observations, errors: [], fetchedAt: now };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'YOUTUBE_ERROR', message, retryable: true }], fetchedAt: now };
    }
  }
}
