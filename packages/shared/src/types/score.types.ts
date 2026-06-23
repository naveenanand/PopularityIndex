export interface ScoringFeatures {
  // Wikipedia signals (live)
  wikipediaPageviewAverage30d?: number;
  wikipediaPageviewAverage7d?: number;
  wikipediaPageviewAverage90d?: number;
  wikipediaPageviewSpike7d?: number;
  wikipediaSitelinks?: number;
  wikipediaLanguageEditions?: number;
  wikipediaArticleLength?: number;

  // Search interest (mock/future)
  searchInterestIndex?: number;
  searchTrendVelocity?: number;
  searchSpike?: number;

  // News coverage (mock/future)
  newsCoverageVolume7d?: number;
  newsSourceDiversity?: number;
  newsVelocity?: number;

  // Social reach (mock/future)
  socialFollowerCount?: number;
  socialEngagementRate?: number;

  // Conversation (mock/future)
  conversationVolume7d?: number;
  conversationVelocity?: number;

  // Sentiment (mock/future — never used in popularity/heat)
  sentimentScore?: number;
  sentimentPositiveShare?: number;
  sentimentNeutralShare?: number;
  sentimentNegativeShare?: number;
  controversyScore?: number;
  sentimentConfidence?: number;
}

export interface ScoreSnapshot {
  id: number;
  personId: number;
  calculatedAt: Date;
  scoreModelVersion: string;
  popularityScore: number;
  heatScore: number;
  sentimentScore: number | null;
  controversyScore: number | null;
  coverageScore: number;
  confidenceScore: number;
  explanationJson: ScoreExplanation;
}

export interface ScoreExplanation {
  score_model_version: string;
  popularity_score: number;
  heat_score: number;
  coverage_score: number;
  coverage_label: 'Insufficient data' | 'Partial coverage' | 'High coverage';
  top_contributors: TopContributor[];
  signals_available: string[];
  signals_missing: string[];
}

export interface TopContributor {
  signal: string;
  impact: string;
  reason: string;
  provider_type: 'live' | 'mock' | 'unavailable';
}
