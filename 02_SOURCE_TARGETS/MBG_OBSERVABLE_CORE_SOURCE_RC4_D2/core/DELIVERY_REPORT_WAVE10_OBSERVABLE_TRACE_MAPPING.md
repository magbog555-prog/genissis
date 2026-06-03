# DELIVERY_REPORT_WAVE10_OBSERVABLE_TRACE_MAPPING.md

## Role

Role 5 — Causality / Trace

## Task

Wave 10A — Observable Trace Mapping

## Base

`mbg-core-v0.1-alpha8.zip`

## Summary

Added replay-safe observable trace mapping for the Connected Observable Core Machine.

The mapping exposes:

- revision history;
- replay steps;
- causality chain;
- provenance lineage;
- integrity failures;
- market input integrity;
- snapshot transitions;
- gate reasoning;
- quarantine/recovery visibility;
- revision cursor semantics;
- time-travel visualization semantics.

The implementation is read-only. It does not mutate snapshot, write events, calculate trust, call exchanges, connect V1, add execution, or create frontend authority.

## Changed files

```text
core/trace/causality-trace.ts
tests/scenarios/wave10-observable-trace-mapping.ts
package.json
DELIVERY_REPORT_WAVE10_OBSERVABLE_TRACE_MAPPING.md
```

## Trace model changes

Added observable mapping types and functions:

```text
ObservableTraceStepKind
ObservableTraceStepStatus
ObservableRevisionCursor
ObservableTraceStep
ObservableRevisionHistoryEntry
ObservableReplayStep
ObservableTimeTravelSemantics
ObservableTraceMapping
mapTraceToObservableSteps()
buildObservableTraceMapping()
```

## Replay-safe ordering

Ordering is deterministic and ignores wall-clock generation time:

```text
revisionAfter ASC,
revisionBefore ASC,
eventId ASC,
eventType ASC,
transitionStatus ASC,
traceId ASC
```

## Revision cursor semantics

Each visual step carries:

```text
rev:<revisionBefore>-><revisionAfter>
```

Cursor selection is read-only visualization. It never mutates Core state.

## Time-travel visualization semantics

Time-travel is a UI visualization of existing trace evidence only.

The UI may select a revision cursor, but it must not recompute trust, permissions, transitions, or replay state.

## Tests added

```text
tests/scenarios/wave10-observable-trace-mapping.ts
```

Script:

```text
npm run test:wave10:observable-trace-mapping
```

Covered scenarios:

1. replay ordering stable;
2. causality ordering stable;
3. snapshot transition deterministic;
4. provenance lineage visible;
5. market input integrity visible;
6. integrity failure visible;
7. quarantine/recovery visibility present;
8. time-travel semantics are read-only;
9. trace steps include event → provenance → transition → snapshot → trust → gate → market input.

## Tests run

```text
npm run typecheck
PASS

npm test
PASS

npm run test:wave10:observable-trace-mapping
PASS
```

## Example trace JSON

```json
{
  "mappingVersion": "observable-trace-mapping-v1",
  "ordering": {
    "stable": true,
    "rule": "revisionAfter ASC, revisionBefore ASC, eventId ASC, eventType ASC, transitionStatus ASC, traceId ASC; generatedAt is ignored"
  },
  "revisionCursor": {
    "latestRevision": 1,
    "availableCursors": ["rev:0->0", "rev:0->1"]
  },
  "timeTravel": {
    "cursorField": "revisionCursor",
    "orderingRule": "A UI may move across availableCursors only; it must not recompute ordering from wall-clock time.",
    "mutationRule": "Selecting a cursor is read-only visualization and never mutates Core state.",
    "readOnlyRule": "UI observes mapped Core evidence; Kernel Authority and ActionGate remain the only trust/action authorities."
  }
}
```

## Observability note

Observable Core Machine can render the mapped flow as:

```text
revision history
→ replay steps
→ event
→ metadata/provenance
→ transition
→ snapshot transition
→ trust effect
→ gate reasoning
→ market input integrity
→ integrity/quarantine/recovery visibility
```

The UI observes these artifacts. Core remains the only decision maker.

## Semantic notes

- UI observes, Core decides.
- Observable mapping is an adapter over CausalityTrace, not a new source of truth.
- Mapping is deterministic where possible.
- Mapping does not use `Date.now()` or `Math.random()`.
- Mapping does not weaken ActionGate, Kernel Authority, replay, integrity, or trust logic.
- Missing provenance/input remains visible as a gap/issue, not corruption.

## Known limitations

- No frontend implementation is included.
- No API endpoint is added in this role.
- No streaming/polling transport is added.
- No V1/live market/execution/trading integration is added.
- Snapshot Hash Chain is referenced through existing `hashChainLinkId`; this task does not implement new hash-chain logic.
