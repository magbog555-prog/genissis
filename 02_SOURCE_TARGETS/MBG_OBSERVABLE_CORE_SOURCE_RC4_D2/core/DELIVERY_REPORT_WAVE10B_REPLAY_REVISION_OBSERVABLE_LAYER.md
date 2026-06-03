# Delivery Report — Wave 10B — Role 5 — Replay / Revision Observable Layer

## Scope

Role 5 implemented the replay/revision observable layer over the canonical base `mbg-core-v0.1-alpha9.zip`.

This delivery is read-only. It does not execute replay, mutate state, establish websocket authority, connect V1, or add trading/execution behavior.

## Changed files

- `core/trace/causality-trace.ts`
- `tests/scenarios/wave10b-replay-revision-observable-layer.ts`
- `package.json`

## Replay model

Added exported model types and builders:

- `RevisionTimelineEntry`
- `SnapshotTimelineEntry`
- `ReplayNavigationSemantics`
- `ReplaySafeTraceDto`
- `ReplayRevisionObservableLayer`
- `buildRevisionTimeline()`
- `buildSnapshotTimeline()`
- `buildReplayNavigationSemantics()`
- `mapTraceToReplaySafeDto()`
- `buildReplayRevisionObservableLayer()`

## Revision semantics

Revision cursor format:

```text
rev:<revisionBefore>-><revisionAfter>
```

Ordering rule:

```text
revisionAfter ASC,
revisionBefore ASC,
eventId ASC,
eventType ASC,
transitionStatus ASC,
traceId ASC
```

The observable layer ignores wall-clock receive time and generatedAt for ordering.

## Time-travel semantics

Time travel is a read-only cursor over Core-provided revision timeline entries.

It does not:
- replay execution;
- mutate Core state;
- recalculate trust;
- recalculate ActionGate verdicts;
- act as websocket authority.

## Tests added

- `tests/scenarios/wave10b-replay-revision-observable-layer.ts`

New npm script:

```bash
npm run test:wave10b:replay-revision-observable-layer
```

## Tests run

```text
npm run typecheck — PASS
npm test — PASS
npm run test:wave10b:replay-revision-observable-layer — PASS
```

## Semantic notes

The UI receives replay-safe DTOs and revision timelines from Core.

The UI may display:
- revision timeline;
- replay steps;
- snapshot timeline;
- navigation cursors;
- time-travel semantics.

The UI must not:
- replay execution;
- mutate state;
- decide trust;
- bypass ActionGate;
- become websocket authority.

## Known limitations

- This delivery does not add an HTTP API endpoint.
- This delivery does not integrate the frontend adapter directly.
- This delivery does not implement execution replay.
- This delivery does not change trust logic, ActionGate logic, reducers, or journal behavior.
