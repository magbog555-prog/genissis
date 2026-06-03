# MBG Core v0.1 Wave 2 — Task 4 Delivery Report

Task: Event Validation inside Core  
Canonical base: `mbg-core-v0.1-alpha1-followup.zip`  
Output package: `mbg-core-v0.1-alpha2-task4-event-validation.zip`

## Summary

Implemented core-side domain event validation before journal append and before reducer application.

The runtime no longer trusts API-level validation alone. Events submitted through the runtime commit path are validated inside core before persistence or state transition. Invalid events return a diagnostic rejection result and leave the canonical journal, in-memory event window, snapshot, and revision unchanged.

## Implemented

- Added `core/events/validate-domain-event.ts`.
- Added `RuntimeEngine.commitEventResult()` for diagnostic accept/reject results.
- Routed `commitEvent()` and `commitEventSilent()` through core validation.
- Kept reducer/replay behavior deterministic and separate from validation.
- Added `source` and optional `schemaVersion` fields to the domain event envelope.
- Updated `makeEvent()` to attach `source: "core"` by default.
- Updated core `PLACE_ORDER` event creation to include `orderId`, `clientOrderId`, and provider metadata.
- Added focused scenario test for event validation.
- Added `npm run test:core:event-validation`.
- Updated `CORE_CONSTITUTION.md` with the Wave 2 event-validation law.

## Validation rules covered

Generic event validation:

- `eventId` is required.
- `eventType` must be one of the known core event types.
- `timestamp` must be valid.
- `timestamp` must not be beyond future tolerance.
- optional `schemaVersion`, when present, must be `1` or `v1`.
- payload must be an object.
- source/provider/diagnostic reason must be present where required.

Market tick validation:

- `symbol` required.
- `price > 0`.
- `bid > 0`.
- `ask > 0`.
- `bid <= ask`.
- `volume >= 0`.
- source/provider required.

Order/fill validation:

- `orderId` required.
- `quantity > 0`.
- `symbol` required.
- `side` must be `buy` or `sell`.
- source/provider required.
- `fillId` required for `order.execution.reported`.

## Changed files

- `CORE_CONSTITUTION.md`
- `core/contracts/src/events.ts`
- `core/events/validate-domain-event.ts`
- `core/runtime/src/runtime-engine.ts`
- `package.json`
- `tests/scenarios/core-event-validation.ts`
- `tests/scenarios/gate-scenarios.ts`
- `DELIVERY_REPORT_TASK4_EVENT_VALIDATION.md`

## Tests

Executed locally after `npm install`:

```text
npm run typecheck
PASS

npm test
PASS

npm run test:core:event-validation
PASS
```

Observed command output summary:

```text
> tsc --noEmit
(no errors)

> tsx tests/scenarios/gate-scenarios.ts
5 gate scenario base checks passed

> tsx tests/scenarios/core-event-validation.ts
core event validation checks passed
```

## Risks

- Existing non-test runtime paths that create order execution events without `fillId` will now be rejected by the core validator. This is intentional for Task 4, but integration owners should audit scenario scripts and API debug endpoints that emit historical fill-like events.
- Market ticks now require `bid`, `ask`, `volume`, and provider/source. This is stricter than the older optional contract and may require callers to provide full tick payloads.
- The rejection diagnostic is returned from `commitEventResult()`. The legacy `commitEvent()` compatibility method returns the current snapshot on rejection to avoid breaking existing callers.

## Intentionally not done

- No quarantine persistence for rejected events.
- No event idempotency implementation.
- No Bootstrap FSM implementation.
- No CoreTrustReport implementation.
- No ExchangeTruth implementation.
- No Freshness Guard implementation.
- No Metadata-as-Events implementation.
- No V1, Signal Layer, Decision Engine, strategy, UI, live trading, or exchange-key integration.
