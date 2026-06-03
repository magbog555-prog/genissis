# Delivery Report — Wave 8 Scenario Audit

Role: 7 — Scenario Audit / Test Owner / Canonical Audit

Canonical base: `mbg-core-v0.1-alpha6`

Target: Wave 8 integrated build.

## Scope

This delivery adds behavioral/acceptance scenario coverage for **Metadata as Events / Provenance Layer**.

The audit verifies that provenance becomes event-sourced, deterministic, replay-safe, traceable, auditable and observable without weakening trust, replay, ActionGate, quarantine, permission ledger, or Wave 7 hash-chain/causality semantics.

## Files changed

```txt
package.json
tests/scenarios/wave8-metadata-as-events-audit.ts
DELIVERY_REPORT_WAVE8_SCENARIO_AUDIT.md
```

## Added script

```bash
npm run test:wave8:scenario-audit
```

The script runs:

```bash
npm run typecheck && tsx tests/scenarios/wave8-metadata-as-events-audit.ts
```

## Scenarios covered

```txt
1. metadata event attaches ProvenanceRef
2. duplicate metadata event is idempotent
3. action without provenance is denied
4. recovery action is not wrongly blocked
5. missing provenance is not corruption
6. inconsistent provenance blocks risk
7. provenance appears in causality trace
8. provenance appears in CoreTrustReport
9. replay preserves metadata state
10. fill/PnL provenance can be traced
11. metadata does not grant permission
12. unknown provenance is not corruption
13. proven mismatch can compromise trust
14. no V1 / no execution leak
```

## Semantic risks covered

```txt
metadata-as-side-bag risk
non-deterministic metadata risk
duplicate provenance risk
provenance bypasses ActionGate risk
metadata grants permission risk
missing provenance incorrectly becomes corruption risk
unknown provenance incorrectly becomes corruption risk
proven mismatch not reflected in trust risk
trace without provenance risk
CoreTrustReport without provenance observability risk
replay loses metadata state risk
fill/PnL cannot be traced to origin risk
V1/live/execution leakage risk
```

## Commands run on alpha6

```bash
npm run typecheck
```

Result: passed.

```bash
npm test
```

Result: passed.

```bash
npm run test:wave8:scenario-audit
```

Result on alpha6: failed on expected Wave 8 implementation gaps.

Observed alpha6 result:

```json
{
  "name": "wave8_metadata_as_events_audit",
  "total": 14,
  "passed": 3,
  "failed": 11
}
```

## Expected result after Wave 8 integration

```json
{
  "name": "wave8_metadata_as_events_audit",
  "total": 14,
  "passed": 14,
  "failed": 0
}
```

## Known limitations / gaps

Alpha6 does not yet expose the Wave 8 provenance event contract or provenance view surfaces. The audit therefore expects future Wave 8 runtime surfaces such as:

```txt
metadata.provenance.attached
metadata.provenance.mismatch_detected

getProvenanceView()
getProvenanceRecords()
getProvenanceLedger()
getMetadataEvents()
getProvenance()
```

The exact implementation may expose equivalent final APIs, but the semantics must remain the same: provenance must be event-sourced, replay-safe, traceable, and visible in CoreTrustReport/causality.

## Intentionally not done

```txt
Runtime behavior was not changed.
CORE_CONSTITUTION.md was not changed.
ActionGate logic was not changed.
Kernel Authority logic was not changed.
Replay/integrity logic was not changed.
Quarantine logic was not changed.
Permission Ledger logic was not changed.
Recovery Planner logic was not changed.
V1/V2 were not connected.
UI was not added.
Strategy logic was not added.
Trading terminal was not added.
Live trading was not enabled.
Real exchange keys were not added.
External services were not used.
Local fake runtime modules were not introduced.
```
