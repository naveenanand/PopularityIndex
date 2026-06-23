# Database Schema

## Tables

### people

Canonical person registry. One row per person, identified by Wikidata QID.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | Internal ID |
| wikidata_qid | varchar(20) UNIQUE NOT NULL | Primary external identifier, e.g. `Q26876` |
| display_name | text NOT NULL | Human-readable name |
| normalized_name | text NOT NULL | Lowercase, accent-stripped, for search |
| date_of_birth | text | ISO 8601 date string, nullable |
| occupation_summary | text | Short description from Wikidata, nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### person_aliases

Alternative names for search purposes.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| person_id | integer FK → people.id | |
| alias | text NOT NULL | |
| alias_type | varchar(50) | `wikidata_label`, `wikidata_alias`, `common_name` |
| created_at | timestamptz | |

### wikipedia_pages

Wikipedia article references per person per language.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| person_id | integer FK → people.id | |
| language_code | varchar(10) | e.g. `en`, `es`, `fr` |
| page_title | text | e.g. `Taylor_Swift` |
| page_id | integer | MediaWiki page ID, nullable |
| is_primary | boolean | true for the English article |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### social_accounts

Social media accounts linked to a person.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| person_id | integer FK → people.id | |
| platform | varchar(50) | `x`, `instagram`, `youtube`, `tiktok` |
| handle | text | Username / handle |
| platform_account_id | text | Platform's internal user ID |
| verified | boolean | Platform-verified account |
| match_confidence | real | 0.0–1.0 |
| match_method | varchar(100) | How the match was determined |
| source_url | text | URL of the profile |
| status | varchar(20) | `active`, `inactive`, `deleted` |

### source_observations

Generic observation store for any metric from any provider.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| person_id | integer FK → people.id | |
| provider | varchar(100) | Provider name, e.g. `wikipedia_pageviews` |
| metric_type | varchar(100) | e.g. `wikipedia_pageview_average` |
| metric_value | real | Numeric value |
| observed_at | timestamptz | When the data was captured |
| payload_json | jsonb | Raw provider response |
| reliability_score | real | 0.0–1.0 |

### pageview_observations

Daily Wikipedia pageview data. Unique per person per date per language.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| person_id | integer FK → people.id | |
| wikipedia_page_id | integer FK → wikipedia_pages.id | nullable |
| date | date | UTC date of the views |
| views | integer | View count for that day |
| language_code | varchar(10) | |
| observed_at | timestamptz | When fetched |

Unique constraint: `(person_id, date, language_code)`

### score_snapshots

Computed scores for a person at a point in time.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| person_id | integer FK → people.id | |
| calculated_at | timestamptz | When the score was computed |
| score_model_version | varchar(20) | e.g. `v1` |
| popularity_score | real | 0–100 |
| heat_score | real | 0–100 |
| sentiment_score | real | −100 to +100, nullable |
| controversy_score | real | 0–100, nullable |
| coverage_score | real | 0–100 |
| confidence_score | real | 0–100 |
| explanation_json | jsonb | Full explanation payload |

### job_runs

Tracks ingestion and scoring job executions.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| job_type | varchar(100) | e.g. `wikipedia_ingest`, `score_calculate` |
| started_at | timestamptz | |
| completed_at | timestamptz | nullable |
| status | varchar(20) | `running`, `completed`, `failed` |
| records_processed | integer | |
| error_message | text | nullable |
| metadata_json | jsonb | Additional context |

### Other tables

- `news_mention_clusters` — news coverage groupings per person
- `search_interest_observations` — search volume data per person
- `social_metric_observations` — social metrics (followers, engagement)
- `sentiment_observations` — sentiment analysis results
- `feature_snapshots` — raw feature vectors used for scoring
- `source_providers` — registry of configured data providers
- `entity_match_reviews` — pending social account match decisions
