# Entity Resolution Rules

## Purpose

PAI uses Wikidata QIDs as the canonical identifier for every person. Entity resolution is the process of reliably connecting external signals (e.g., a Wikipedia article, a social account, a news mention) to the correct canonical person in our database.

## Rules

### Rule 1: Wikidata QID is the canonical key

Every person in the `people` table has exactly one `wikidata_qid`. This QID is stable, unambiguous, and globally unique. It never changes even if the person's name, Wikipedia article title, or external accounts change.

### Rule 2: Never use names as primary identifiers

Names are ambiguous. "John Smith" may refer to thousands of people. Even "Taylor Swift" could theoretically be shared. Names are stored in `person_aliases` for search, but are never used to link external signals to a person.

### Rule 3: Wikipedia articles are linked by page title and language code

A Wikipedia article `(language_code, page_title)` uniquely identifies an article. Multiple articles across different language wikis can be linked to the same person (stored in `wikipedia_pages` with `is_primary` flagging the English article).

### Rule 4: Social accounts require manual or high-confidence automated matching

A social account is only attached to a person when:
- The Wikidata item for the person contains a verified social account identifier (P2002 for X/Twitter, P2003 for Instagram, etc.) — this is the preferred approach
- OR a human reviewer has approved the match via `entity_match_reviews`

**Never automatically attach a social account to a person based solely on name similarity.**

### Rule 5: Store match confidence and match method

Every `social_accounts` row includes:
- `match_confidence` (0.0–1.0): How confident we are this account belongs to this person
- `match_method`: How the match was determined (e.g., `wikidata_property`, `manual_review`, `automated_high_confidence`)

Only matches with `match_confidence >= 0.9` are used in scoring.

### Rule 6: Ambiguous matches go to entity_match_reviews

When an automated process identifies a potential social account match with `0.7 ≤ confidence < 0.9`, create an `entity_match_reviews` record with `status: 'pending'`. Do not use the match until it is reviewed.

### Rule 7: Never merge people because their names match

Two people with the same display name are never merged. Each must have its own Wikidata QID. If the same name appears in two `people` rows, that is correct — they are different people.

### Rule 8: Person aliases are additive

The `person_aliases` table stores alternative names (birth names, stage names, common misspellings, names in other scripts). Aliases are used for search only. Adding an alias never modifies the canonical `display_name`.

## Data Quality Tiers

| Tier | Description | Scoring Treatment |
|---|---|---|
| Verified | Linked via Wikidata property or human review | Full weight in scoring |
| High confidence | Automated match with ≥ 0.9 confidence | Full weight |
| Pending | Confidence 0.7–0.9, awaiting review | Not used in scoring |
| Low confidence | < 0.7 confidence | Not stored; discarded |

## Entity Resolution for News and Search

News mention clustering and search interest data are attributed to a person by:
1. Looking up the person's known aliases and Wikipedia article title
2. Matching article titles in the news cluster to known aliases
3. Requiring an exact or near-exact match (not fuzzy name matching)
4. Recording the match method in the observation's `payload_json`

In the MVP, news and search data are mocked, so entity resolution for these sources is not yet implemented in production.
