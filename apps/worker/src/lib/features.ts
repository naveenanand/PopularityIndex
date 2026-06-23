import type { ScoringFeatures } from '@pai/shared';

type SourceObs = { metricType: string; metricValue: number; provider: string };
type PageviewObs = { date: string; views: number };

export function buildScoringFeatures(
  sourceObservations: SourceObs[],
  pageviewObservations: PageviewObs[],
  mockObservations: SourceObs[],
): ScoringFeatures {
  const features: ScoringFeatures = {};

  // ── Wikipedia pageviews ──────────────────────────────────────────────────
  if (pageviewObservations.length > 0) {
    const sorted = [...pageviewObservations].sort((a, b) => b.date.localeCompare(a.date));

    const total = sorted.reduce((sum, r) => sum + r.views, 0);
    const avg30d = total / Math.min(sorted.length, 30);
    features.wikipediaPageviewAverage30d = avg30d;

    const recent7 = sorted.slice(0, 7);
    const avg7d = recent7.reduce((s, r) => s + r.views, 0) / Math.max(1, recent7.length);
    const avg90d = total / Math.max(1, sorted.length);
    features.wikipediaPageviewAverage7d = avg7d;
    features.wikipediaPageviewAverage90d = avg90d;
    // Spike ratio: 7-day avg / 90-day avg (guard divide-by-zero)
    features.wikipediaPageviewSpike7d = avg7d / Math.max(1, avg90d);
  }

  // ── Live source observations ──────────────────────────────────────────────
  for (const obs of sourceObservations) {
    switch (obs.metricType) {
      case 'wikidata_sitelinks':
        features.wikipediaSitelinks = obs.metricValue;
        break;
      case 'wikipedia_language_editions':
        features.wikipediaLanguageEditions = obs.metricValue;
        // Also use as sitelinks if not already set from Wikidata
        if (!features.wikipediaSitelinks) {
          features.wikipediaSitelinks = obs.metricValue;
        }
        break;
      case 'wikipedia_article_length':
        features.wikipediaArticleLength = obs.metricValue;
        break;
      case 'wikipedia_pageview_spike_ratio':
        if (!features.wikipediaPageviewSpike7d) {
          features.wikipediaPageviewSpike7d = obs.metricValue;
        }
        break;
    }
  }

  // ── Mock observations ────────────────────────────────────────────────────
  for (const obs of mockObservations) {
    switch (obs.metricType) {
      case 'search_interest_index':
        features.searchInterestIndex = obs.metricValue;
        break;
      case 'search_trend_velocity':
        features.searchTrendVelocity = obs.metricValue;
        break;
      case 'search_spike':
        features.searchSpike = obs.metricValue;
        break;
      case 'news_article_count_24h':
        features.newsCoverageVolume24h = obs.metricValue;
        break;
      case 'news_article_count_7d':
        features.newsCoverageVolume7d = obs.metricValue;
        break;
      case 'news_source_diversity':
        features.newsSourceDiversity = obs.metricValue;
        break;
      case 'news_velocity':
        features.newsVelocity = obs.metricValue;
        break;
      case 'social_follower_count':
        features.socialFollowerCount = obs.metricValue;
        break;
      case 'social_engagement_rate':
        features.socialEngagementRate = obs.metricValue;
        break;
      case 'conversation_volume_7d':
        features.conversationVolume7d = obs.metricValue;
        break;
      case 'conversation_velocity':
        features.conversationVelocity = obs.metricValue;
        break;
      case 'sentiment_score':
        features.sentimentScore = obs.metricValue;
        break;
      case 'sentiment_positive_share':
        features.sentimentPositiveShare = obs.metricValue;
        break;
      case 'sentiment_neutral_share':
        features.sentimentNeutralShare = obs.metricValue;
        break;
      case 'sentiment_negative_share':
        features.sentimentNegativeShare = obs.metricValue;
        break;
      case 'controversy_score':
        features.controversyScore = obs.metricValue;
        break;
      case 'sentiment_confidence':
        features.sentimentConfidence = obs.metricValue;
        break;
    }
  }

  return features;
}
