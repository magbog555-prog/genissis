# INTEGRATION_REPORT_ALPHA2

## Package

- Target package: `mbg-core-v0.1-alpha2`
- Base archive: `mbg-core-v0.1-alpha1-followup.zip`
- Integration role: Role 8 / Integration Owner / Merge Engineer
- Integration mode: semantic merge over canonical alpha1 followup base

## Inputs merged

- Role 2 — Constitution Update
  - `CORE_CONSTITUTION.md`
  - `core/kernel/kernel-constitution.ts`
  - constitution test and package script updates
- Role 4 — Bootstrap FSM
  - bootstrap domain
  - bootstrap lifecycle events
  - bootstrap reducer
  - ActionGate block until bootstrap reconciled
  - `test:core:bootstrap`
- Role 5 — Event Validation
  - `core/events/validate-domain-event.ts`
  - validation before journal/reducer
  - canonical diagnostic API `commitEventResult(event, { log?: boolean })`
  - `test:core:event-validation`
- Role 6 — Event Idempotency
  - `core/runtime/src/idempotency.ts`
  - idempotency index
  - duplicate diagnostics
  - idempotency-aware recovery/replay
  - `getIdempotencyView()`
  - invariant `no_idempotency_conflicts`
  - `test:core:idempotency`
- Role 7 — Scenario Audit v3
  - `tests/scenarios/wave2-scenario-audit.ts`
  - `test:wave2:scenario-audit`
  - `DELIVERY_REPORT_WAVE2_SCENARIO_AUDIT_V3.md`

## Semantic merge result

The final event commit pipeline is:

```text
validate event
→ idempotency check
→ append journal
→ record idempotency
→ reduce snapshot
```

Implementation note: accepted events are validated first, checked against the idempotency index second, then persisted and reduced through the accepted-event path. Invalid events and duplicate events exit before journal append and before reducer mutation.

### Invalid event contract

Invalid events produce:

```text
no journal append
no snapshot mutation
no idempotency index mutation
```

### Duplicate event contract

Duplicate events produce:

```text
no journal append
no snapshot mutation
revision unchanged
```

Duplicate conflicts are rejected without journal/snapshot mutation.

## Canonical commit API

The canonical diagnostic API for alpha2 is:

```ts
commitEventResult(event, { log?: boolean })
```

`commitEventWithDiagnostic()` from Role 6 was retained as a compatibility/internal diagnostic alias for idempotency-focused tests. It delegates into `commitEventResult()` and is not the competing canonical public commit API.

## Conflicts and resolutions

### `events.ts`

Conflict source:

- Role 4 added bootstrap lifecycle events.
- Role 5 added validation requirements around domain events.
- Role 6 required idempotency metadata to work across event identities.

Resolution:

- Semantically merged event types so bootstrap lifecycle events are present.
- Kept existing PR/alpha1 event types.
- Preserved event fields required by validation and idempotency.
- No V1/Signal/Decision events were introduced.

### `runtime-engine.ts`

Conflict source:

- Role 5 introduced validation-before-commit and `commitEventResult()`.
- Role 6 introduced idempotency diagnostics and idempotency-aware recovery/replay.
- Role 4 required bootstrap state to participate in runtime safety.

Resolution:

- Final commit path is validation first, idempotency second, accepted-event persistence/reduction third.
- Invalid events return rejected diagnostics before journal/reducer/idempotency mutation.
- Duplicate events return duplicate diagnostics before journal/reducer mutation.
- Accepted events are the only events appended and reduced.
- Recovery/replay rebuilds idempotency from accepted persisted events and avoids duplicate tail reduction.
- `commitEventResult()` is the canonical diagnostic commit API.

### `package.json`

Conflict source:

- Role 4, 5, 6, and 7 each added test scripts.
- Alpha1 already had expanded `verify`.

Resolution:

- Preserved alpha1 scripts.
- Added Wave 2 scripts:
  - `test:core:bootstrap`
  - `test:core:event-validation`
  - `test:core:idempotency`
  - `test:wave2:scenario-audit`
- Updated `verify` to run full alpha2 scope:
  - reset runtime
  - typecheck
  - npm test
  - test:core-constitution
  - test:core:cold-start
  - test:core:bootstrap
  - test:core:event-validation
  - test:core:idempotency
  - test:wave2:scenario-audit
  - audit:runtime

### ActionGate reason conflict

Semantic decision:

```text
Wave2 Bootstrap FSM makes `bootstrap_not_reconciled` the canonical top-level ActionGate denial reason. The previous alpha1 reason `bootstrap_position_not_reconciled` remains only as internal risk/detail reason where applicable.
```

Resolution applied:

- `tests/scenarios/gate-scenarios.ts` now expects top-level denial reason `bootstrap_not_reconciled`.
- `bootstrap_position_not_reconciled` was not removed from internal/risk detail usage.

## Verification results

All required commands were executed.

```text
npm install: PASS
npm run typecheck: PASS
npm test: PASS
npm run test:core-constitution: PASS
npm run test:core:cold-start: PASS
npm run test:core:bootstrap: PASS
npm run test:core:event-validation: PASS
npm run test:core:idempotency: PASS
npm run test:wave2:scenario-audit: PASS
npm run audit:runtime: PASS
npm run verify: PASS
```

`npm run verify` completed with exit code `0`.

## Scope guard

Confirmed not added or connected in alpha2:

```text
V1
V2
Signal Layer
Decision Engine
UI
strategy logic
live trading
real exchange keys
```

## Unresolved conflicts

None.

## Final status

`mbg-core-v0.1-alpha2` is ready as the Wave 2 canonical integration candidate.
