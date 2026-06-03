# Delivery Report — Wave 8 Role 4 Metadata Event Model

## Base

`mbg-core-v0.1-alpha6.zip`

## Scope

Role 4 implemented the event-model foundation for metadata/provenance:

- event contracts;
- state types;
- deterministic reducer behavior;
- idempotency rules for metadata/provenance duplicates;
- replay-safety scenario tests.

No V1, UI, execution, live trading, ActionGate changes, trust policy changes, second journal, or mutable metadata side bag were added.

## Changed files

- `core/contracts/src/events.ts`
- `core/events/validate-domain-event.ts`
- `core/integrity/integrity-report.ts`
- `core/runtime/src/idempotency.ts`
- `core/runtime/src/runtime-engine.ts`
- `core/state/src/types.ts`
- `core/trace/causality-trace.ts`
- `core/transitions/src/reducers.ts`
- `package.json`
- `tests/scenarios/wave8-metadata-reducer.ts`
- `DELIVERY_REPORT_WAVE8_ROLE4_METADATA_EVENT_MODEL.md`

## Metadata event contract

Added event types:

- `metadata.attached`
- `provenance.recorded`
- `provenance.action.recorded`
- `provenance.trade.recorded`
- `provenance.fill.recorded`
- `provenance.pnl.recorded`

Added contract types/schemas:

- `ProvenanceOriginType`
- `ProvenanceRef`
- `ProvenanceRefSchema`
- `MetadataAttachedPayload`
- `MetadataAttachedPayloadSchema`
- `ProvenanceRecordedPayload`
- `ProvenanceRecordedPayloadSchema`
- `MetadataEventPayload`
- `MetadataEventPayloadSchema`

`ProvenanceRef` contains:

- `provenanceId`
- `originType`
- `originEventId`
- `targetId`
- `parentProvenanceIds`
- `source`
- `confidence`
- `createdAtFromEvent`

`createdAtFromEvent` must come from the event payload and is not generated inside reducers.

## State model

Added `RuntimeSnapshot.provenance`.

The provenance state stores:

- provenance records by `provenanceId`;
- metadata attachments by `metadataId`;
- metadata indexes by `targetId`;
- applied metadata/provenance event ids;
- deterministic state metadata.

## Reducer behavior

Added `reduceProvenanceState`.

Rules:

- metadata/provenance state changes only for metadata/provenance events;
- non-metadata events do not create metadata;
- reducer uses `event.timestamp` / payload timestamps only;
- reducer does not call `Date.now()`, `new Date()`, random generators, external services, APIs, or exchange clients;
- duplicate applied metadata events are ignored at reducer-domain level;
- conflicting duplicate classification remains outside reducer mutation and belongs to validation/idempotency/quarantine layers.

## Idempotency explanation

Extended `EventIdempotencyIndex` with metadata/provenance identities:

- `metadataId`
- `provenanceId`

Behavior:

- same `eventId` + same canonical payload => `duplicate_ignored`;
- same `metadataId` + same payload through a different event id => `duplicate_ignored`;
- same `provenanceId` + same payload through a different event id => `duplicate_ignored`;
- same metadata/provenance id with conflicting payload => `duplicate_conflict`;
- duplicate metadata/provenance events do not bump snapshot revision because they are stopped before reducer application.

## Tests added

- `tests/scenarios/wave8-metadata-reducer.ts`

Added npm script:

- `npm run test:core:metadata-events`

## Tests run

- `npm run typecheck` — PASS
- `npm test` — PASS
- `npm run test:core:metadata-events` — PASS

## Semantic notes

Metadata/provenance is now part of the core event model and snapshot state.

Metadata is no longer modeled as an implicit mutable side bag. It is represented through deterministic domain events and a deterministic reducer.

The implementation keeps observability first: it records provenance facts but does not create execution authority, trading behavior, or UI controls.

The Wave 7 hash chain and causality trace are not bypassed. The new `provenance` domain is included in runtime domain tracing and integrity evidence inputs so future Wave 8 integration can connect:

event -> transition -> snapshot -> trust -> verdict -> trace -> provenance

## Replay-safety note

Replay determinism is preserved because metadata reducer output depends only on:

- prior provenance state;
- the domain event;
- timestamps explicitly carried by the event/payload.

It does not use runtime clock, random numbers, process memory counters, exchange state, or external services.

## Known limitations

- No UI/API endpoint was added for browsing provenance.
- No trust policy was added for provenance completeness.
- No ActionGate rule was changed.
- No separate provenance journal was created.
- No migration of legacy PR35 metadata format was performed.
- Conflicting duplicate metadata/provenance payloads are detected by idempotency, but this role does not add new trust policy reactions.
