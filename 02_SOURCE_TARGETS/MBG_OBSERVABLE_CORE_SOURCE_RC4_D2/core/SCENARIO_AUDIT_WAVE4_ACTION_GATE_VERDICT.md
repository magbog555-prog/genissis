# MBG Core v0.1 — Wave 4 Scenario Audit — ActionGate Verdict v2

## Scope

Role 6 scenario audit for ActionGate Verdict v2.

## AGV2-001 — Cold start normal action denied

Given a cold runtime snapshot.  
When `PLACE_ORDER` is evaluated.  
Then the verdict is denied and includes:

- `allowed=false`
- `decision=deny`
- `reason=bootstrap_not_reconciled`
- `blockingReasons` includes `bootstrap_not_reconciled`
- `blockingReasons` includes `exchange_truth_unknown`
- `blockingReasons` includes `connection_state_unknown`
- `gateVersion=action-gate-v2`
- `snapshotRevision`

Evidence: `tests/scenarios/core-action-gate-verdict.ts`

## AGV2-002 — ExchangeTruth unknown denied

Given bootstrap and position are reconciled, but ExchangeTruth remains unknown.  
When `PLACE_ORDER` is evaluated.  
Then the verdict is denied and includes:

- `reason=exchange_truth_unknown`
- `blockingReasons` includes `exchange_truth_unknown`
- related invariant `exchange_truth_must_be_fresh_before_normal_action`

Evidence: `tests/scenarios/core-action-gate-verdict.ts`

## AGV2-003 — Freshness stale denied

Given otherwise trusted state with stale market data.  
When `PLACE_ORDER` is evaluated.  
Then the verdict is denied and includes:

- `reason=market_data_stale`
- `blockingReasons` includes `market_data_stale`
- related invariant `market_data_must_be_fresh_before_normal_action`

Evidence: `tests/scenarios/core-action-gate-verdict.ts`

## AGV2-004 — Health unknown denied

Given bootstrap, position, market data, and ExchangeTruth are ready, but websocket health truth is unknown.  
When `PLACE_ORDER` is evaluated.  
Then the verdict is denied and includes:

- `reason=connection_state_unknown`
- `blockingReasons` includes `connection_state_unknown`
- related invariant `health_truth_must_be_known_before_normal_action`

Evidence: `tests/scenarios/core-action-gate-verdict.ts`

## AGV2-005 — Trusted state allows normal action

Given bootstrap reconciled, ExchangeTruth fresh, market data fresh, position known, risk clear, and health truth connected.  
When `PLACE_ORDER` is evaluated.  
Then the verdict allows the action and includes:

- `allowed=true`
- `decision=allow`
- `gateVersion=action-gate-v2`
- `kernelTrustState=trusted`
- empty `blockingReasons`

Evidence: `tests/scenarios/core-action-gate-verdict.ts`

## AGV2-006 — Recovery action remains allowed

Given cold start where normal trading is denied.  
When `RECONCILE_POSITION` is evaluated.  
Then the verdict allows the action and includes:

- `actionClass=RECOVERY`
- `allowed=true`
- `gateVersion=action-gate-v2`
- `snapshotRevision`

Evidence: `tests/scenarios/core-action-gate-verdict.ts`

## Command evidence

```txt
npm run typecheck
EXIT=0

npm test
EXIT=0

npm run test:core:action-gate-verdict
EXIT=0
```
