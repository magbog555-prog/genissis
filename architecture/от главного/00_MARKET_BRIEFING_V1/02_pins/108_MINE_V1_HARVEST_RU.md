# MINE_V1 harvest — capability inventory, not OOS peek

Harvest UTC in JSON: `2026-08-17T05:43:46Z`.  
`t_max` observed on acceptance journal: `2026-08-17T05:44:25Z` — still inside the unused buffer, **before** OOS start 06:00Z. Orientation/futures of the OOS window were **not** computed.

```text
run_id = core4_week1_organism_memory_20260812_t1
role   = EXPERIENCE DISCOVERY
cut    = 2026-08-17T04:53:48.945Z
```

## What the journals physically hold (this harvest)

| Object | Count / size | How to read it |
|--------|----------------|----------------|
| unique freeze keys `(symbol, anchor, R, freeze_time)` | 522938 | grain of pack 80 |
| unique keys ≤ development cut | 481689 | discovery corpus |
| unique keys ≥ OOS start (count-only) | 0 at harvest | OOS had not started yet |
| unique T at morning Gate-1 compute | 27335 | pack 107 development; **not** independent events |
| Acceptance unique states (all keys) | UNKNOWN 515347 · NO_ACCEPTANCE 6298 · ACCEPTED_UP 689 · ACCEPTED_DOWN 604 | UNKNOWN is missingness / resolution, not “zero edge” |
| scenario_set lines | 170683 | not formation counts |
| W1 string hits in scenario_set | W1-1 163755 · W1-2 114420 · W1-3 145287 · W1-4 115380 | **not** sealed W1-n formations |
| pack 19 sealed-prefix OOS/BLIND (older split) | 14251 independence groups · DISCOVERY 8575 · CAL 3524 · BLIND 2152 groups / **92** unique W1-1 H held closed · **644** unique W1-1 H across splits | this split is **not** the Gate 2 orientation exam |
| 15 symbols on freeze keys | ETH largest (89565) … NEAR smallest (3260) | 15 books ≠ 15 independent votes |

Journals present and large: acceptance shadow, path sample, scenario set/lifecycle, family assessment, densify, organ observations, market frames, 5s capture.

## Provenance / missingness (what harvest can say)

- Acceptance is dominated by `UNKNOWN` (~98.5% of unique freeze keys). That is feed/resolution/binding occupancy, not a directional score.
- Harvest did **not** re-slice by session, clock-hour, or BTC-regime. Those remain Gate 3 confounders, not counted here.
- Harvest did **not** recompute BTC correlation / effective sample size. Prior law still stands: overlapping windows and co-moving books shrink independent events far below 15×N.
- Fine/N2 occupancy was **not** re-measured in this harvest. Do not invent a fine-grain count from string hits.

## What MINE_V1 allows us to investigate

- W1-1 freeze grain and 30m PATH_LAST ruler
- 15-book 1m closes and Binding V1 as-of
- Acceptance V1.1 as a **sensor**, not Direction
- Pre-t0 sync/orientation as **context**
- Organs, densify, scenario/family journals, missingness, overlapping T

## What MINE_V1 did not lawfully record (Gates 6–7 gaps)

Fees, MinQty/step live check, realized fill/slip, leverage/margin/liquidation, worst-case loss vs budget, entry/invalidation/exit frozen before PnL, DirectionBindingRecord LONG/SHORT, paper order journal.

Therefore: the mine can support Gate 2 (same frozen table on fresh T) and later Gate 3 diagnostics. It **cannot** by itself sit Gate 6 or Gate 7. Collector may start those journals later **without** changing trade logic.

## What it is not

W1 = side · Acceptance = Direction · 15 independent confirmations · CORE-4 as sufficient trade hypothesis · PAPER expectancy after costs.
