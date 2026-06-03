import assert from "node:assert/strict";
import fs from "node:fs";
import { EVENT_TYPE, type DomainEvent } from "../../core/contracts/src/events.js";
import { RuntimeEngine, reduceSnapshot, replaySnapshotFromEvents } from "../../core/runtime/src/runtime-engine.js";
import { initialSnapshot } from "../../core/state/src/types.js";

const ts = "2025-01-01T00:00:00.000Z";

function event<T>(eventType: string, payload: T, eventId: string): DomainEvent<T> {
  return {
    eventId,
    eventType: eventType as any,
    timestamp: ts,
    source: "wave8-metadata-test",
    schemaVersion: "1",
    payload
  };
}

function provenancePayload(overrides: Record<string, unknown> = {}) {
  return {
    provenanceId: "prov-action-1",
    originType: "action",
    originEventId: "origin-event-1",
    targetId: "action-place-order-1",
    parentProvenanceIds: [],
    source: "wave8-metadata-test",
    confidence: 1,
    createdAtFromEvent: ts,
    ...overrides
  };
}

function metadataAttachedEvent(eventId = "metadata-event-1") {
  return event(EVENT_TYPE.METADATA_ATTACHED, {
    metadataId: "metadata-1",
    targetId: "action-place-order-1",
    key: "intent",
    value: "audit-only",
    provenance: provenancePayload(),
    createdAtFromEvent: ts
  }, eventId);
}

function provenanceRecordedEvent(eventId = "provenance-event-1", provenanceId = "prov-action-2") {
  return event(EVENT_TYPE.ACTION_PROVENANCE_RECORDED, provenancePayload({
    provenanceId,
    targetId: "action-place-order-2",
    originEventId: "origin-event-2"
  }), eventId);
}

function testMetadataEventAddsProvenance() {
  const snapshot = reduceSnapshot(initialSnapshot(), metadataAttachedEvent());

  assert.equal(snapshot.provenance.status, "recorded");
  assert.ok(snapshot.provenance.records["prov-action-1"]);
  assert.equal(snapshot.provenance.records["prov-action-1"].originType, "action");
  assert.equal(snapshot.provenance.records["prov-action-1"].createdAtFromEvent, ts);
  assert.ok(snapshot.provenance.metadataById["metadata-1"]);
  assert.deepEqual(snapshot.provenance.metadataByTarget["action-place-order-1"], ["metadata-1"]);
}

function testDuplicateMetadataEventDoesNotMutateOrBumpRevision() {
  const engine = new RuntimeEngine();
  engine.clearPersistenceAndReset();

  const first = engine.commitEventResult(metadataAttachedEvent(), { log: false });
  assert.equal(first.status, "accepted");
  const revisionAfterFirst = first.snapshot.revision;
  const provenanceRevisionAfterFirst = first.snapshot.provenance.meta.revision;

  const duplicate = engine.commitEventResult(metadataAttachedEvent(), { log: false });
  assert.equal(duplicate.status, "duplicate_ignored");
  assert.equal(duplicate.snapshot.revision, revisionAfterFirst);
  assert.equal(duplicate.snapshot.provenance.meta.revision, provenanceRevisionAfterFirst);
  assert.equal(Object.keys(duplicate.snapshot.provenance.records).length, 1);

  const sameMetadataDifferentEventId = engine.commitEventResult(metadataAttachedEvent("metadata-event-duplicate-id"), { log: false });
  assert.equal(sameMetadataDifferentEventId.status, "duplicate_ignored");
  assert.equal(sameMetadataDifferentEventId.snapshot.revision, revisionAfterFirst);
  assert.equal(sameMetadataDifferentEventId.snapshot.provenance.meta.revision, provenanceRevisionAfterFirst);
}

function testMetadataReplayDeterministic() {
  const events = [
    metadataAttachedEvent(),
    provenanceRecordedEvent()
  ];

  const replayA = replaySnapshotFromEvents(events);
  const replayB = replaySnapshotFromEvents(events);

  assert.deepEqual(replayA.provenance, replayB.provenance);
  assert.equal(replayA.provenance.records["prov-action-1"].createdAtFromEvent, ts);
  assert.equal(replayA.provenance.records["prov-action-2"].createdAtFromEvent, ts);
}

function testMetadataNotCreatedWithoutEvent() {
  const snapshot = initialSnapshot();
  assert.equal(snapshot.provenance.status, "empty");
  assert.deepEqual(snapshot.provenance.records, {});
  assert.deepEqual(snapshot.provenance.metadataById, {});

  const marketOnly = reduceSnapshot(snapshot, event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "wave8-metadata-test"
  }, "market-event-1"));

  assert.equal(marketOnly.provenance.status, "empty");
  assert.deepEqual(marketOnly.provenance.records, {});
}

function testReducerDoesNotUseNondeterministicMetadataSources() {
  const reducerSource = fs.readFileSync("core/transitions/src/reducers.ts", "utf8");
  const start = reducerSource.indexOf("export function reduceProvenanceState");
  const end = reducerSource.indexOf("export function reduceMarketState");
  assert.ok(start >= 0 && end > start, "reduceProvenanceState block must exist");
  const block = reducerSource.slice(start, end);

  assert.equal(block.includes("Date.now("), false);
  assert.equal(block.includes("new Date("), false);
  assert.equal(block.includes("randomUUID"), false);
  assert.equal(block.includes("Math.random"), false);
  assert.equal(block.includes("fetch("), false);
}

function testMetadataValidationRejectsMissingProvenance() {
  const engine = new RuntimeEngine();
  engine.clearPersistenceAndReset();

  const invalid = event(EVENT_TYPE.METADATA_ATTACHED, {
    metadataId: "metadata-invalid",
    targetId: "target-invalid",
    key: "invalid",
    value: true,
    createdAtFromEvent: ts
  }, "metadata-invalid-event");

  const result = engine.commitEventResult(invalid as any, { log: false });
  assert.equal(result.status, "rejected");
  assert.equal(result.snapshot.provenance.status, "empty");
}

function main() {
  testMetadataEventAddsProvenance();
  testDuplicateMetadataEventDoesNotMutateOrBumpRevision();
  testMetadataReplayDeterministic();
  testMetadataNotCreatedWithoutEvent();
  testReducerDoesNotUseNondeterministicMetadataSources();
  testMetadataValidationRejectsMissingProvenance();

  console.log("wave8 metadata reducer scenarios passed");
}

main();
