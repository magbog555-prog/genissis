# Delivery Report — Wave 9 / Role 4 — Market Input Event Contracts and Validation

## Base

`mbg-core-v0.1-alpha7.zip`

## Scope

Role 4 zone only:

- event contracts;
- state types;
- reducer mechanics;
- idempotency;
- market input validation helpers;
- scenario tests.

No V1, no websocket, no exchange client, no execution, no UI, no ActionGate policy changes, no trust policy changes.

## Changed Files

- `package.json`
- `tests/scenarios/wave9-market-input-contracts.ts`
- `core/runtime/src/runtime-engine.ts`
- `core/runtime/src/idempotency.ts`
- `core/events/validate-domain-event.ts`
- `core/transitions/src/reducers.ts`
- `core/state/src/types.ts`
- `core/contracts/src/events.ts`
- `core/market-input/market-input-types.ts`
- `core/market-input/sequence-guard.ts`
- `core/market-input/market-input-validation.ts`

## Event Contract Summary

Added canonical market input event types:

- `market.input.observed`
- `market.input.validated`
- `market.input.rejected`
- `market.input.gap_detected`
- `market.input.duplicate_detected`
- `market.input.stale_detected`
- `market.input.checksum_mismatch_detected`

Added `MarketInputObservation` contract fields:

- `observationId`
- `sourceType`
- `sourceName`
- `symbol`
- `channel`
- `sequence`
- `previousSequence`
- `exchangeTimestamp`
- `receivedTimestampFromEvent`
- `payloadHash`
- `provenanceId`
- `freshnessHint`
- `checksum`
- `bookChecksum`
- `schemaVersion`

## Validation Summary

Validation covers:

- schema / required fields;
- source identity;
- sequence / previousSequence shape;
- event-provided exchange and received timestamps;
- required `payloadHash`;
- required `provenanceId`;
- deterministic stale detection using only event-provided timestamps / freshness hints;
- validationStatus / issues shape.

No reducer or replay-sensitive logic uses `Date.now()`, `Math.random()`, websocket state, exchange API state, external service calls, or runtime memory to generate market input truth.

## Reducer Behavior Summary

Added `RuntimeSnapshot.marketInput`.

`reduceMarketInputState`:

- accepts market input events only;
- stores observations in the `marketInput` domain;
- marks valid observations as `validated`;
- detects gaps through sequence continuity;
- detects stale observations deterministically;
- does not mutate trusted `market` state;
- does not treat market input as fresh/trusted by default;
- ignores duplicate observation IDs in reducer state;
- keeps rejected/gap/stale/checksum mismatch observation IDs for auditability.

Invalid events rejected by event validation do not reach reducer mutation in runtime.

## Idempotency Explanation

`EventIdempotencyIndex` now tracks `marketObservationId` using `observationId`.

Duplicate market input observations are detected before reducer application:

- same `observationId` + same payload fingerprint => `duplicate_ignored`;
- same `observationId` + conflicting payload fingerprint => `duplicate_conflict`.

Therefore duplicate market input does not bump snapshot revision in runtime commit flow.

## Tests Added

- `tests/scenarios/wave9-market-input-contracts.ts`

Script added:

- `npm run test:core:market-input-contracts`

Covered scenarios:

1. valid market input accepted into `marketInput` domain;
2. duplicate input idempotent;
3. duplicate stopped before reducer / revision bump;
4. gap detected;
5. stale input detected;
6. missing provenance rejected;
7. invalid input does not mutate state;
8. replay deterministic.

## Tests Run

- `npm run typecheck` — PASS
- `npm test` — PASS
- `npm run test:core:market-input-contracts` — PASS

`npm ci --ignore-scripts` was run to install dependencies locally because the archive did not include `node_modules`. `node_modules` is not included in the delivery zip.

## Semantic Notes

Market input is now event-sourced and represented as a first-class input integrity domain.

Market input is not exchange truth and does not update trusted `market` state directly. It is a validated observation record that future roles may connect to CoreTrustReport / ActionGate / causality visibility during semantic integration.

## Replay-Safety Note

Replay determinism is preserved:

- stale detection uses only `exchangeTimestamp`, `receivedTimestampFromEvent`, and `freshnessHint` from the event;
- reducer does not generate timestamps;
- reducer does not call external services;
- duplicate handling is performed by idempotency before reducer mutation in runtime;
- market input observations are stored by deterministic event payload data.

## Known Limitations

- No ActionGate blocking was added in this role.
- No trust policy was added in this role.
- No CoreTrustReport market input status was added in this role.
- No CausalityTrace integration was added beyond normal runtime trace behavior.
- No websocket, V1, exchange client, live trading, execution, UI, or API keys were added.
- No second journal was created.
