# Thinking family knowledge dossier — Event Acceleration

**File:** `04_thinking_families/06_news_impulse_mode.md`  
**family_id:** `news_impulse_mode`  
**Catalog alignment:** Cognitive Model `thinking_family_catalog_v1.1.3`  
**Outputs allowed here:** ask-rights / literature priors only  
**Forbidden:** LONG/SHORT, Scenario gates, production thresholds

## 1. Cognitive purpose
Organize market questions for **Event Acceleration** when family analysis may be available.

## 2. Market questions
- Is there a bound event window?
- Did cost/tempo/vol change enough to alter comparability?

## 3. Required analysis domains
Price structure + participation (Tape) and/or liquidity geography depending on family roles below.

## 4–6. Supporting organs (role classes)
- **ANALYSIS_REQUIRED:** `news_events`, `volatility`, `spread_entry_cost`
- **ANALYSIS_SUPPORTING:** `tape_executed_trades`, `market_tempo`
- **CONTEXTUAL:** `liquidity`, `market_context`
- **OPTIONAL_RESEARCH:** `funding`, `open_interest`

## 7. Public literature basis
- `KC-SPREAD-COST` — Quoted entry cost / spread (crowd=MEDIUM)
- `KC-VOL-REGIME` — Volatility regime (crowd=HIGH)
- `KC-FUNDING-EXTREME` — Funding extremes (crowd=HIGH)
- `KC-NEWS-IMPULSE` — News impulse (crowd=VERY_HIGH)

## 8. Known retail doctrine
Retail often compresses this family into a single pattern name and skips integrity, cost, and failed-follow-through checks.

## 9. Crowd behavior created by that doctrine
Expect clustered stops/entries around the narrative levels; second-order research may study sweeps and failed breaks.

## 10. Common traps
- Treating availability as confirmation  
- Chart-only certainty without Tape/DOM where required  
- Inventing manipulation intent language  

## 11. Contradictory schools
See `LITERATURE_CONTRADICTIONS.md` (trend vs mean reversion; indicator vs microstructure; Elliott vs probabilistic).

## 12. Candidate algorithms
Literature priors only — see `algorithm_candidates.json`. No family algorithm is admitted.

## 13. Data requirements
Must satisfy organ integrity for ANALYSIS_REQUIRED set; otherwise `UNAVAILABLE_INSUFFICIENT_KNOWLEDGE` / `BLOCKED_BY_INTEGRITY` per Cognitive Model.

## 14. Time-horizon requirements
Must respect organ temporal_scope; no longer horizon than parents for derived organs.

## 15. Research hypotheses
Queued in `research_hypotheses.json` with `related_families` containing `news_impulse_mode`.

## 16. No-trade / insufficient-evidence conditions
Not a trade gate. Analysis unavailable when required organs lack integrity/comparability.

## 17. What is NOT a scenario yet
Family availability ≠ Scenario ≠ Candidate ≠ Decision.

## 18. What future scenario contracts would need
Separate RFC path (not open): explicit evidence bundles, independence counting, and non-literature proof. Out of scope for this KB task.

---
BOOK KNOWLEDGE ≠ PROVEN EDGE ≠ PRODUCTION RULE
