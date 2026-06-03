# MBG Core v0.1 — Wave 3 Scenario Audit v2 Delivery Report

Role: 7 — Scenario Audit / Test Owner  
Canonical base: `mbg-core-v0.1-alpha2`  
Target: alpha3 acceptance after Wave 3 runtime roles are merged

## Scope

This delivery updates the Wave 3 scenario audit to test the approved runtime contracts from roles 4, 5, and 6.

The audit does not introduce new runtime behavior and does not define new event aliases in the core.

## Corrected Event Contracts

Removed from the scenario audit:

- `exchange.truth.reported`
- `exchange.connection.changed`

Used approved Wave 3 contracts instead:

- `exchange_truth.reconcile_succeeded`
- `exchange_truth.stale_detected`
- `exchange_truth.conflict_detected`
- `exchange_truth.unavailable_detected`
- `system.health.changed`

## Changed Files

- `package.json`
- `tests/scenarios/wave3-scenario-audit.ts`
- `DELIVERY_REPORT_WAVE3_SCENARIO_AUDIT_V2.md`

## Added Script

```bash
npm run test:wave3:scenario-audit
```

The script runs:

```bash
npm run typecheck && tsx tests/scenarios/wave3-scenario-audit.ts
```

## Scenario Coverage

1. cold start -> exchangeTruth unknown -> PLACE_ORDER denied
2. bootstrap reconciled, but exchangeTruth unknown -> denied
3. exchangeTruth stale -> denied
4. exchangeTruth conflicted -> denied
5. exchangeTruth unavailable -> denied
6. market data stale -> denied
7. connection state unknown -> not healthy / denied where applicable
8. wsConnected unknown is not true
9. bootstrap reconciled + exchangeTruth fresh + market fresh + valid position -> allow only if ActionGate allows
10. local flat position + exchange conflict -> denied

## Wave 3 Areas Covered

- ExchangeTruth Domain
- Freshness Guard
- Health Truth Cleanup
- Combined safety
- ActionGate integration boundary

## Commands Run

On the available `mbg-core-v0.1-alpha2` base:

```bash
npm install
npm run typecheck
npm run test:wave3:scenario-audit
```

Observed alpha2 result:

- `npm install`: passed
- `npm run typecheck`: passed
- `npm run test:wave3:scenario-audit`: fails on expected Wave 3 integration gaps in alpha2

Expected alpha3 result after merging roles 4, 5, and 6:

```json
{
  "name": "wave3_scenario_audit",
  "total": 10,
  "passed": 10,
  "failed": 0
}
```

## Known Alpha2 Gaps Exposed by This Audit

- `RuntimeSnapshot.exchangeTruth` is not present in alpha2.
- `exchange_truth.reconcile_succeeded` is not present in alpha2 contracts.
- `exchange_truth.stale_detected` is not present in alpha2 contracts.
- `exchange_truth.conflict_detected` is not present in alpha2 contracts.
- `exchange_truth.unavailable_detected` is not present in alpha2 contracts.
- `system.health.changed` exists in alpha2 but Health Truth Cleanup is not complete.
- `getHealthSnapshot().wsConnected` is still not governed by the Wave 3 health truth contract in alpha2.

## Risks and Gaps

- The test uses rich payloads for ExchangeTruth events to satisfy likely role 5 validation requirements. If role 4/5 finalize narrower field names, the payload helper may need a small compatibility adjustment without changing scenario intent.
- The positive allow scenario intentionally asserts that `PLACE_ORDER` can be allowed only after bootstrap, ExchangeTruth, market freshness, position, and health inputs are all valid. If ActionGate adds additional blocking requirements in alpha3, that scenario should be updated to reflect the final ActionGate contract rather than bypassing it.
- This audit does not implement ExchangeTruth, Freshness Guard, Health Truth Cleanup, CoreTrustReport, Kernel Authority, UI, V1/V2, Signal Layer, Decision Engine, strategy logic, live trading, or exchange connectivity.

## Intentionally Not Done

- Did not modify `CORE_CONSTITUTION.md`.
- Did not modify runtime behavior.
- Did not add runtime event aliases.
- Did not add strategy logic.
- Did not connect V1 or V2.
- Did not add UI.
- Did not enable live trading.
- Did not add real exchange keys.
- Did not implement Kernel Authority / CoreTrustReport.
