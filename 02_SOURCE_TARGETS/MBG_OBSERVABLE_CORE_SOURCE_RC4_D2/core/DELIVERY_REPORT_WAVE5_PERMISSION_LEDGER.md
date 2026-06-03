# Delivery Report — Wave 5 / Role 6 / Permission Ledger

## Scope

Canonical base: `mbg-core-v0.1-alpha4.zip`.

Task: create an audit-only Permission Ledger for ActionGate Verdict v2 decisions.

## Implemented

- Added `core/permissions/permission-ledger.ts`.
- Added `PermissionRecord` with:
  - `permissionId`
  - `action`
  - `allowed`
  - `actionClass`
  - `snapshotRevision`
  - `kernelTrustState`
  - `blockingReasons`
  - `allowedAlternatives`
  - `gateVersion`
  - `requestedBy`
  - `decidedAt`
  - `decisionHash`
- Added deterministic `decisionHash` using stable JSON + SHA-256.
- Added `PermissionLedger.record()` for recording any ActionGate verdict.
- Added `PermissionLedger.last(N)` export for recent records.
- Added copy-safe record export so callers cannot mutate ledger internals.
- Added `npm run test:core:permission-ledger`.

## Safety properties

- Permission Ledger does not allow or deny actions.
- Permission Ledger does not mutate runtime snapshot.
- Permission Ledger does not write trade/order state.
- Permission Ledger is audit-only.
- ActionGate remains the source of the verdict.
- Kernel Authority / CoreTrustReport remain the source of trust state.

## Tests

Command results:

```txt
npm run typecheck
EXIT=0

npm test
EXIT=0

npm run test:core:permission-ledger
EXIT=0
```

Covered scenarios:

1. Denied `PLACE_ORDER` creates ledger record.
2. Allowed diagnostic-class verdict creates ledger record.
3. Ledger record includes `snapshotRevision`.
4. Ledger record includes `kernelTrustState`.
5. Ledger record includes `blockingReasons`.
6. Ledger does not mutate snapshot.
7. Ledger exports last N records.

## Risks

- The ledger is currently in-memory only. Persistent storage policy should be decided by integration owner before production use.
- No automatic binding was added between `runtimeEngine.evaluateAction()` and the ledger. This is intentional to avoid changing action semantics or mutating runtime state implicitly.
- The diagnostic action test uses a diagnostic-class verdict object because alpha4 contracts do not yet define a dedicated diagnostic action type.

## Intentionally not done

- Did not make ledger authority.
- Did not allow actions through ledger.
- Did not mutate snapshot.
- Did not write trade/order state.
- Did not connect V1/V2.
- Did not add Signal Layer, Decision Engine, strategy logic, UI, live trading, or real exchange keys.
- Did not implement automatic recovery.
- Did not update Constitution directly; any ledger law should be taken by Constitution owner.
