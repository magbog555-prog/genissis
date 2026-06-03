# Scenario Audit — Wave 5 / Permission Ledger

## PL-001 — Denied PLACE_ORDER is auditable

Given cold runtime state.  
When `PLACE_ORDER` is evaluated and denied by ActionGate.  
Then Permission Ledger can record the verdict with `allowed=false`, `gateVersion=action-gate-v2`, blocking reasons, snapshot revision, trust state, requester and decision time.

Evidence: `npm run test:core:permission-ledger`

## PL-002 — Allowed diagnostic-class verdict is auditable

Given an allowed diagnostic-class verdict.  
When the verdict is recorded.  
Then Permission Ledger stores `allowed=true`, `actionClass=DIAGNOSTIC`, `kernelTrustState`, `requestedBy`, `decidedAt`, and a decision hash.

Evidence: `npm run test:core:permission-ledger`

## PL-003 — Snapshot revision is preserved

Given a recorded denied verdict.  
When the ledger record is inspected.  
Then `snapshotRevision` equals the verdict snapshot revision and runtime snapshot revision.

Evidence: `npm run test:core:permission-ledger`

## PL-004 — Kernel trust state is preserved

Given a recorded verdict.  
When the ledger record is inspected.  
Then `kernelTrustState` equals the verdict trust state and is not recomputed by the ledger.

Evidence: `npm run test:core:permission-ledger`

## PL-005 — Blocking reasons are preserved

Given a denied `PLACE_ORDER`.  
When the verdict is recorded.  
Then `blockingReasons` include the ActionGate reasons such as `bootstrap_not_reconciled` and `exchange_truth_unknown`.

Evidence: `npm run test:core:permission-ledger`

## PL-006 — Ledger does not mutate snapshot

Given a runtime snapshot before recording.  
When a verdict is recorded in Permission Ledger.  
Then the runtime snapshot JSON remains unchanged.

Evidence: `npm run test:core:permission-ledger`

## PL-007 — Last N export is available and safe

Given five recorded decisions.  
When `last(2)` is exported.  
Then exactly the last two records are returned and mutating the exported copy does not mutate ledger internals.

Evidence: `npm run test:core:permission-ledger`
