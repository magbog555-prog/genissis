# INTEGRATION_REPORT_ALPHA5

## Status

`mbg-core-v0.1-alpha5` integration completed.

`npm run verify`: PASS / exit code `0`.

## Base

Canonical base:

`mbg-core-v0.1-alpha4.zip`

## Inputs

- Role 2: `mbg-core-wave5-constitution-deliverables.zip`
- Role 4: `роль 4.5.zip` — Recovery Planner
- Role 5: `роль 5.5.zip` — Quarantine
- Role 6: `роль 6.5.zip` — Permission Ledger
- Role 7 final: `role7_wave5_all_artifacts (1).zip` — Wave 5 Scenario Audit

Important: the earlier `роль 7.5.zip` was not used as final scenario audit input because it used local test adapters. The accepted final role 7 input is `role7_wave5_all_artifacts (1).zip`.

## Semantic Merge Summary

Wave 5 was integrated by semantic merge on top of canonical alpha4, not by replacing the project with a role archive.

### Constitution

Constitution was taken only from Role 2:

- `CORE_CONSTITUTION.md`
- `core/kernel/kernel-constitution.ts`
- constitution test updates

### Recovery Planner

Integrated from Role 4:

- `core/recovery/recovery-planner.ts`
- `tests/scenarios/recovery-planner.ts`
- package script `test:core:recovery-planner`

Semantic decision:

Recovery Planner proposes recovery only. It does not execute recovery, does not write events, does not mutate runtime state, does not call an exchange, and does not enable trading.

### Quarantine

Integrated from Role 5:

- `core/quarantine/quarantine.ts`
- runtime integration in `commitEventResult()`
- `tests/scenarios/core-quarantine.ts`
- package script `test:core:quarantine`

Semantic decision:

Quarantine stores bad or untrusted data outside the canonical journal. It does not mutate the runtime snapshot and is not part of the canonical event journal.

Runtime surfaces exposed:

- `getQuarantineView()`
- `getQuarantineRecords()`
- `getQuarantine()`
- `getQuarantinedEvents()`

### Permission Ledger

Integrated from Role 6:

- `core/permissions/permission-ledger.ts`
- runtime integration for ActionGate allow/deny decisions
- `tests/scenarios/core-permission-ledger.ts`
- package script `test:core:permission-ledger`

Semantic decision:

Permission Ledger records permission decisions and denials. It is not an authority, does not grant permissions by itself, does not bypass ActionGate, and does not mutate trading state.

Runtime surfaces exposed:

- `getPermissionLedgerView()`
- `getPermissionLedger()`
- `getPermissionsLedgerView()`

### Wave 5 Scenario Audit

Integrated from final accepted Role 7 package:

- `tests/scenarios/wave5-scenario-audit.ts`
- package script `test:wave5:scenario-audit`
- delivery report

The scenario audit uses the real integrated modules and runtime surfaces:

- Recovery Planner
- Quarantine
- Permission Ledger

It does not use local production-contract substitutes such as `ScenarioAuditQuarantine`, `ScenarioAuditPermissionLedger`, or a local `planRecovery`.

Recovery surfaces exposed:

- `getRecoveryPlan()`
- `getRecoveryPlannerView()`
- `getRecoverySuggestions()`
- `planRecovery()`

## Conflicts and Resolutions

No unresolved semantic conflict remained.

Integration resolutions:

1. Role 7 input conflict:
   - rejected old `роль 7.5.zip` as final scenario audit source;
   - used final accepted `role7_wave5_all_artifacts (1).zip`.

2. Runtime surface compatibility:
   - added equivalent public runtime surfaces required by the final scenario audit while preserving semantics.

3. Quarantine/journal boundary:
   - invalid or quarantined data can be recorded in quarantine diagnostics;
   - quarantine records do not become canonical journal events and do not mutate snapshot state.

4. Permission Ledger/ActionGate boundary:
   - Permission Ledger records ActionGate decisions;
   - ActionGate remains the gate;
   - Permission Ledger does not authorize actions.

5. Recovery Planner boundary:
   - recovery suggestions are calculated and exposed;
   - no automatic recovery action is performed.

## Verify Scope

`npm run verify` includes:

```bash
npm run reset:runtime && npm run typecheck && npm test && npm run test:core-constitution && npm run test:core:cold-start && npm run test:core:bootstrap && npm run test:core:event-validation && npm run test:core:idempotency && npm run test:wave2:scenario-audit && npm run test:core:exchange-truth && npm run test:core:freshness && npm run test:core:health-truth && npm run test:wave3:scenario-audit && npm run test:core:kernel-authority && npm run test:core:trust-report && npm run test:core:action-gate-verdict && npm run test:wave4:scenario-audit && npm run test:core:recovery-planner && npm run test:core:quarantine && npm run test:core:permission-ledger && npm run test:wave5:scenario-audit && npm run audit:runtime
```

## Check Results

All checks completed successfully:

- `npm ci`: PASS
- `npm run typecheck`: PASS
- `npm test`: PASS
- `npm run test:core-constitution`: PASS
- `npm run test:core:cold-start`: PASS
- `npm run test:core:bootstrap`: PASS
- `npm run test:core:event-validation`: PASS
- `npm run test:core:idempotency`: PASS
- `npm run test:wave2:scenario-audit`: PASS
- `npm run test:core:exchange-truth`: PASS
- `npm run test:core:freshness`: PASS
- `npm run test:core:health-truth`: PASS
- `npm run test:wave3:scenario-audit`: PASS
- `npm run test:core:kernel-authority`: PASS
- `npm run test:core:trust-report`: PASS
- `npm run test:core:action-gate-verdict`: PASS
- `npm run test:wave4:scenario-audit`: PASS
- `npm run test:core:recovery-planner`: PASS
- `npm run test:core:quarantine`: PASS
- `npm run test:core:permission-ledger`: PASS
- `npm run test:wave5:scenario-audit`: PASS 10/10
- `npm run audit:runtime`: PASS
- `npm run verify`: PASS / exit code `0`

## Non-Goals Confirmed

The following were not added:

- V1
- V2
- Signal Layer
- Decision Engine
- strategy logic
- UI
- live trading
- real exchange keys

## Final Package

Target package:

`mbg-core-v0.1-alpha5.zip`
