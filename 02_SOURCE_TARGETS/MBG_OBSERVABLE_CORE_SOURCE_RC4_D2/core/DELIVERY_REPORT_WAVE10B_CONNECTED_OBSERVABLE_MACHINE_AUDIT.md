# Delivery Report — Wave 10B Connected Observable Machine Audit

Role: 7 — Scenario Audit / Behavioral Verification

Canonical base: `mbg-core-v0.1-alpha9`

Frontend reference: `observable-core-machine-v0.7.8-wave10a-15-scenarios` / Wave 10B API adapter reference.

## Scope

This delivery adds an acceptance audit for the connected observable core machine path:

```text
15 mock scenarios
→ Core observable API
→ ComputationTrace DTO
→ UI-visible visual verdict
→ deterministic replay/rendering
```

The audit is read-only. It does not implement runtime architecture or UI behavior.

## Files changed

```txt
package.json
tests/scenarios/wave10b-connected-observable-machine-audit.ts
DELIVERY_REPORT_WAVE10B_CONNECTED_OBSERVABLE_MACHINE_AUDIT.md
```

## Added script

```bash
npm run test:wave10b:scenario-audit
```

The script runs:

```bash
npm run typecheck && tsx tests/scenarios/wave10b-connected-observable-machine-audit.ts
```

## Scenarios covered

```txt
1. All 15 mock scenarios render deterministically
2. UI DTO stable across replay
3. Same scenario -> same visual verdict
4. Market input integrity visible
5. Provenance visible
6. Gap/stale/duplicate visible
7. Snapshot diff visible
8. Recovery visibility preserved
9. Quarantine visibility preserved
10. ActionGate deny reasoning visible
11. Valid observation does not imply permission
12. UI DTO does not mutate Core state
13. UI contracts remain read-only
14. No execution semantics leak
15. No trading controls leak
16. No websocket authority
17. No V1/live integration
18. Deterministic replay preserved
```

## Semantic risks covered

```txt
rendering drift
replay inconsistency
missing ActionGate reasoning
broken causality/trace visibility
nondeterministic DTO output
valid-observation-implies-permission regression
UI-side mutation of Core state
execution/trading/websocket authority leak
V1/live integration leak
```

## Commands run on alpha9

```bash
npm run typecheck
```

Result: passed.

```bash
npm test
```

Result: passed.

```bash
npm run test:wave10b:scenario-audit
```

Result: passed.

## PASS/FAIL baseline

Observed on alpha9 after `npm install`:

```json
{
  "name": "wave10b_connected_observable_machine_audit",
  "total": 18,
  "passed": 18,
  "failed": 0
}
```

Expected final Wave 10B result:

```json
{
  "name": "wave10b_connected_observable_machine_audit",
  "total": 18,
  "passed": 18,
  "failed": 0
}
```

## Known limitations

The audit does not mount React, does not use a browser, and does not test CSS/layout. It verifies UI-visible DTO semantics and deterministic visual verdicts from the Core observable API.

The audit does not call external services and does not open websocket connections.

## Intentionally not done

```txt
Runtime behavior was not changed.
CORE_CONSTITUTION.md was not changed.
ActionGate was not changed.
Trust logic was not changed.
Replay/integrity logic was not changed.
V1/V2 were not connected.
UI controls were not added.
Websocket authority was not added.
Live market was not connected.
Execution/trading/order placement was not added.
Real exchange calls or keys were not added.
```
