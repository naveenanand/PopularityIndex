export interface ProviderRequest {
  personId: number;
  wikidataQid: string;
  wikipediaPageTitle?: string;
  wikipediaPageId?: number;
  languageCode?: string;
  dateRange?: { from: Date; to: Date };
}

export interface RawObservation {
  metricType: string;
  metricValue: number;
  observedAt: Date;
  payload?: Record<string, unknown>;
  reliabilityScore?: number;
}

export interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ProviderResult {
  providerName: string;
  providerType: 'live' | 'mock' | 'unavailable';
  success: boolean;
  observations: RawObservation[];
  errors: ProviderError[];
  fetchedAt: Date;
}

export interface AttentionProvider {
  providerName: string;
  providerType: 'live' | 'mock' | 'unavailable';
  getObservations(input: ProviderRequest): Promise<ProviderResult>;
}
