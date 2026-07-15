# GENESIS Reverse Architecture Map v1

**Package:** Knowledge Base Reverse Map  
**Formula:** Organ/Family → Questions → Concepts → Books → Crowd → Formalization → Hypothesis → Test → (later) Rule

## Layer A — Sensors / Organs (15)

| # | Dossier | organ_id | Class |
|---|---|---|---|
| 1 | `03_organs/01_chart_price_structure.md` | `chart_structure` | PRIMARY / ROOT |
| 2 | `03_organs/02_dom_order_book.md` | `dom_order_book` | PRIMARY / ROOT |
| 3 | `03_organs/03_tape_executed_trades.md` | `tape_executed_trades` | PRIMARY / ROOT |
| 4 | `03_organs/04_spread_entry_cost.md` | `spread_entry_cost` | PRIMARY / ROOT |
| 5 | `03_organs/05_volatility.md` | `volatility` | PRIMARY / ROOT |
| 6 | `03_organs/06_liquidity.md` | `liquidity` | PRIMARY / ROOT |
| 7 | `03_organs/07_tempo.md` | `market_tempo` | DERIVED |
| 8 | `03_organs/08_impulse_quality.md` | `impulse_quality` | DERIVED |
| 9 | `03_organs/09_market_context.md` | `market_context` | DERIVED / integrative |
| 10 | `03_organs/10_exhaustion.md` | `exhaustion` | DERIVED |
| 11 | `03_organs/11_correlation.md` | `cross_symbol_correlation` | CROSS_SYMBOL |
| 12 | `03_organs/12_news_events.md` | `news_events` | PRIMARY / EXTERNAL_EVENT |
| 13 | `03_organs/13_funding.md` | `funding` | PRIMARY |
| 14 | `03_organs/14_open_interest.md` | `open_interest` | PRIMARY |
| 15 | `03_organs/15_session_profile.md` | `session_profile` | PRIMARY / ROOT |

Machine links: `03_organs/organ_knowledge_links.json`

## Layer B — Thinking families (8)

Aligned to Cognitive Model catalog v1.1.3 names:

| Dossier | family_id | Catalog title |
|---|---|---|
| `04_thinking_families/01_trend_continuation.md` | `trend_continuation` | Trend Continuation |
| `04_thinking_families/02_reversal.md` | `reversal` | Reversal |
| `04_thinking_families/03_breakout.md` | `breakout` | Breakout |
| `04_thinking_families/04_liquidity_sweep.md` | `liquidity_sweep` | Liquidity Sweep |
| `04_thinking_families/05_return_to_range.md` | `return_to_range` | Range Return |
| `04_thinking_families/06_news_impulse_mode.md` | `news_impulse_mode` | Event Acceleration |
| `04_thinking_families/07_session_open.md` | `session_open` | Session Open |
| `04_thinking_families/08_manipulation_false_breakout.md` | `false_break_failed_follow_through` | False Break / Failed Follow-Through |

Machine links: `04_thinking_families/thinking_family_knowledge_links.json`

## Layer C — Literature → research pipeline

```text
knowledge_sources.json
  → knowledge_concepts.json
    → research_hypotheses.json
      → (future) INTERNAL_TESTED_RESULT
        → (future, Owner+RFC) INTERNAL_ADMITTED_RULE
```

**Never skip tests. Never admit from literature alone.**

## Layer D — Crowd & commercial awareness

`07_crowd_map/` + `crowd_exposure_map.json`

Public knowledge = map of participant behavior, not edge.

## Layer E — Algorithms / bots / systems

`05_algorithms_bots/` — reuse classified as CONCEPT / RESEARCH_METHOD / DATA_MODEL / TEST_METHOD / ADAPT / DO_NOT_REUSE.

## Critical fences called out in dossiers

- **DOM ≠ absorption** (needs Tape)  
- **Spread ≠ slippage/impact**  
- **Tempo** shared-source / derived — no Agreement inflation  
- **Market Context** integrative — list every dependency  

## What this map is not

Not Cognitive Model edit. Not organ passport edit. Not Scenario. Not RFC-0005. Not trading code.
