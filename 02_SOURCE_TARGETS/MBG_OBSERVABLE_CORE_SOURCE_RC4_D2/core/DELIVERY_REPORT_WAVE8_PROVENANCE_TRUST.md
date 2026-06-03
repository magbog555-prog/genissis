# Delivery Report — Wave 8 / Role 6 — Provenance Trust Integration

## Scope

Role 6 integrated provenance health with the trust and action decision layer.

Canonical base: `mbg-core-v0.1-alpha6.zip`

This delivery does not connect V1, V2, UI, execution, strategy logic, live trading, or real exchange keys.

## Changed files

```txt
package.json
core/contracts/src/actions.ts
core/gates/src/action-gate.ts
core/integrity/integrity-report.ts
core/kernel/core-trust-report.ts
core/kernel/kernel-authority.ts
core/recovery/recovery-planner.ts
core/runtime/src/runtime-engine.ts
tests/scenarios/gate-scenarios.ts
tests/scenarios/wave8-provenance-trust.ts
DELIVERY_REPORT_WAVE8_PROVENANCE_TRUST.md
```

## Added tests

```txt
tests/scenarios/wave8-provenance-trust.ts
npm run test:core:provenance-trust
```

## Tests run

```txt
npm run typecheck
EXIT=0

npm test
EXIT=0

npm run test:core:provenance-trust
EXIT=0
```

## Trust rules

```txt
Risk-increasing actions require valid provenance.

complete:
  - valid for risk-increasing action checks when no provenance blocking reasons exist.

missing:
  - blocks risk-increasing actions.
  - does not automatically mean corruption.
  - may lead to UNCERTAIN / RECOVERABLE / DENY, not COMPROMISED by itself.

partial:
  - blocks risk-increasing actions.
  - requires metadata chain repair or additional provenance attachment.

unverifiable:
  - blocks risk-increasing actions.
  - requires replay/manual review before trust can be claimed.

inconsistent:
  - blocks risk-increasing actions.
  - is treated as proven evidence and may produce COMPROMISED.

parent missing / replay mismatch:
  - treated as provenance evidence problems.
  - recovery path includes replay/manual review and metadata quarantine.
```

## Provenance blocking reasons

```txt
PROVENANCE_MISSING
PROVENANCE_INCOMPLETE
PROVENANCE_INCONSISTENT
PROVENANCE_UNVERIFIABLE
PROVENANCE_PARENT_MISSING
PROVENANCE_REPLAY_MISMATCH
```

## Gate verdict examples

Denied risk-increasing action without provenance:

```json
{
  "actionType": "place_order",
  "allowed": false,
  "actionClass": "NORMAL",
  "reason": "provenance_missing",
  "provenanceStatus": "missing",
  "provenanceBlockingReasons": ["PROVENANCE_MISSING"]
}
```

Allowed recovery/reduce-risk action with missing provenance:

```json
{
  "actionType": "cancel_order",
  "allowed": true,
  "actionClass": "RISK_REDUCING",
  "provenanceStatus": "missing"
}
```

Allowed normal action with complete provenance, assuming all other existing trust gates pass:

```json
{
  "actionType": "place_order",
  "allowed": true,
  "actionClass": "NORMAL",
  "provenanceStatus": "complete",
  "provenanceBlockingReasons": []
}
```

## Recovery hints

```txt
PROVENANCE_MISSING:
  - ATTACH_PROVENANCE

PROVENANCE_INCOMPLETE:
  - REPAIR_METADATA_CHAIN
  - ATTACH_PROVENANCE

PROVENANCE_UNVERIFIABLE:
  - RUN_REPLAY_CHECK
  - MANUAL_REVIEW

PROVENANCE_PARENT_MISSING:
  - REPAIR_METADATA_CHAIN
  - ATTACH_PROVENANCE

PROVENANCE_INCONSISTENT:
  - RUN_REPLAY_CHECK
  - REPAIR_METADATA_CHAIN
  - QUARANTINE_INCONSISTENT_METADATA
  - MANUAL_REVIEW

PROVENANCE_REPLAY_MISMATCH:
  - RUN_REPLAY_CHECK
  - REPAIR_METADATA_CHAIN
  - QUARANTINE_INCONSISTENT_METADATA
  - MANUAL_REVIEW
```

## Semantic notes

ActionGate is not weakened.

The gate now has an additional blocker for `NORMAL` / risk-increasing actions when provenance is not complete. It does not allow anything that was previously denied. It also does not incorrectly block `RISK_REDUCING`, `RECOVERY`, or `DIAGNOSTIC` actions merely because provenance is missing.

Kernel Authority remains the source of trust state. ActionGate consumes provenance evidence and reports it in the verdict; it does not compute global trust independently.

Permission, recovery, and report paths observe provenance. They do not mutate the snapshot, create orders, execute recovery, or write trading state.

Unknown / missing provenance is not treated as corruption. COMPROMISED is reserved for evidenced mismatch/inconsistency/tampering/replay mismatch conditions.

Wave 7 hash-chain and causality ownership are not changed.

## Known limitations

```txt
- This task does not implement Metadata-as-Events producers.
- Runtime reports missing provenance until canonical provenance events are supplied by the provenance layer.
- No V1 bridge is connected.
- No execution, UI, trading terminal, strategy, live trading, or real keys were added.
- Recovery Planner only suggests provenance recovery actions; it does not execute them.
```
