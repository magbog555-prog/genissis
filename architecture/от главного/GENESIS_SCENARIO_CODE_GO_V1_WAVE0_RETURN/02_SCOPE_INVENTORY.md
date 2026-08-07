# 02 — Scope inventory

## In scope (delivered)

| Item | Path / note |
|---|---|
| ScenarioHypothesis / ScenarioSet | `scenario/models.py` |
| FASBinding + bind_sealed_fas | `scenario/binding.py` |
| FormationContext / EvidenceRelation / ProvenanceLink | `scenario/models.py` |
| C6/C7/C12 vocabulary | `scenario/vocabulary.py` |
| Honesty GAP/NOT_APPLICABLE helpers | `scenario/honesty.py` |
| CORE-4 WAVE-0 stubs W1-1..W1-4 | `scenario/evaluate/` |
| Producer FAS→ScenarioSet | `scenario/producer.py` |
| Acceptance tests | `tests/cognitive_shadow/scenario/` |

## Out of scope (forbidden — untouched)

```text
Setup / Decision / Risk / Admission / Execution / UI
F1–F6 evaluator rewrite
Range promotion to wave-1
majority vote / fake probability product
influence_allowed=true
JOIN/runtime wire protocol freeze
C11 research fence products
```

## Soft findings respected

```text
F-01 contracts ACCEPTED+BOUND — stubs do not rewrite A–M law
F-02 reclaim/return not fused unfalsifiably — W1-1 emits 0 hypotheses
F-03 no organ bypass — binding reads sealed FAS only
F-04 thresholds not silent law — residual listed as GAP_LISTED
```
