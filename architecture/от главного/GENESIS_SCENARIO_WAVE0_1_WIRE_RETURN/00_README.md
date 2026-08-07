# GENESIS — SCENARIO WAVE-0.1 WIRE DEV RETURN

```text
package: GENESIS_SCENARIO_WAVE0_1_WIRE_RETURN
verdict: SCENARIO_WAVE0_1_WIRE_READY_WITH_GAPS
matrix_W: W001–W005 PASS · W006 GAP_LISTED (inherit WAVE-0 stubs)
host_suite: 37 passed (tests/cognitive_shadow/scenario/ incl. WAVE-0 + wire)
influence_allowed: false
detectors: NOT opened (stubs only)
```

## What this seals

```text
WAVE-0.1 nerve wire:
  FamilyAssessmentSet → produce_scenario_set_v1 → ScenarioSet on CognitiveEvaluationResult
  optional readonly journal via ShadowSink.scenario_set.jsonl
  soft-join when FAS absent / produce fail (organs+FAS continue)
NOT sealed: WAVE-1 detectors · Setup/Risk/Execution · influence=true
```

## Code pointers

```text
scenario_join.py                         # attach_scenario_set_v0_1 / evaluate_envelope_with_scenario_v0_1
scenario/shadow_publish.py               # journal append
scenario/producer.py                     # reused WAVE-0 (not forked)
shadow_consumer.CognitiveEvaluationResult.scenario_set
shadow_sink.append_scenario_set
```

## Authority

| Pin | Value |
|---|---|
| GO | `OWNER_GO_SCENARIO_WAVE0_1_WIRE_RU.md` |
| Dispatch SHA | `4af8aff9b7f4153846d9dbd7667975668a1df747ebea821ab77dc18b7f184455` |
| WAVE-0 accept ZIP | `4c96fe74aeb2372299f53d2945eaa2cc022191bc38f69dcb77fc58edd20e5e74` |

## Re-verify

```text
cd D:\genessis\services\genesis_terminal_backend
python -m pytest tests/cognitive_shadow/scenario/ -q --tb=short
# expect: 37 passed, rc=0
```

## Next

```text
Curator verify → Owner accept
then optional WAVE-1 DETECTORS CODE GO (still no Risk/Execution)
```
