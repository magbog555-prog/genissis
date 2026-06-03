# Delivery Report — Wave 10A Observable Machine Audit

Role: 7 — Scenario Audit / Behavioral Verification

Canonical base: `mbg-core-v0.1-alpha8`

Frontend reference: `observable-core-machine-v0-7-6`

Target: Wave 10A / mock-first connected observable core machine

## Scope

This delivery adds acceptance-audit coverage for the mock-first Core UI API / connected observable core machine.

The audit verifies that UI observes while Core decides. It does not implement runtime architecture, UI controls, trading, execution, live market integration, V1, websocket authority, or exchange keys.

## Files changed

```txt
package.json
tests/scenarios/wave10-observable-machine-audit.ts
DELIVERY_REPORT_WAVE10_OBSERVABLE_MACHINE_AUDIT.md
```

## Added script

```bash
npm run test:wave10:scenario-audit
```

The script runs:

```bash
npm run typecheck && tsx tests/scenarios/wave10-observable-machine-audit.ts
```

## Scenarios covered

```txt
1. All 15 mock scenarios render deterministically.
2. UI DTO stable across replay.
3. Same scenario -> same visual verdict.
4. Market input integrity visible.
5. Provenance visible.
6. Gap/stale/duplicate visible.
7. Snapshot diff visible.
8. Recovery visibility preserved.
9. Quarantine visibility preserved.
10. ActionGate deny reasoning visible.
11. Valid observation does not imply permission.
12. UI DTO does not mutate Core state.
13. UI contracts remain read-only.
14. No execution semantics leak.
15. No trading controls leak.
16. No websocket authority.
17. No V1/live integration.
18. Deterministic replay preserved.
```

## Semantic risks covered

```txt
UI observes; Core decides.
Mock scenario rendering must be deterministic.
UI DTO must be stable across replay.
Market input status must be observable, not treated as permission.
Provenance must remain visible.
Gap/stale/duplicate conditions must be visible.
Snapshot diff, recovery, quarantine and ActionGate denial reasons must be visible.
Reading UI DTO must not mutate runtime state.
DTO/contracts must remain read-only.
No execution/trading/websocket authority/V1/live semantics may leak through the observable machine.
Replay determinism must be preserved.
```

## Commands run on alpha8

```bash
npm run typecheck
```

Result: passed.

```bash
npm test
```

Result: passed.

```bash
npm run test:wave10:scenario-audit
```

Result on alpha8: expected Wave 10A implementation gaps.

Observed alpha8 result:

```json
{
  "name": "wave10_observable_machine_audit",
  "total": 18,
  "passed": 0,
  "failed": 18
}
```

## Expected final Wave 10A result

After the Observable Core Machine / Core UI API is integrated, the audit should pass fully:

```json
{
  "name": "wave10_observable_machine_audit",
  "total": 18,
  "passed": 18,
  "failed": 0
}
```

## Expected Wave 10A surfaces

The audit intentionally accepts canonical naming flexibility and looks for equivalent real runtime/module surfaces such as:

```txt
getObservableCoreMachineScenarios()
getObservableMachineScenarios()
getCoreUiMockScenarios()
getComputationTraceScenarios()

getObservableCoreMachineView()
getObservableCoreMachineDto()
getCoreUiDto()
getComputationTrace()
getLatestComputationTrace()

renderObservableCoreScenario()
renderCoreUiScenario()
renderComputationTraceScenario()
```

Role 8 may adapt exact names/API to the final canonical implementation, but must not weaken semantic expectations.

## Known limitations / gaps

Alpha8 does not yet expose the Wave 10A observable-machine/Core UI DTO surface expected by this audit.

The audit does not render a real browser UI. It checks the Core-facing DTO/contract layer and deterministic scenario outputs.

The audit does not connect external services, live market feeds, V1, websocket authority, execution, trading controls, or exchange credentials.

## Intentionally not done

```txt
CORE_CONSTITUTION.md was not changed.
Runtime behavior was not changed.
ActionGate logic was not changed.
Trust logic was not changed.
Replay/integrity logic was not changed.
V1/V2 were not connected.
UI controls were not added.
Live market was not connected.
Websocket authority was not added.
Execution/trading/order placement was not added.
Exchange keys were not added.
External services were not used.
```
