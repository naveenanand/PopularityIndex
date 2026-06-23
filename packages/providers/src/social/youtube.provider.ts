import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';

const API_KEY = process.env['YOUTUBE_API_KEY'];
const YT = 'https://www.googleapis.com/youtube/v3';

interface SearchResponse { items?: Array<{ id: { channelId: string } }> }
interface ChannelResponse { items?: Array<{ statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string } }> }

async function findChannelId(name: string): Promise<string | undefined> {
  const params = new URLSearchParams({ q: name, type: 'channel', part: 'snippet', maxResults: '3', key: API_KEY! });
  const res = await fetch(`${YT}/search?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return undefined;
  const data = (await res.json()) as SearchResponse;
  return data.items?.[0]?.id.channelId;
}

async function getChannelStats(channelId: string): Promise<{ subscribers: number; views: number; videos: number } | undefined> {
  const params = new URLSearchParams({ id: channelId, part: 'statistics', key: API_KEY! });
  const res = await fetch(`${YT}/channels?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return undefined;
  const data = (await res.json()) as ChannelResponse;
  const s = data.items?.[0]?.statistics;
  if (!s) return undefined;
  return {
    subscribers: parseInt(s.subscriberCount ?? '0', 10),
    views: parseInt(s.viewCount ?? '0', 10),
    videos: parseInt(s.videoCount ?? '1', 10),
  };
}

export class YouTubeSocialProvider implements AttentionProvider {
  readonly providerName = 'youtube_social';
  readonly providerType = (API_KEY ? 'live' : 'unavailable') as 'live' | 'unavailable';

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    if (!API_KEY) {
      return { providerName: this.providerName, providerType: 'unavailable', success: false, observations: [], errors: [{ code: 'NO_API_KEY', message: 'YOUTUBE_API_KEY not set', retryable: false }], fetchedAt: now };
    }
    const name = input.displayName;
    if (!name) {
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'NO_NAME', message: 'displayName required', retryable: false }], fetchedAt: now };
    }

    try {
      // Prefer Wikidata-supplied channel ID (saves 100 quota units per person)
      const channelId = input.youtubeChannelId ?? await findChannelId(name);
      if (!channelId) {
        return { providerName: this.providerName, providerType: this.providerType, success: true, observations: [], errors: [], fetchedAt: now };
      }

      const stats = await getChannelStats(channelId);
      if (!stats || stats.subscribers < 10_000) {
        return { providerName: this.providerName, providerType: this.providerType, success: true, observations: [], errors: [], fetchedAt: now };
      }

      const engagementRate = stats.videos > 0
        ? Math.min(0.5, stats.views / (stats.subscribers * Math.max(1, stats.videos)) / 100)
        : 0;

      return {
        providerName: this.providerName, providerType: this.providerType, success: true,
        observations: [
          { metricType: 'social_follower_count', metricValue: stats.subscribers, observedAt: now, payload: { provider: 'youtube', channelId }, reliabilityScore: 0.92 },
          { metricType: 'social_engagement_rate', metricValue: engagementRate, observedAt: now, payload: { provider: 'youtube', channelId }, reliabilityScore: 0.78 },
        ],
        errors: [], fetchedAt: now,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'YOUTUBE_ERROR', message, retryable: true }], fetchedAt: now };
    }
  }
}
