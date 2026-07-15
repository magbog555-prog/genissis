# Thinking family knowledge dossier — Trend Continuation

**File:** `04_thinking_families/01_trend_continuation.md`  
**family_id:** `trend_continuation`  
**Catalog alignment:** Cognitive Model `thinking_family_catalog_v1.1.3`  
**Outputs allowed here:** ask-rights / literature priors only  
**Forbidden:** LONG/SHORT, Scenario gates, production thresholds

## 1. Cognitive purpose
Organize market questions for **Trend Continuation** when family analysis may be available.

## 2. Market questions
- Is structural continuation supported by participation?
- Is pullback acceptable vs broken structure?

## 3. Required analysis domains
Price structure + participation (Tape) and/or liquidity geography depending on family roles below.

## 4–6. Supporting organs (role classes)
- **ANALYSIS_REQUIRED:** `chart_structure`, `tape_executed_trades`
- **ANALYSIS_SUPPORTING:** `impulse_quality`, `volatility`, `liquidity`
- **CONTEXTUAL:** `session_profile`, `market_context`
- **OPTIONAL_RESEARCH:** `funding`, `open_interest`, `cross_symbol_correlation`

## 7. Public literature basis
- `KC-VSA-EFFORT-RESULT` — Effort versus result (crowd=HIGH)
- `KC-WYCKOFF-PHASES` — Wyckoff market phases (crowd=HIGH)
- `KC-VOL-REGIME` — Volatility regime (crowd=HIGH)
- `KC-MA-CROSS` — Moving average crossovers (crowd=VERY_HIGH)
- `KC-CANDLES` — Candlestick patterns (crowd=VERY_HIGH)
- `KC-ELLIOTT` — Elliott Wave (crowd=HIGH)
- `KC-OI-PRICE` — Open interest with price (crowd=HIGH)

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
Queued in `research_hypotheses.json` with `related_families` containing `trend_continuation`.

## 16. No-trade / insufficient-evidence conditions
Not a trade gate. Analysis unavailable when required organs lack integrity/comparability.

## 17. What is NOT a scenario yet
Family availability ≠ Scenario ≠ Candidate ≠ Decision.

## 18. What future scenario contracts would need
Separate RFC path (not open): explicit evidence bundles, independence counting, and non-literature proof. Out of scope for this KB task.

---
BOOK KNOWLEDGE ≠ PROVEN EDGE ≠ PRODUCTION RULE
