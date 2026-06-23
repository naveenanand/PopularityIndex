# Scoring Methodology

## Model Version: v1

All scores in PAI are versioned. When the model changes in a way that would alter scores for the same underlying data, the version is incremented. Old snapshots are preserved.

## Popularity Score (0–100)

Measures sustained public visibility across multiple independent signal categories.

| Component | Nominal Weight | Signal Source |
|---|---|---|
| Search Interest & Velocity | 15% | Search interest index + velocity |
| Wikipedia Attention | 15% | Pageview 30-day average |
| Quality Media Coverage | 25% | News article clusters, source diversity |
| Social Reach | 15% | Follower/subscriber counts (log-scaled) |
| Conversation & Engagement | 15% | Mentions, replies, reposts |
| Enduring Prominence | 15% | Wikipedia sitelinks (language editions) |

### Missing Data Re-normalization

**PAI never reduces a score because data is missing.** If a signal is unavailable, its weight is excluded from both the numerator and denominator:

```
available_score = Σ(component_score_i × weight_i) / Σ(weight_i for available components)
```

Example: If search interest (15%) and social reach (15%) are missing, the remaining 70% is re-weighted to 100%. A component with a nominal 25% weight becomes an effective 35.7% weight.

The Coverage Score communicates how complete the data is, separately from the score itself.

## Heat Score (0–100)

Measures recent acceleration in attention relative to each person's own historical baseline. Heat can rise and fall quickly.

| Component | Weight | Signal |
|---|---|---|
| Search-interest spike | 30% | Recent search volume vs 90-day baseline |
| Wikipedia pageview spike | 25% | 7-day avg vs 90-day avg (spike ratio) |
| Media coverage velocity | 25% | Recent article count vs baseline |
| Social discussion velocity | 20% | Recent conversation volume vs baseline |

**Spike ratio scoring:** `score = log10(ratio) / log10(50) × 100`, where ratio = recent / baseline. A 2× spike scores ~30, a 10× spike scores ~70, a 50× spike scores 100.

**Baseline guard:** `max(1, baseline_views)` prevents divide-by-zero for new or low-traffic people.

## Sentiment (stored separately, not in Popularity or Heat)

Measures the tone of public discussion. Displayed as a separate section in the UI.

| Field | Range | Meaning |
|---|---|---|
| sentiment_score | −100 to +100 | Overall sentiment tone |
| positive_share | 0–1 | Fraction of positive discussion |
| neutral_share | 0–1 | Fraction of neutral discussion |
| negative_share | 0–1 | Fraction of negative discussion |
| controversy_score | 0–100 | How divided the discussion is |
| sentiment_confidence | 0–100 | How reliable this measurement is |

**Why sentiment is separate:** Controversy and criticism drive public attention. A person trending because of scandal would receive a low Popularity Score if we mixed sentiment in — the opposite of what the score is meant to measure.

## Normalization Techniques

| Technique | Applied To |
|---|---|
| `log10(count)` | Pageviews, follower counts, article counts |
| Percentile normalization | Spike ratios |
| Time decay | Older observations weighted less than recent |
| Source reliability weights | Live data weighted higher than mock data |
| Outlier caps | `min(100, score)` applied at every component |

## Coverage Score (0–100)

```
coverage_score = (available_signal_count / total_signal_count) × 100
```

| Coverage | Label |
|---|---|
| < 40% | Insufficient data |
| 40–69% | Partial coverage |
| ≥ 70% | High coverage |

## Confidence Score (0–100)

Distinct from coverage. Coverage measures which signals are present; confidence measures how reliable those signals are. In v1:

```
confidence_score = coverage_score × live_signal_ratio
```

Where `live_signal_ratio` is the fraction of available signals coming from live (not mock) sources.

## Limitations

- **Mock data in MVP**: Search, news, social, and sentiment signals are mock data in the MVP. Scores will improve substantially when real providers are configured.
- **Wikipedia bias**: In the MVP, Wikipedia signals are the only live data. People with very low Wikipedia traffic will have low scores regardless of their real-world prominence.
- **English-language bias**: Pageview data defaults to the English Wikipedia. Internationally prominent people may be underscored.
- **Recency bias in heat**: The heat score is sensitive to recent spikes and may overreact to one-time events.
- **Not a ranking of importance**: PAI scores public attention, not importance, influence, or value.
