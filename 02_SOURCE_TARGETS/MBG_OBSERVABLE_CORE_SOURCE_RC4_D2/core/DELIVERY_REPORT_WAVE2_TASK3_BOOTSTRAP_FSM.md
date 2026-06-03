# MBG Core v0.1 — Wave 2 Task 3 Delivery Report

Task: Bootstrap FSM  
Canonical base: `mbg-core-v0.1-alpha1-followup.zip`  
Package status: task-level patch for Integration Owner; not a standalone canonical alpha2 release.

## Summary

Implemented an explicit `bootstrap` state domain and lifecycle reducer. Normal trading is denied by `ActionGate` until `bootstrap.status === "reconciled"`.

## Implemented

- Added `BootstrapStatus` and `BootstrapState`.
- Added `bootstrap` to `RuntimeSnapshot`.
- Added bootstrap lifecycle event types:
  - `bootstrap.loading_snapshot`
  - `bootstrap.replaying_tail`
  - `bootstrap.awaiting_exchange_truth`
  - `bootstrap.reconciled`
  - `bootstrap.failed`
  - `bootstrap.recovery_started`
- Added bootstrap reducer and lifecycle transition rules.
- Added `quarantineRequired` flag.
- Added blocking reasons:
  - `bootstrap_not_reconciled`
  - `bootstrap_failed`
  - `bootstrap_awaiting_exchange_truth`
- Updated risk/system reducers so bootstrap status contributes to blocked/degraded/healthy state.
- Updated `ActionGate` so normal actions are denied until bootstrap is reconciled.
- Preserved cold start truth:
  - `position.status === "unknown"`
  - `risk.status === "blocked"`
  - `bootstrap.status === "cold"`
- Added dedicated bootstrap FSM scenario test.
- Updated runtime audit and cold-start tests for explicit bootstrap domain.
- Updated constitution coverage for explicit bootstrap FSM.

## Changed files

- `CORE_CONSTITUTION.md`
- `RUNBOOK.md`
- `package.json`
- `core/contracts/src/events.ts`
- `core/state/src/types.ts`
- `core/transitions/src/reducers.ts`
- `core/runtime/src/runtime-engine.ts`
- `core/gates/src/action-gate.ts`
- `core/kernel/kernel-constitution.ts`
- `tests/scenarios/bootstrap-fsm.ts`
- `tests/scenarios/cold-start-unknown.ts`
- `tests/scenarios/gate-scenarios.ts`
- `tests/scenarios/audit-runtime.ts`
- `DELIVERY_REPORT_WAVE2_TASK3_BOOTSTRAP_FSM.md`

## Test results

Commands were run after `npm install`.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS |
| `npm run test:core:cold-start` | PASS |
| `npm run test:core:bootstrap` | PASS |
| `npm run verify` | PASS |

## Bootstrap FSM behavior

Allowed lifecycle:

```text
cold
  -> loading_snapshot
  -> replaying_tail
  -> awaiting_exchange_truth
  -> reconciled
```

Failure lifecycle:

```text
any state -> failed
failed -> recovery_started -> loading_snapshot
```

Forbidden lifecycle:

```text
failed -> reconciled
```

The direct `failed -> reconciled` event is ignored by the bootstrap reducer and does not change bootstrap status.

## Trading gate behavior

`PLACE_ORDER` is denied for all bootstrap statuses except `reconciled`.

Reasons:

- `cold`, `loading_snapshot`, `replaying_tail`: `bootstrap_not_reconciled`
- `awaiting_exchange_truth`: `bootstrap_awaiting_exchange_truth`
- `failed`: `bootstrap_failed`

## Risks / integration notes

- This patch intentionally adds a new `bootstrap` domain to `RuntimeSnapshot`, so downstream code assuming exactly six state domains must be updated.
- Historical persisted snapshots without `bootstrap` were not migrated in this task. Integration Owner should decide whether alpha2 needs a migration shim for old local runtime data. This task package was reset to a clean runtime state.
- Bootstrap lifecycle events are accepted as normal core events, but Wave 2 Task 3 does not implement the broader Event Validation task.
- The bootstrap lifecycle is deterministic in reducers, but invalid lifecycle attempts currently become no-op domain transitions while the global snapshot revision still advances because the event was committed. Full rejection belongs to Wave 2 Event Validation.

## Intentionally not done

- CoreTrustReport was not implemented.
- ExchangeTruth was not implemented.
- Freshness Guard was not implemented.
- Metadata as Events was not implemented.
- Event idempotency was not implemented.
- Signal Layer was not touched.
- Decision Engine was not touched.
- Strategy logic was not added.
- UI was not added.
- Live trading and exchange keys were not added.
- V1 was not connected.
