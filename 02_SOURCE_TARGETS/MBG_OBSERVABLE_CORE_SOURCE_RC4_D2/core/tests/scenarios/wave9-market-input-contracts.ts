import assert from "node:assert/strict";
import { EVENT_TYPE, type DomainEvent } from "../../core/contracts/src/events.js";
import { initialSnapshot } from "../../core/state/src/types.js";
import { reduceSnapshot } from "../../core/runtime/src/runtime-engine.js";
import { validateDomainEvent } from "../../core/events/validate-domain-event.js";
import { EventIdempotencyIndex } from "../../core/runtime/src/idempotency.js";

function event(eventId: string, sequence: number, overrides: Record<string, unknown> = {}): DomainEvent {
  const observation = {
    observationId: `obs-${sequence}`,
    sourceType: "exchange",
    sourceName: "fixture-feed",
    symbol: "BTCUSDT",
    channel: "book_delta",
    sequence,
    previousSequence: sequence > 1 ? sequence - 1 : undefined,
    exchangeTimestamp: `2025-01-01T00:00:${String(sequence).padStart(2, "0")}.000Z`,
    receivedTimestampFromEvent: `2025-01-01T00:00:${String(sequence).padStart(2, "0")}.100Z`,
    payloadHash: `sha256:payload-${sequence}`,
    provenanceId: `prov-${sequence}`,
    freshnessHint: { maxAgeMs: 1000, observedAgeMs: 100 },
    checksum: `checksum-${sequence}`,
    schemaVersion: "v1",
    ...overrides
  };

  return {
    eventId,
    eventType: EVENT_TYPE.MARKET_INPUT_OBSERVED,
    timestamp: "2025-01-01T00:00:00.000Z",
    source: "wave9-test",
    payload: { observation }
  };
}

function run() {
  const first = event("evt-market-1", 1);
  assert.equal(validateDomainEvent(first).ok, true, "valid market input event should pass schema validation");

  const afterFirst = reduceSnapshot(initialSnapshot(), first);
  assert.equal(afterFirst.marketInput.status, "validated");
  assert.equal(afterFirst.marketInput.lastObservationId, "obs-1");
  assert.equal(afterFirst.marketInput.lastSequence, 1);
  assert.equal(afterFirst.market.status, "unknown", "market input must not mutate trusted market state directly");

  const index = new EventIdempotencyIndex();
  const duplicateA = index.evaluateAndRecord(first);
  const duplicateB = index.evaluate(event("evt-market-1-duplicate", 1));
  assert.equal(duplicateA.decision, "accepted");
  assert.equal(duplicateB.decision, "duplicate_ignored");
  assert.equal(duplicateB.scope, "marketObservationId");

  const snapshotBeforeDuplicate = afterFirst;
  const duplicateWouldBeIgnoredBeforeReducer = duplicateB.decision === "duplicate_ignored";
  assert.equal(duplicateWouldBeIgnoredBeforeReducer, true, "duplicate input must be stopped by idempotency before reducer and revision bump");

  const gap = event("evt-market-gap", 3, { previousSequence: 1 });
  const afterGap = reduceSnapshot(afterFirst, gap);
  assert.equal(afterGap.marketInput.status, "gap_detected");
  assert.deepEqual(afterGap.marketInput.gapObservationIds, ["obs-3"]);
  assert.equal(afterGap.marketInput.lastSequence, 1, "gap input must not become trusted market input state");

  const stale = event("evt-market-stale", 2, {
    observationId: "obs-stale-2",
    previousSequence: 1,
    exchangeTimestamp: "2025-01-01T00:00:00.000Z",
    receivedTimestampFromEvent: "2025-01-01T00:00:05.000Z",
    freshnessHint: { maxAgeMs: 1000, observedAgeMs: 5000 }
  });
  const afterStale = reduceSnapshot(afterFirst, stale);
  assert.equal(afterStale.marketInput.status, "stale_detected");
  assert.deepEqual(afterStale.marketInput.staleObservationIds, ["obs-stale-2"]);
  assert.equal(afterStale.marketInput.lastSequence, 1, "stale input must not become trusted market input state");

  const missingProvenance = event("evt-market-missing-prov", 2, {
    observationId: "obs-missing-prov",
    previousSequence: 1,
    provenanceId: ""
  });
  const rejected = validateDomainEvent(missingProvenance);
  assert.equal(rejected.ok, false);
  assert.ok(!rejected.ok && rejected.issues.some((issue) => issue.path.includes("provenanceId")), "missing provenance must be rejected before mutation");

  const beforeInvalid = afterFirst;
  const invalidReduced = rejected.ok ? reduceSnapshot(beforeInvalid, missingProvenance) : beforeInvalid;
  assert.equal(invalidReduced.revision, beforeInvalid.revision, "invalid input must not mutate state when validation rejects it");

  const replayA = [first, event("evt-market-2", 2)].reduce((snapshot, e) => reduceSnapshot(snapshot, e), initialSnapshot());
  const replayB = [first, event("evt-market-2", 2)].reduce((snapshot, e) => reduceSnapshot(snapshot, e), initialSnapshot());
  assert.deepEqual(
    {
      marketInput: replayA.marketInput,
      market: { ...replayA.market, meta: { ...replayA.market.meta, updatedAt: "<initial>" } },
      revision: replayA.revision
    },
    {
      marketInput: replayB.marketInput,
      market: { ...replayB.market, meta: { ...replayB.market.meta, updatedAt: "<initial>" } },
      revision: replayB.revision
    },
    "market input replay must be deterministic"
  );

  console.log("wave9 market input contracts: PASS");
}

run();
