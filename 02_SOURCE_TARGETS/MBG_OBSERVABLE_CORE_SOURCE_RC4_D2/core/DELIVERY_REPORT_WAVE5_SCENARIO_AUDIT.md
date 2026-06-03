# Delivery Report — Wave 5 Scenario Audit

Role: 7 — Scenario Audit / Test Owner

Canonical base: `mbg-core-v0.1-alpha4`

Target: `mbg-core-v0.1-alpha5`

## Scope

This delivery adds Wave 5 scenario-audit coverage for:

1. Recovery Planner.
2. Quarantine.
3. Permission Ledger.
4. Integration with Event Validation, Event Idempotency, ActionGate Verdict v2, Freshness Guard, Health Truth, and CoreTrustReport chain.

The audit intentionally does not implement runtime architecture or change runtime behavior.

## Files changed

```txt
package.json
tests/scenarios/wave5-scenario-audit.ts
DELIVERY_REPORT_WAVE5_SCENARIO_AUDIT.md
```

## Added script

```bash
npm run test:wave5:scenario-audit
```

The script runs:

```bash
npm run typecheck && tsx tests/scenarios/wave5-scenario-audit.ts
```

## Scenarios covered

```txt
1. invalid event -> quarantine record created.
2. invalid event -> not in canonical journal.
3. invalid event -> snapshot revision unchanged.
4. idempotency conflict -> quarantine or diagnostic record.
5. denied PLACE_ORDER -> Permission Ledger record exists.
6. allowed diagnostic action -> Permission Ledger record exists.
7. cold start -> Recovery Planner suggests RECONCILE_POSITION / RECONCILE_ORDERS.
8. market stale -> Recovery Planner suggests REFRESH_MARKET_DATA.
9. health unknown -> Recovery Planner suggests CHECK_HEALTH.
10. Recovery Planner does not mutate snapshot.
```

## Wave 5 coverage mapping

```txt
Quarantine:
- invalid event creates quarantine record
- invalid event is excluded from canonical journal
- invalid event does not bump revision
- idempotency conflict is quarantined or diagnosable

Permission Ledger:
- denied PLACE_ORDER is recorded
- allowed diagnostic/recovery action is recorded

Recovery Planner:
- cold start suggestions include position/order reconciliation
- stale market suggestions include market data refresh
- unknown health suggestions include health check
- planner reads state and suggests only; it does not mutate snapshot
```

## Commands run on alpha4

```bash
npm install
```

Result: passed.

```bash
npm run typecheck
```

Result: passed.

```bash
npm run test:wave5:scenario-audit
```

Result on alpha4: failed on expected Wave 5 implementation gaps.

Observed alpha4 result:

```json
{
  "name": "wave5_scenario_audit",
  "total": 10,
  "passed": 3,
  "failed": 7
}
```

The passing alpha4 scenarios are the already-existing canonical journal / revision / idempotency safety checks. The failing scenarios require Wave 5 Quarantine, Permission Ledger, and Recovery Planner APIs.

## Expected alpha5 result

After Wave 5 implementation roles are merged, the audit should pass fully:

```json
{
  "name": "wave5_scenario_audit",
  "total": 10,
  "passed": 10,
  "failed": 0
}
```

## Required alpha5 integration surfaces

The audit expects the integrated alpha5 runtime to expose equivalent callable surfaces for:

```txt
Quarantine:
- getQuarantineView()
  or getQuarantineRecords()
  or getQuarantine()
  or getQuarantinedEvents()

Permission Ledger:
- getPermissionLedgerView()
  or getPermissionLedger()
  or getPermissionsLedgerView()

Recovery Planner:
- getRecoveryPlan()
  or getRecoveryPlannerView()
  or getRecoverySuggestions()
  or planRecovery()
```

Equivalent APIs are acceptable if they return the same semantic information and the scenario audit is updated by the integration owner without changing runtime behavior.

## Risks and gaps

Alpha4 does not yet expose Wave 5 Quarantine, Permission Ledger, or Recovery Planner APIs.

The test checks observable behavior only. It does not prescribe storage implementation details.

The idempotency conflict scenario allows either a quarantine record or an idempotency diagnostic record, because the task card explicitly allows “quarantine or diagnostic record”.

Recovery Planner suggestions are asserted as machine-readable text/codes. Integration should preserve stable codes such as:

```txt
RECONCILE_POSITION
RECONCILE_ORDERS or RECONCILE_ORDER
REFRESH_MARKET_DATA
CHECK_HEALTH
```

## Intentionally not done

```txt
CORE_CONSTITUTION.md was not changed.
Runtime behavior was not changed.
ActionGate logic was not changed.
V1/V2 were not connected.
Signal Layer was not touched.
Decision Engine was not touched.
Strategy logic was not added.
UI was not added.
Live trading was not enabled.
Real exchange keys were not added.
Real exchange calls were not added.
Automatic recovery execution was not added.
Recovery Planner execution side effects were not added.
```
