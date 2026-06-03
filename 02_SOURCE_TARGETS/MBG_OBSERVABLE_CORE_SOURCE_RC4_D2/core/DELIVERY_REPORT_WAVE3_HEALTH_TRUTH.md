# Delivery Report — Wave 3 / Health Truth Cleanup

## Task
Wave 3 — Health Truth Cleanup from canonical base `mbg-core-v0.1-alpha2`.

## Goal
Remove false health defaults and make runtime health report only what the core actually knows.

Primary law: **unknown is better than fake true**.

## Implemented

- Replaced fake `wsConnected: true` with explicit connection truth:
  - `true` — explicit accepted health event says websocket is connected;
  - `false` — explicit accepted health event says websocket is disconnected;
  - `unknown` — no observed websocket truth exists;
  - `stale` — observed websocket truth exists but is older than `MBG_HEALTH_CONNECTION_STATUS_TTL_MS`.
- Added `HealthTruthSnapshot` returned by `RuntimeEngine.getHealthSnapshot()`.
- Added `healthTruthComplete` and `healthTruthDiagnostics`.
- Added diagnostics:
  - `connection_state_unknown`;
  - `health_truth_partial`;
  - `ws_status_unknown`;
  - `connection_state_stale`.
- `/health` endpoint now returns runtime health truth instead of a static `{ ok: true }`.
- `wsReconnects` is now `"unknown"` unless real reconnect tracking is implemented later.
- Explicit `system.health.changed` events can update websocket health truth, without connecting a real WebSocket and without enabling live trading.

## Files Changed

- `apps/runtime-api/src/app.ts`
- `core/runtime/src/runtime-engine.ts`
- `package.json`
- `tests/scenarios/core-health-truth.ts`
- `SCENARIO_AUDIT_WAVE3_HEALTH_TRUTH.md`
- `DELIVERY_REPORT_WAVE3_HEALTH_TRUTH.md`

## Test Script Added

```bash
npm run test:core:health-truth
```

## Command Results

```text
npm run typecheck
EXIT=0

npm test
EXIT=0

npm run test:core:health-truth
EXIT=0
```

## Risks

- Connection truth is currently derived only from accepted `system.health.changed` events. No real WebSocket instrumentation was added by design.
- `healthTruthComplete` may remain false in normal cold runtime because reconcile/position and connection truth are intentionally unknown.
- `stale` threshold defaults to 30 seconds via `MBG_HEALTH_CONNECTION_STATUS_TTL_MS`; future ExchangeTruth/Freshness Guard work may want to centralize TTL policy.
- `/health` now returns an honest partial health object; any external caller that assumed static `ok: true` must adapt.

## Intentionally Not Done

- Did not connect V1 or V2.
- Did not add Signal Layer.
- Did not add Decision Engine.
- Did not add strategy logic.
- Did not add UI.
- Did not enable live trading.
- Did not add real exchange keys.
- Did not implement Kernel Authority or CoreTrustReport as a separate module.
- Did not implement ExchangeTruth Domain.
- Did not implement Freshness Guard.
- Did not modify Constitution directly; law proposal should be handed to the Constitution owner.
