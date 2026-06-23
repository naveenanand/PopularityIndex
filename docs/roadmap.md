# Roadmap

## MVP (Current)

- [x] Person registry with ~150 Wikidata QIDs
- [x] Wikipedia pageview ingestion (live)
- [x] Wikidata metadata ingestion (live)
- [x] Score engine (Popularity + Heat + Sentiment + Coverage)
- [x] Mock providers for search, news, social, sentiment
- [x] Web dashboard: leaderboard, person pages, search, methodology
- [x] Score explanations ("why this score changed")
- [x] Score history chart
- [x] Clear labeling of live vs mock data

## Phase 2: Real Signal Coverage

- [ ] Search interest: integrate approved Google Trends API or partner data
- [ ] News coverage: integrate licensed news data (GDELT, NewsAPI Pro)
- [ ] Social reach: integrate X/Twitter API v2, YouTube Data API
- [ ] Sentiment: integrate NLP service with real social/news text

## Phase 3: Scale

- [ ] Expand registry to 10,000+ people
- [ ] Automated daily ingestion via cron jobs
- [ ] Multi-language Wikipedia pageview aggregation
- [ ] PostgreSQL full-text search with `pg_trgm` extension
- [ ] Score spike alerting (webhook or email)
- [ ] Admin panel for registry management

## Phase 4: Advanced Features

- [ ] Trend forecasting (score velocity indicators)
- [ ] Comparative profiles ("trending faster than 95% of peers")
- [ ] Category-level leaderboards (sports, politics, entertainment)
- [ ] API for external consumers
- [ ] Bias-corrected normalization
- [ ] Multi-language support in UI
