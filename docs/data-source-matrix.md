# Data Source Matrix

## Live Sources (MVP)

| Source | Provider | API / Endpoint | Rate Limit | Auth Required | Status |
|---|---|---|---|---|---|
| Wikidata metadata | WikidataProvider | SPARQL: `query.wikidata.org/sparql` | ~5 req/s | No (User-Agent required) | Live |
| Wikipedia pageviews | WikipediaPageviewsProvider | `wikimedia.org/api/rest_v1/metrics/pageviews/per-article/...` | 200 req/s | No (User-Agent required) | Live |
| Wikipedia metadata | WikipediaMetadataProvider | `en.wikipedia.org/w/api.php?action=query&prop=info|langlinks` | 200 req/s | No | Live |

## Mock Sources (MVP — clearly labeled in UI)

| Source | Provider | Status | Notes |
|---|---|---|---|
| Search interest | MockSearchInterestProvider | Mock | Requires Google Trends commercial license or approved partner API |
| News coverage | MockNewsCoverageProvider | Mock | Requires licensed news data (e.g., GDELT, NewsAPI Pro, Aylien) |
| Social reach | MockSocialReachProvider | Mock | Requires official X, Instagram, YouTube, TikTok API access |
| Social conversation | MockConversationProvider | Mock | Requires official social API access |
| Sentiment | MockSentimentProvider | Mock | Requires NLP service + source data |

## Wikimedia API Details

### Wikidata SPARQL

Endpoint: `https://query.wikidata.org/sparql`

Required headers:
- `User-Agent: AppName/Version (contact@email.com)` — **required by Wikimedia policy**
- `Accept: application/sparql-results+json`

Batch strategy: Use `VALUES ?person { wd:Q123 wd:Q456 ... }` to query 50 QIDs per request.

Rate limiting: ~5 req/s soft limit. Use `p-limit(3)` + retry on 429.

### Wikimedia Pageviews REST API

Endpoint: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{project}/{access}/{agent}/{article}/{granularity}/{start}/{end}`

Example:
```
GET https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Taylor_Swift/daily/20240101/20240131
```

Notes:
- Article titles: spaces → underscores, URL-encode special chars
- 404 = no views in period (not an error)
- Date format: `YYYYMMDD` (no separators)
- Fetch last 90 days to support both baseline and spike detection

### MediaWiki Action API

Endpoint: `https://en.wikipedia.org/w/api.php`

Fetches:
- `prop=info` — page length, last edit
- `prop=langlinks` — language editions count
- `prop=extlinks` — external references count

## Future Provider Roadmap

| Signal | Candidate Provider | Consideration |
|---|---|---|
| Search interest | Google Trends | Commercial API or authorized partner required |
| Search interest | Bing News Search API | Microsoft Azure subscription |
| News coverage | GDELT Project | Public dataset, requires parsing |
| News coverage | NewsAPI Pro | Commercial license |
| Social reach | X (Twitter) Basic API | OAuth 2.0, rate limits |
| Social reach | YouTube Data API v3 | Google API key, quota limits |
| Social conversation | Reddit API | OAuth 2.0, terms of service review |
| Sentiment | Google Natural Language API | Commercial; requires source text |
