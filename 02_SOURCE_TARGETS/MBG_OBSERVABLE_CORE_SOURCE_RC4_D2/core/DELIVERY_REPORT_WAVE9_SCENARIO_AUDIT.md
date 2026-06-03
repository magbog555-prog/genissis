# Delivery Report — Wave 9 Market Input Integrity Scenario Audit

Role: 7 — Scenario Audit / Behavioral Verification

Canonical base: `mbg-core-v0.1-alpha7`

Target: `mbg-core-v0.1-alpha8`

## Scope

This delivery adds an acceptance audit for Wave 9 Market Input Integrity.

The audit verifies that market observations are not trusted by default and must be validated, ordered, fresh, replay-safe, provenance-linked, traceable, and visible in trust reporting before risk-increasing actions can depend on them.

This delivery intentionally does not implement runtime architecture or change runtime behavior.

## Files changed

```txt
package.json
tests/scenarios/wave9-market-input-integrity-audit.ts
DELIVERY_REPORT_WAVE9_SCENARIO_AUDIT.md
```

## Added script

```bash
npm run test:wave9:scenario-audit
```

The script runs:

```bash
npm run typecheck && tsx tests/scenarios/wave9-market-input-integrity-audit.ts
```

## Scenario list

```txt
1. valid market input accepted after validation
2. invalid market input rejected before mutation
3. duplicate market input is idempotent
4. duplicate market input does not bump revision
5. sequence gap detected
6. gap blocks risk-increasing action
7. stale input detected from event-provided timestamps
8. stale input blocks risk-increasing action
9. missing provenance rejected or blocks risk
10. market input without payloadHash rejected
11. checksum mismatch blocks trust
12. unknown market input != corruption
13. valid market input alone does not grant permission
14. recovery/cancel/reduce-only remain available
15. market input visible in CausalityTrace
16. marketInputStatus visible in CoreTrustReport
17. replay preserves market input state
18. no V1 / no websocket / no execution leak
```

## Semantic risks covered

```txt
market input treated as truth by default
state mutation before validation
missing provenance bypass
payloadHash/checksum bypass
sequence gap not visible to trust/ActionGate
stale input treated as fresh
unknown input incorrectly escalated to COMPROMISED
valid market input incorrectly granting permission
recovery/cancel/reduce-only incorrectly blocked
market input missing from causality trace
market input missing from CoreTrustReport
replay nondeterminism
V1/live/websocket/execution leakage
```

## Commands run on alpha7

```bash
npm run typecheck
```

Result: passed.

```bash
npm test
```

Result: passed.

```bash
npm run test:wave9:scenario-audit
```

Result on alpha7: failed on expected Wave 9 implementation gaps.

Observed alpha7 result:

```json
{
  "name": "wave9_market_input_integrity_audit",
  "total": 18,
  "passed": 9,
  "failed": 9
}
```

## Expected alpha8 result

After Wave 9 implementation is integrated, the audit should pass fully:

```json
{
  "name": "wave9_market_input_integrity_audit",
  "total": 18,
  "passed": 18,
  "failed": 0
}
```

## Known gaps

Alpha7 does not yet expose final Wave 9 market input integrity surfaces, including final canonical event constants and final market input view/verification API.

The audit accepts canonical-name adaptation by Role 8, but semantic expectations must not be weakened.

Expected final surfaces may include equivalents of:

```txt
getMarketInputIntegrityView()
getMarketInputView()
getMarketInputStatus()
getMarketObservationView()
getMarketObservations()
verifyMarketInputIntegrity()
```

## Intentionally not done

```txt
Runtime behavior was not changed.
CORE_CONSTITUTION.md was not changed.
ActionGate logic was not changed.
Trust logic was not changed.
Replay/integrity logic was not changed.
V1/V2 were not connected.
External services were not used.
Live websocket was not tested or connected.
Execution/trading was not added.
UI was not added.
Real exchange keys were not added.
Date.now()/Math.random() were not used for reducer/replay-sensitive logic.
A second source of truth was not introduced.
```
