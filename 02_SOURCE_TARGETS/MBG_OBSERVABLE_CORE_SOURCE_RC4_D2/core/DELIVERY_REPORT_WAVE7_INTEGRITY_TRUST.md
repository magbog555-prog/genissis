# Delivery Report — Wave 7 / Integrity + Trust Integration

Role: 6  
Canonical base: `mbg-core-v0.1-alpha5.1.zip`  
Task: Integrity + Trust Integration

## Scope

Integrated Snapshot Hash Chain / Integrity evidence and Causality Trace evidence with:

- Kernel Authority;
- CoreTrustReport;
- ActionGate Verdict v2;
- Recovery Planner.

This task does not rewrite the Snapshot Hash Chain or Causality Trace ownership. It adds the integration contract, report shapes and trust/report/planner mappings required for semantic merge.

## Implemented

### 1. IntegrityReport

Added `core/integrity/integrity-report.ts`.

`IntegrityReport` contains:

- `status: unknown | valid | warning | broken | tampered`;
- `revision`;
- `snapshotHash`;
- `previousSnapshotHash`;
- `lastEventHash`;
- `lastTransitionHash`;
- `chainContinuity`;
- `mismatchReason`;
- `checkedAt`;
- `severity`.

Cold/legacy state with no trace is reported as `unknown` and does not imply corruption.

### 2. CausalityReport summary

Added `CausalityReport` with:

- `lastTraceId`;
- `lastEventId`;
- `revisionBefore`;
- `revisionAfter`;
- `changedDomains`;
- `trustStateBefore`;
- `trustStateAfter`;
- `gateVerdict`;
- `traceAvailable`.

### 3. CoreTrustReport extension

`CoreTrustReport` now has optional:

- `integrity`;
- `causality`.

Runtime `getCoreTrustReport()` populates both from current snapshot, last event and last transition.

### 4. Kernel Authority rule mapping

Added rule mapping:

- `integrity: unknown` is an evidence gap and does not automatically produce `COMPROMISED`;
- `integrity: broken` adds `integrity_broken` critical blocker and results in non-trusted state;
- `integrity: tampered` adds `integrity_tampered` panic blocker and results in `PANIC`;
- causality unavailable on legacy data is not corruption by itself;
- causality contradiction adds a critical blocker.

### 5. ActionGate Verdict reference

ActionGate Verdict v2 can include:

- `integrityStatus`;
- `traceId`.

ActionGate still does not define trust. It only carries integrity/causality references when they are supplied.

### 6. Recovery Planner hints

Recovery Planner now reacts to integrity/causality blockers:

- `integrity_broken` -> `RUN_REPLAY_CHECK`, `MANUAL_REVIEW`;
- `integrity_tampered` -> `RUN_REPLAY_CHECK`, `MANUAL_REVIEW`, `HALT_RUNTIME`;
- `causality_missing` -> `RUN_REPLAY_CHECK`, `INSPECT_TRACE`;
- `causality_contradiction` -> `RUN_REPLAY_CHECK`, `INSPECT_TRACE`, `MANUAL_REVIEW`.

## Tests

Added script:

```bash
npm run test:core:integrity-trust
```

Scenario file:

```txt
tests/scenarios/integrity-trust.ts
```

Covered:

1. integrity unknown does not make cold start compromised;
2. integrity valid keeps existing trust behavior;
3. integrity broken produces blocking reason;
4. tampered hash produces COMPROMISED or PANIC;
5. CoreTrustReport includes integrity summary;
6. CoreTrustReport includes causality summary;
7. ActionGate verdict includes trace/integrity reference if available;
8. Recovery plan suggests replay/manual review on broken integrity;
9. causality missing suggests replay or inspect trace;
10. integration does not mutate snapshot.

## Command results

```txt
npm run typecheck
EXIT=0

npm test
EXIT=0

npm run test:core:integrity-trust
EXIT=0
```

## Changed files

```txt
package.json
core/integrity/integrity-report.ts
core/contracts/src/actions.ts
core/gates/src/action-gate.ts
core/kernel/core-trust-report.ts
core/kernel/kernel-authority.ts
core/recovery/recovery-planner.ts
core/runtime/src/runtime-engine.ts
tests/scenarios/integrity-trust.ts
DELIVERY_REPORT_WAVE7_INTEGRITY_TRUST.md
```

## Risks and semantic conflicts

1. Snapshot Hash Chain role may later provide a richer canonical hash-chain module. This patch exposes an integration contract and lightweight report builder; semantic merge should preserve canonical hash implementation from the hash-chain owner if it differs.
2. Causality Trace role may later provide richer trace records. This patch consumes `TransitionTrace` and exposes a summary; semantic merge should map richer fields into `CausalityReport`.
3. `integrity: unknown` intentionally remains non-corruption for cold/legacy states. Changing that would violate the Wave 7 instruction and Wave 4 cold-start law.
4. `ActionGate` carries integrity/trace references but must not become Kernel Authority.
5. `RecoveryPlanner` suggests recovery actions only. It does not execute them.

## Intentionally not done

- Did not connect V1 or V2.
- Did not add UI.
- Did not add strategy logic.
- Did not add trading terminal or live trading.
- Did not add real exchange keys.
- Did not make ActionGate a trust authority.
- Did not mutate snapshot from integrity, causality, report or recovery planning.
