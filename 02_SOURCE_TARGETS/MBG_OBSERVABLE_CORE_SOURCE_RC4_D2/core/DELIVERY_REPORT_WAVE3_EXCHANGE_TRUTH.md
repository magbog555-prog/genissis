# MBG Core v0.1 — Wave 3 Delivery Report
## Task: ExchangeTruth Domain

Canonical base: `mbg-core-v0.1-alpha2`

## Summary

Implemented a dedicated `exchangeTruth` state domain that records whether local core state is confirmed by exchange-derived truth.

The domain starts as `unknown` on cold start and blocks normal trading unless it is `fresh`.

No real exchange client, Binance client, live trading, UI, V1/V2 integration, Signal Layer, Decision Engine, strategy logic, Kernel Authority, or CoreTrustReport module was added.

## Implemented

- Added `ExchangeTruthState` and `ExchangeTruthStatus`.
- Added `exchangeTruth` to `RuntimeSnapshot`.
- Added cold-start state:
  - `exchangeTruth.status = "unknown"`
  - `exchangeTruth.reason = "exchange_truth_unknown"`
- Added ExchangeTruth events:
  - `exchange_truth.reconcile_started`
  - `exchange_truth.reconcile_succeeded`
  - `exchange_truth.reconcile_failed`
  - `exchange_truth.stale_detected`
  - `exchange_truth.conflict_detected`
  - `exchange_truth.unavailable_detected`
- Added payload schemas:
  - `ExchangeTruthPayloadSchema`
  - `ExchangeTruthDriftSchema`
  - `ExchangeTruthConflictSchema`
- Added event validation for ExchangeTruth events.
- Added `reduceExchangeTruthState`.
- Integrated ExchangeTruth into `reduceSnapshot`, transition traces, runtime views, entity views, health snapshot, and invariants.
- Added ActionGate blocking for non-fresh exchange truth.
- Added `npm run test:core:exchange-truth`.
- Updated existing cold-start/bootstrap/gate scenarios so they remain compatible with the new ExchangeTruth law.

## Core laws enforced

1. Cold start has `exchangeTruth.status = "unknown"`.
2. `PLACE_ORDER` is denied when ExchangeTruth is:
   - `unknown`
   - `stale`
   - `conflicted`
   - `unavailable`
3. Local flat / exchange open mismatch becomes `exchangeTruth.status = "conflicted"`.
4. Stale detection becomes `exchangeTruth.status = "stale"`.
5. Fresh ExchangeTruth does not bypass Bootstrap FSM.
6. Normal trading requires both:
   - `bootstrap.status === "reconciled"`
   - `exchangeTruth.status === "fresh"`
   - plus the existing ActionGate requirements.

## Changed files

- `CORE_CONSTITUTION.md`
- `RUNBOOK.md`
- `package.json`
- `core/contracts/src/events.ts`
- `core/events/validate-domain-event.ts`
- `core/gates/src/action-gate.ts`
- `core/runtime/src/runtime-engine.ts`
- `core/state/src/types.ts`
- `core/transitions/src/reducers.ts`
- `tests/scenarios/bootstrap-fsm.ts`
- `tests/scenarios/cold-start-unknown.ts`
- `tests/scenarios/gate-scenarios.ts`
- `tests/scenarios/exchange-truth.ts`
- `DELIVERY_REPORT_WAVE3_EXCHANGE_TRUTH.md`

## Tests

### Requested commands

```bash
npm run typecheck
```

Result: PASS

```bash
npm test
```

Result: PASS

```bash
npm run test:core:exchange-truth
```

Result: PASS

### Compatibility checks also run

```bash
npm run test:core:cold-start
```

Result: PASS

```bash
npm run test:core:bootstrap
```

Result: PASS

## Command output summary

- `npm run typecheck` exited with code `0`.
- `npm test` exited with code `0`.
- `npm run test:core:exchange-truth` exited with code `0`.
- `npm run test:core:cold-start` exited with code `0`.
- `npm run test:core:bootstrap` exited with code `0`.

## Risks

- `RuntimeSnapshot` now has an additional state domain: `exchangeTruth`. Any integration code that assumes the previous exact list of domains must be semantically merged.
- `ActionGate` now denies normal trading after bootstrap reconciliation if ExchangeTruth is not `fresh`. This intentionally changes previous alpha2 scenarios that allowed trading after bootstrap + position/market reconcile alone.
- `ExchangeTruthPayloadSchema` is intentionally minimal and does not imply a real exchange adapter contract.
- Conflict detection currently supports the mandatory local-flat / exchange-open law and explicit conflict payloads. Broader drift semantics are left for later Wave 3/Kernel Authority work.

## Intentionally not done

- No V1 integration.
- No V2 integration.
- No Signal Layer.
- No Decision Engine.
- No strategy logic.
- No UI.
- No live trading.
- No real exchange keys.
- No Binance client.
- No full Kernel Authority module.
- No CoreTrustReport module.
- No Freshness Guard beyond explicit `exchange_truth.stale_detected` event handling.
- No real exchange polling/reconcile adapter.
