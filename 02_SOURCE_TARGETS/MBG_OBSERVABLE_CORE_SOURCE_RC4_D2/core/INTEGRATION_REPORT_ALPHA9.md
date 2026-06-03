# INTEGRATION_REPORT_ALPHA9

## Base package

`mbg-core-v0.1-alpha8.zip`

## Target package

`mbg-core-v0.1-alpha9.zip`

## Integration scope

Wave 10A — Mock-first Connected Observable Core Machine.

This integration closes the Core UI API / Connected Observable Core Machine layer in mock-first mode. It adds canonical DTO contracts, observable trace mapping, observable read-models, and an observable scenario audit without adding V1, live market integration, websocket authority, execution, trading controls, exchange keys, or order placement.

## Roles integrated

- Role 2 — CORE_CONSTITUTION / UI read-only laws.
- Role 4 — canonical ComputationTraceDTO and UI DTO contracts.
- Role 5 — observable trace / replay mapping.
- Role 6 — observable read-models.
- Role 7 — Wave 10A observable machine audit.
- Frontend reference — `observable-core-machine-v0.7.7-wave10a-mock-adapter.zip` used as reference only, not as Core source of truth.

## Role 2 integration

Wave 10A UI laws integrated into `CORE_CONSTITUTION.md`.

Mandatory Role 0 follow-up applied:

- Base code corrected to `mbg-core-v0.1-alpha8`.

## Role 4 integration

Canonical DTO contracts integrated:

- `ComputationTraceDTO`
- `MachinePulseDTO`
- `PipelineStepDTO`
- `FormulaExplanationDTO`
- `RuleEvaluationDTO`
- `SnapshotDiffDTO`
- `GateVerdictDTO`
- `LedgerRecordDTO`
- `QuarantineRecordDTO`
- `RecoveryHintDTO`
- `MarketInputIntegrityDTO`
- `ProvenanceDTO`

The Core now exposes all 15 mock-first canonical scenarios from the Core API layer.

## Role 5 integration

Observable trace mapping integrated into canonical `core/trace/causality-trace.ts`.

The mapping remains read-only and exposes deterministic observable trace/replay information without mutating snapshot state, writing events, computing trust, or becoming a source of truth.

## Role 6 integration

Observable read-models integrated under `core/observable/observable-read-models.ts`.

Read-models expose CoreTrustReport, IntegrityReport, ActionGate/GateDecision, blocking reasons, RecoveryPlan, QuarantineSummary, MarketInputStatus, and ProvenanceIntegrityStatus. They do not create trust, permission, or verdicts.

## Role 7 integration

Wave 10A observable machine audit integrated as canonical acceptance test:

`npm run test:wave10:scenario-audit`

Result:

`18/18 PASS`

## Frontend reference handling

The frontend package was accepted as a reference and not treated as Core authority. No frontend workspace was inserted as a source of truth. The Core exposes mock-first DTO/API contracts that the frontend can later align to 15/15 scenarios.

## Files changed

```text
CORE_CONSTITUTION.md
DELIVERY_REPORT_WAVE10A_ROLE4_COMPUTATION_TRACE_DTO.md
DELIVERY_REPORT_WAVE10_OBSERVABLE_MACHINE_AUDIT.md
DELIVERY_REPORT_WAVE10_OBSERVABLE_TRACE_MAPPING.md
core/contracts/src/ui.ts
core/contracts/ui/computation-trace-dto.ts
core/contracts/ui/index.ts
core/observable/observable-read-models.ts
core/trace/causality-trace.ts
core/ui-api/mock-scenarios.ts
core/ui-api/observable-core-machine.ts
package-lock.json
package.json
tests/scenarios/canonical-audit-checklist.ts
tests/scenarios/wave10-observable-machine-audit.ts
tests/scenarios/wave10-observable-read-models.ts
tests/scenarios/wave10-observable-trace-mapping.ts
tests/scenarios/wave10a-computation-trace-dto.ts
```

## Semantic decisions

1. Added a Core-owned, read-only `observable-core-machine` API surface under `core/ui-api/observable-core-machine.ts`.
2. Kept frontend as reference only; Core remains authority.
3. Canonicalized DTO contracts under `core/contracts/ui/*`.
4. Preserved Role 5 ownership of `core/trace/causality-trace.ts`.
5. Added observable read-models as projections only, not as trust/verdict generators.
6. Updated legacy canonical audit wording from “No UI” to “No frontend/control UI”, allowing only read-only Core UI API contracts while still blocking frontend/control UI surfaces.

## Conflicts found

- Legacy `canonical-audit-checklist` treated any path containing `ui` as forbidden. Wave 10A intentionally introduces Core UI API contracts. This was a legacy audit fixture conflict, not a semantic conflict.

## Conflicts resolved

- Updated canonical audit fixture to allow read-only Core UI API contract paths:
  - `core/contracts/ui/*`
  - `core/contracts/src/ui.ts`
  - `core/ui-api/*`

The audit still blocks frontend/control UI, websocket authority, live trading, execution, strategy, and V1/V2 defaults.

## Conflicts escalated to Role 0

None.

## Tests run

```text
npm ci — PASS
npm run typecheck — PASS
npm test — PASS
npm run test:core-constitution — PASS
npm run test:core:computation-trace-dto — PASS
npm run test:wave10:observable-trace-mapping — PASS
npm run test:core:observable-read-models — PASS
npm run test:wave10:scenario-audit — 18/18 PASS
npm run test:wave9:scenario-audit — 18/18 PASS
npm run test:wave8:scenario-audit — 14/14 PASS
npm run test:wave7:scenario-audit — 18/18 PASS
npm run test:canonical-audit-checklist — PASS
npm run verify — PASS
```

Full verify output is included in `verify-output-alpha9.txt`.

## Verify result

`npm run verify` completed with exit code `0`.

## Known follow-ups

- Frontend reference currently aligns as a mock adapter reference. Frontend should later align to all 15 Core scenarios.
- No live market integration is included; market/live connection remains out of scope.

## Red-line preservation statement

ActionGate not weakened.
Replay determinism preserved.
unknown hash != corruption preserved.
unknown provenance != corruption preserved.
unknown market input != corruption preserved.
UI is read-only.
Core remains source of truth.
UI does not compute trust.
UI does not compute permissions.
UI does not generate gate verdicts.
Visualization does not alter computation.
Mock first, market later preserved.
No V1 integration added.
No live market added.
No websocket authority added.
No live trading added.
No execution added.
No trading controls added.
No exchange keys added.
No order placement added.
No duplicate DTO/read-model/trace systems introduced.
No duplicate hash-chain / causality / provenance / market-input system introduced.
