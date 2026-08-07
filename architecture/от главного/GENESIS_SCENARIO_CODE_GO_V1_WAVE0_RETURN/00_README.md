# GENESIS — SCENARIO CODE GO V1 WAVE-0 DEV RETURN

```text
package: GENESIS_SCENARIO_CODE_GO_V1_WAVE0_RETURN
verdict: SCENARIO_CODE_GO_V1_WAVE0_READY_WITH_GAPS
matrix_S: 8 PASS / 0 FAIL · GAP_LISTED (detectors)
host_suite: 26 passed (tests/cognitive_shadow/scenario/)
influence_allowed: false
wire: NOT in this wave (library + unit tests only)
```

## What this seals

```text
WAVE-0 Scenario foundation under sealed stack:
  ScenarioHypothesis / ScenarioSet / FASBinding / FormationContext
  EvidenceRelation + Lifecycle enums (C6/C7/C8)
  CORE-4 evaluator stubs W1-1..W1-4 with honest NOT_APPLICABLE / GAP_LISTED
  Producer: sealed FamilyAssessmentSetV1 → ScenarioSet (empty lawful)
NOT sealed: Setup/Risk/Execution · F* rewrite · Range wave-1 · vote/P · trade gates
NOT wired: JOIN/runtime attach (deferred to optional WAVE-0.1 wire GO)
```

## Authority pins (read-only)

| Pin | Value |
|---|---|
| CODE GO | `OWNER_GO_SCENARIO_CODE_GO_V1_RU.md` |
| Dispatch SHA | `70727d7f0fc8237325736feb97dd26e615d53987a31a1c0054b9246a08d56dd9` |
| Chief freeze SHA | `a25d22fc6f39ea8ea57610d0d92aeb8d7efbd909fa2f570771efbe3a769e5985` |
| CORE-4 contracts SHA | `a1585ca3881734f19cb51cb529ba9180fe569398e08f20b680fa74ffb5859510` |

## Code layout

```text
services/genesis_terminal_backend/app/terminal/cognitive_shadow/scenario/
  __init__.py
  models.py
  binding.py
  vocabulary.py
  honesty.py
  producer.py
  evaluate/
    w1_1_liquidity_reclaim.py
    w1_2_continuation.py
    w1_3_failed_break.py
    w1_4_compression_expansion.py

tests/cognitive_shadow/scenario/
  test_wave0_*.py  (26 tests)
```

## Honesty / GAP

```text
All-UNAVAILABLE FAS → NOT_APPLICABLE ×4 + empty ScenarioSet
FAS with semantic anchor → GAP_LISTED ×4 (detectors not implemented) + empty ScenarioSet
WAVE-0 does not invent calibrated detectors or path claims
```

## Re-verify

```text
cd D:\genessis\services\genesis_terminal_backend
python -m pytest tests/cognitive_shadow/scenario/ -q --tb=short
# expect: 26 passed, rc=0
```

## Next

```text
Dev return → Curator verify → Owner accept
optional later: WAVE-0.1 wire GO / WAVE-1 densify detectors CODE GO
```
