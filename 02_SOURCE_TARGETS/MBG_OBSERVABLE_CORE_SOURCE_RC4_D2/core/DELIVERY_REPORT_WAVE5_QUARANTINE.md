# Delivery Report — Wave 5 / Role 5 — Quarantine

## Canonical base

`mbg-core-v0.1-alpha4.zip`

## Scope

Implemented Quarantine — “карантин плохих данных” — as a diagnostic layer for invalid, unknown, suspicious, or conflicting data that must not enter the canonical event journal.

## Changed files

- `core/quarantine/quarantine.ts`
- `core/runtime/src/runtime-engine.ts`
- `tests/scenarios/core-quarantine.ts`
- `package.json`

## Implemented

### Quarantine module

Added:

`core/quarantine/quarantine.ts`

Exports:

- `QuarantineRecord`
- `QuarantineSource`
- `QuarantineSeverity`
- `QuarantineSummary`
- `QuarantineStoreView`
- `QuarantineStore`
- `quarantinePayloadHash()`

### Quarantine record fields

Each record contains:

- `quarantineId`
- `reason`
- `source`
- `eventId`
- `eventType`
- `payloadHash`
- `detectedBy`
- `detectedAt`
- `severity`
- `rawEvent`
- `recoverable`
- `notes`

### Sources covered

- invalid event
- unknown event type
- schema violation
- idempotency conflict
- suspicious payload is represented in the type system for future detectors

### Runtime integration

`RuntimeEngine.commitEventResult()` now records quarantine diagnostics for:

- event validation rejection;
- bootstrap/current-state validation rejection;
- idempotency duplicate conflict.

The quarantined event is not appended to the canonical journal, not reduced into the snapshot, and does not increase snapshot revision.

### Runtime API

Added:

- `RuntimeEngine.getQuarantineView(limit?: number)`

Quarantine summary is also exposed through runtime metadata:

- `getRuntimeView().quarantine`
- `getEntitiesView().quarantine`
- `getCoreTrustReport().metadata.quarantine`

This makes quarantine count available to CoreTrustReport / future Recovery Planner without making quarantine part of normal replay state.

### Test script

Added:

`npm run test:core:quarantine`

## Test coverage

Implemented scenarios:

1. invalid event creates quarantine record;
2. invalid event does not enter canonical journal;
3. invalid event does not mutate snapshot;
4. unknown event type is quarantined;
5. idempotency conflict is quarantined;
6. quarantine count is available via CoreTrustReport metadata;
7. quarantine records do not affect normal replay event count/revision.

## Command results

```text
npm run typecheck
PASS

npm test
PASS

npm run test:core:quarantine
PASS
```

Focused output:

```text
core quarantine checks passed
```

## Risks / integration notes

1. Quarantine is currently in-memory runtime diagnostic state. If alpha5 requires durable quarantine storage, Role 8 should integrate it with a dedicated non-canonical quarantine persistence path.
2. `suspicious_payload` is defined as a quarantine source, but no separate suspicious-payload detector was added beyond existing validation/idempotency paths.
3. Quarantine count is exposed via runtime/report metadata, not as a new state domain. This is intentional to avoid making quarantine participate in replay or reducers.
4. Existing persistence has an older corrupt-file quarantine helper; this task does not merge that file-level quarantine with the new event-level quarantine store.

## Intentionally not done

- No V1/V2 integration.
- No Signal Layer.
- No Decision Engine.
- No strategy logic.
- No UI.
- No live trading.
- No real exchange keys.
- No automatic repair.
- No automatic recovery execution.
- No canonical journal writes for quarantined events.
- No snapshot mutation from quarantine.
- No replay participation by quarantine.
