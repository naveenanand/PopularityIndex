# Risk and Compliance

## Data Licensing

| Source | License | Commercial Use | Notes |
|---|---|---|---|
| Wikidata | CC0 (public domain) | Yes | No restrictions |
| Wikipedia content | CC BY-SA 4.0 | Yes (with attribution) | PAI uses pageview counts, not article content |
| Wikimedia pageview API | Free, public | Yes | No key required; User-Agent required |

PAI does not reproduce Wikipedia article text. It uses only quantitative signals (view counts, language edition counts) which are statistical observations, not creative content.

## Privacy

PAI covers only people with existing Wikipedia biographies — individuals who are public figures and have been subject to public scrutiny in multiple reliable, independent sources. This is a standard journalistic and academic criterion for public figure status.

PAI does not:
- Cover private individuals
- Process personal data beyond what is already in the public record
- Store social media content
- Track users of the web application

## Bias and Fairness

PAI scores reflect the public attention that existing media systems, platforms, and audiences have chosen to direct at individuals. These systems themselves contain biases:

- **Gender bias**: Male public figures may receive more media coverage for equivalent achievements
- **English-language bias**: Wikipedia pageviews default to English; internationally prominent people writing in other scripts may be underscored
- **Western media bias**: News coverage data may over-represent people prominent in English-language media markets
- **Recency bias**: Recent attention may dominate heat scores even for people with long, sustained careers

These biases are not corrected in v1. Future versions should consider bias-corrected normalization or multi-language aggregation.

## Name Ambiguity

Many public figures share names. PAI uses Wikidata QIDs to unambiguously identify people. However:
- Search results may surface multiple people with the same name
- Display names in the UI may be identical for different people
- The Wikidata QID is always shown to disambiguate

Never make automated decisions (e.g., social account matching) based on name alone.

## Data Accuracy Disclaimer

PAI scores are quantitative indicators based on the availability and reliability of public data sources. They are:

- Derived from third-party sources PAI does not control
- Potentially out of date (ingestion runs are periodic, not real-time)
- Subject to gaps when sources are unavailable
- Based on approximations (e.g., log-scale normalization)

PAI scores should not be used as the sole basis for editorial, employment, commercial, or legal decisions.

## Terms of Service Compliance

| Service | ToS Consideration | PAI Approach |
|---|---|---|
| Wikimedia APIs | Requires User-Agent header; prohibits excessive load | User-Agent set via env var; `p-limit(3)` concurrency; exponential backoff on 429 |
| Future social APIs | All major platforms prohibit scraping | PAI uses only official APIs; scraping is explicitly prohibited in provider interface |

## What PAI Must Never Do

- Scrape websites in violation of ToS
- Use unofficial or reverse-engineered APIs
- Store or display personal data beyond what is in the public record
- Claim that mock data is live data
- Assign scores to private individuals
- Assign scores based on unverified social account matches
