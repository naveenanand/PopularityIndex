# Public Attention Index — Product Specification

## Purpose

Public Attention Index (PAI) measures how much public attention a person is receiving at a given moment in time. It does **not** measure:

- Talent, skill, or achievement
- Moral worth or character
- Approval or popularity in the sense of being liked
- Influence, impact, or importance

PAI answers the question: *How much is the public paying attention to this person right now, and has that attention changed recently?*

## Canonical Identity

Every person in PAI is identified by their **Wikidata QID** (e.g., `Q26876` for Taylor Swift). This is the immutable, unambiguous external identifier used across Wikimedia projects and many other knowledge systems.

Names are never used as primary keys. Names are ambiguous, change over time, and can be shared across multiple individuals.

## Core Scores

### Popularity Score (0–100)

Overall public visibility. A high score means the person receives substantial ongoing public attention across multiple independent signals. This score changes relatively slowly.

### Heat Score (0–100)

Recent acceleration in attention. A high score means attention has spiked recently compared to the person's own baseline. This score can rise and fall quickly.

### Sentiment (displayed separately)

A separate measurement of whether public discussion is positive, neutral, or negative in tone. Sentiment is displayed alongside scores but is **never included in the Popularity or Heat calculation**.

Rationale: Controversy, scandal, and criticism all drive public attention. A person trending because of bad news should receive a high attention score, not a low one. Conflating attention with approval would make the scores misleading.

### Coverage Score (0–100)

How complete the data is for this person. A person with data from many sources has high coverage. A person with data only from Wikipedia has low coverage. This is displayed to help users understand how confident to be in the scores.

## Non-Goals

- PAI is not a ranking of human worth
- PAI does not evaluate the quality or truthfulness of media coverage
- PAI does not evaluate whether public attention is deserved
- PAI is not a prediction market or forecasting tool
- PAI does not make claims about future attention levels

## Coverage Labels

| Coverage Score | Label | Meaning |
|---|---|---|
| < 40 | Insufficient data | Score is based on very limited signals; treat with caution |
| 40–69 | Partial coverage | Score reflects available signals; some sources are missing |
| ≥ 70 | High coverage | Score reflects a broad set of signals |

## Provider Status Labels

Every data source displayed in PAI is labeled with one of:

| Label | Meaning |
|---|---|
| Live | Real-time or recent data from an authenticated, approved source |
| Mock | Placeholder data generated for MVP development; not real |
| Unavailable | Source is known but not yet configured or authorized |
| Partial | Source is available but coverage is incomplete |

## MVP Scope

The MVP delivers a working vertical slice: Wikipedia-based scoring with mocked auxiliary signals. The web dashboard clearly labels all mock data. No mock data is ever presented as live production data.

## Future Scope

- Approved search interest data (e.g., Google Trends with commercial license)
- Licensed news coverage data
- Social media data via official APIs (X/Twitter, Instagram, YouTube)
- More people in the registry (currently ~150 seed entries)
- Daily automated ingestion
- Alerting on score spikes
