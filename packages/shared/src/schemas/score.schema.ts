import { z } from 'zod';

export const WikidataQidSchema = z.string().regex(/^Q\d+$/, 'Invalid Wikidata QID format');

export const TopContributorSchema = z.object({
  signal: z.string(),
  impact: z.string(),
  reason: z.string(),
  provider_type: z.enum(['live', 'mock', 'unavailable']),
});

export const ScoreExplanationSchema = z.object({
  score_model_version: z.string(),
  popularity_score: z.number().min(0).max(100),
  heat_score: z.number().min(0).max(100),
  coverage_score: z.number().min(0).max(100),
  coverage_label: z.enum(['Insufficient data', 'Partial coverage', 'High coverage']),
  top_contributors: z.array(TopContributorSchema),
  signals_available: z.array(z.string()),
  signals_missing: z.array(z.string()),
});

export type ScoreExplanation = z.infer<typeof ScoreExplanationSchema>;
