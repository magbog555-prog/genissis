# 02 — Scope inventory

## Delivered

| Item | Location |
|---|---|
| Soft attach after FAS | `scenario_join.attach_scenario_set_v0_1` |
| Chain envelope→FAS→Scenario | `evaluate_envelope_with_scenario_v0_1` |
| Result field | `CognitiveEvaluationResult.scenario_set` |
| Readonly journal | `scenario/shadow_publish.py` + `ShadowSink.append_scenario_set` |
| Soft gap journal (optional) | `append_scenario_soft_gap_v0_1` / `publish_soft_gaps` |
| no_influence allowlist | authorized `cognitive_shadow.scenario*` only |
| Tests W001–W006 | `tests/.../test_wave0_1_wire_v1.py` |

## Forbidden (untouched)

```text
WAVE-1 CORE-4 detector implementation
F1–F6 rewrite
Setup / Risk / Execution / UI trade
influence_allowed=true
forcing non-empty ScenarioSet
```
