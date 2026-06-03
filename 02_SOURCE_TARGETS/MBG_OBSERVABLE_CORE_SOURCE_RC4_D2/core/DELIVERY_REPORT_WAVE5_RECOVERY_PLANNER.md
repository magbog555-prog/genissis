# Delivery Report — Wave 5 / Recovery Planner

## Role

Role 4 — Recovery Planner task implementation.

## Canonical base

`mbg-core-v0.1-alpha4.zip`

## Scope implemented

Created a pure Recovery Planner module that consumes CoreTrustReport and related evidence and returns a proposed RecoveryPlan.

Implemented module:

- `core/recovery/recovery-planner.ts`

Added test scenario:

- `tests/scenarios/recovery-planner.ts`

Added npm script:

- `npm run test:core:recovery-planner`

## Recovery Planner contract

The planner exports:

- `RECOVERY_PLANNER_VERSION`
- `RECOVERY_ACTION_TYPE`
- `RecoveryActionType`
- `RecoveryMode`
- `RecoveryPriority`
- `QuarantineSummary`
- `RecoveryPlannerInput`
- `RecoveryPlan`
- `planRecovery`
- `RecoveryPlanner.plan`

## RecoveryPlan fields

- `required`
- `mode`
- `reasons`
- `nextActions`
- `forbiddenActions`
- `priority`
- `manualReviewRequired`
- `plannerVersion`

## Recovery actions supported

- `RECONCILE_POSITION`
- `RECONCILE_ORDERS`
- `SYNC_FILLS`
- `REFRESH_MARKET_DATA`
- `CHECK_HEALTH`
- `RUN_REPLAY_CHECK`
- `INSPECT_QUARANTINE`
- `HALT_RUNTIME`
- `MANUAL_REVIEW`

## Rules implemented

1. `position_unknown` / bootstrap position uncertainty suggests `RECONCILE_POSITION`.
2. `exchangeTruth unknown/stale/unavailable` suggests `RECONCILE_POSITION` and `RECONCILE_ORDERS`.
3. `exchangeTruth conflicted` suggests position/order reconcile, fill sync, and manual review.
4. stale/unknown market freshness suggests `REFRESH_MARKET_DATA`.
5. health unknown/partial/stale suggests `CHECK_HEALTH`.
6. replay mismatch or `COMPROMISED` suggests `RUN_REPLAY_CHECK` and `MANUAL_REVIEW`.
7. `PANIC` suggests `HALT_RUNTIME` and `MANUAL_REVIEW`.
8. quarantine count greater than zero suggests `INSPECT_QUARANTINE`.
9. `TRUSTED` without quarantine items returns recovery not required.
10. Planner does not mutate snapshot, report, events, persistence, or external systems.

## Changed files

- `package.json`
- `core/recovery/recovery-planner.ts`
- `tests/scenarios/recovery-planner.ts`

## Test results

```text
npm run typecheck
PASS

npm test
PASS

npm run test:core:recovery-planner
PASS
```

## Test coverage

- cold start -> recovery required, position/exchange reconcile suggested
- market stale -> refresh market data suggested
- health unknown -> check health suggested
- compromised -> replay check + manual review suggested
- panic -> halt runtime + manual review suggested
- trusted -> recovery not required
- quarantine count > 0 -> inspect quarantine suggested
- planner does not mutate snapshot/report

## Intentional non-work

Did not implement:

- recovery action execution
- event writes
- snapshot mutation
- exchange calls
- real exchange clients
- V1/V2 integration
- Signal Layer
- Decision Engine
- strategy logic
- UI
- live trading
- real exchange keys
- standalone large Recovery Planner system beyond the pure planning module

## Risks / integration notes

1. `RecoveryPlannerInput` consumes `CoreTrustReport` and optionally duplicated evidence fields for semantic merge flexibility. Integration Owner should decide whether later alpha versions want a narrower constructor.
2. The current `CoreTrustReport` does not directly expose `position`; planner infers `position_unknown` from machine-readable blocking reasons. This avoids changing alpha4 report shape in this task.
3. Quarantine is represented as a summary input only. The planner does not create, read, or mutate quarantine storage.
4. Forbidden actions intentionally include side-effect boundaries (`WRITE_EVENTS`, `MUTATE_SNAPSHOT`, `CALL_EXCHANGE`) to prove this module is advisory only.
