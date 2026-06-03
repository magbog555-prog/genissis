# MBG Core v0.1 Wave 2 — Scenario Audit: Task 5 Event Idempotency

Scope: Event Idempotency only. No V1, Signal Layer, Decision Engine, strategy logic, UI, live trading, CoreTrustReport, ExchangeTruth, Freshness Guard, or Metadata-as-Events were added.

## Scenario T5-IDEMP-001 — Duplicate eventId is ignored

Given an accepted `market.tick.received` event  
When the exact same event with the same `eventId` is committed again  
Then the result is `duplicate_ignored`, the snapshot is unchanged, revision is unchanged, and the duplicate is not appended as a canonical event.

Evidence: `tests/scenarios/core-idempotency.ts`, `npm run test:core:idempotency`

## Scenario T5-IDEMP-002 — Duplicate eventId conflict is rejected

Given an accepted event with `eventId=evt-market-1`  
When another event with the same `eventId` but a different canonical payload is committed  
Then the result is `duplicate_conflict`, the snapshot is unchanged, revision is unchanged, and an idempotency conflict diagnostic is recorded.

Evidence: `tests/scenarios/core-idempotency.ts`, `npm run test:core:idempotency`

## Scenario T5-IDEMP-003 — Duplicate fill is not applied twice

Given an accepted `order.execution.reported` event with `fillId=fill-1`  
When another execution event with a new `eventId` but the same `fillId` and same payload arrives  
Then the result is `duplicate_ignored`, position is unchanged, revision is unchanged, and reducers are not run again.

Evidence: `tests/scenarios/core-idempotency.ts`, `npm run test:core:idempotency`

## Scenario T5-IDEMP-004 — Duplicate fill does not change PnL twice

Given a PnL engine that processed `pnl-fill-1` once  
When the same fill is submitted again  
Then `processedFillIds` remains unique, `duplicateFillIds` records the duplicate, position remains unchanged, and net PnL remains unchanged.

Evidence: `tests/scenarios/core-idempotency.ts`, `npm run test:core:idempotency`

## Scenario T5-IDEMP-005 — Duplicate reconcile is not applied twice

Given an accepted `position.reconciled` event with `reconcileId=reconcile-1`  
When another reconcile event with a new `eventId` but same `reconcileId` and payload arrives  
Then the result is `duplicate_ignored`, snapshot is unchanged, and revision is unchanged.

Evidence: `tests/scenarios/core-idempotency.ts`, `npm run test:core:idempotency`

## Scenario T5-IDEMP-006 — Replay remains correct after duplicates

Given duplicates were submitted and ignored before canonical journal append  
When `replayCheck()` runs  
Then replay remains ok and replay revision equals current revision.

Evidence: `tests/scenarios/core-idempotency.ts`, `npm run test:core:idempotency`

## Scenario T5-IDEMP-007 — Recovery restores eventId index

Given an engine with persisted accepted events  
When a new engine instance recovers from disk  
Then the idempotency index is rebuilt from the event journal and a duplicate of an already persisted event is ignored without changing snapshot or revision.

Evidence: `tests/scenarios/core-idempotency.ts`, `npm run test:core:idempotency`
