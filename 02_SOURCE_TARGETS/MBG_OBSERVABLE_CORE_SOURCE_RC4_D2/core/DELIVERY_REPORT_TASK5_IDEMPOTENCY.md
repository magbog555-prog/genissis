# MBG Core v0.1 Wave 2 — Task 5 Delivery Report

Task: Event Idempotency  
Base: `mbg-core-v0.1-alpha1-followup.zip`  
Delivered archive: `mbg-core-v0.1-alpha2-task5-idempotency.zip`

## Summary

Implemented runtime idempotency before event persistence and before reducer execution.

The same `eventId` can no longer mutate the core snapshot twice. Duplicate events do not increment revision and are not appended as canonical events. The runtime also checks secondary identities for fills, reconcile events, and exchange execution reports when those keys exist.

## Implemented

- Added `EventIdempotencyIndex`.
- Added canonical event fingerprinting.
- Added duplicate diagnostics:
  - `accepted`
  - `duplicate_ignored`
  - `duplicate_conflict`
- Added `commitEventWithDiagnostic()` for explicit audit/testing.
- Added `getIdempotencyView()` to expose index sizes and recent diagnostics.
- Rebuilt idempotency index from the persisted event journal during startup/recovery.
- Updated replay check to use idempotency-aware snapshot-first streaming tail.
- Added idempotency invariant `no_idempotency_conflicts`.
- Added dedicated test script `npm run test:core:idempotency`.
- Updated Core Constitution with LAW-011.
- Added Scenario Audit for Task 5.

## Changed files

- `package.json`
- `CORE_CONSTITUTION.md`
- `core/runtime/src/idempotency.ts`
- `core/runtime/src/runtime-engine.ts`
- `tests/scenarios/core-idempotency.ts`
- `SCENARIO_AUDIT_TASK5_IDEMPOTENCY.md`
- `DELIVERY_REPORT_TASK5_IDEMPOTENCY.md`

## Test commands and results

```txt
npm run typecheck
EXIT=0

npm test
EXIT=0

npm run test:core:idempotency
EXIT=0
```

## Coverage against requested tests

1. same `eventId` second time rejected/ignored — covered.
2. duplicate event does not change snapshot — covered.
3. duplicate event does not increase revision — covered.
4. duplicate fill does not change PnL twice — covered.
5. duplicate reconcile does not break state — covered.
6. replay after duplicate remains correct — covered.
7. existing tests continue to pass — `npm test` passed.

## Risks

- Secondary-key idempotency depends on keys being present in payloads. If an exchange report has no `fillId`, `tradeId`, `executionId`, `exchangeReportId`, `executionReportId`, `reportId`, or derivable report key, only `eventId` idempotency applies.
- Existing historical journals with already-applied duplicate canonical events may require a separate migration or full cold replay audit. This task prevents new duplicates from becoming canonical and rebuilds indexes from current journals.
- `duplicate_conflict` is recorded as a diagnostic and invariant failure, but this task does not implement Bootstrap FSM/PANIC transitions because that belongs to another Wave 2 task.

## Intentionally not done

- Did not connect V1.
- Did not modify Signal Layer.
- Did not add Decision Engine.
- Did not add strategy logic.
- Did not add UI.
- Did not enable live trading.
- Did not add exchange real keys.
- Did not implement CoreTrustReport.
- Did not implement ExchangeTruth.
- Did not implement Freshness Guard.
- Did not implement Metadata as Events.
