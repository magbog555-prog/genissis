import assert from "node:assert/strict";
import {
  buildCausalityTrace,
  buildReplayRevisionObservableLayer,
  buildRevisionTimeline,
  buildSnapshotTimeline,
  mapTraceToReplaySafeDto
} from "../../core/trace/causality-trace.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

runtimeEngine.clearPersistenceAndReset();

const baseSnapshot = runtimeEngine.getSnapshot();
const baseReport = runtimeEngine.getCoreTrustReport();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function snapshotAt(revision: number, eventId: string, price?: number) {
  const snapshot = clone(baseSnapshot);
  snapshot.revision = revision;
  snapshot.committedAt = `2026-10-10T00:00:0${revision}.000Z`;
  snapshot.market.meta.revision = revision;
  snapshot.market.meta.sourceEventId = eventId;
  snapshot.market.meta.updatedAt = `2026-10-10T00:00:0${revision}.000Z`;
  if (price !== undefined) {
    snapshot.market.status = "open";
    snapshot.market.symbol = "BTCUSDT";
    snapshot.market.lastPrice = price;
  }
  return snapshot;
}

function trace(eventId: string, beforeRevision: number, afterRevision: number, price: number) {
  return buildCausalityTrace({
    event: {
      eventId,
      eventType: "market.tick.received",
      source: "mock-market",
      timestamp: `2026-10-10T00:00:0${afterRevision}.000Z`,
      payload: {
        symbol: "BTCUSDT",
        price,
        bid: price - 1,
        ask: price + 1,
        volume: 1,
        provider: "mock-market",
        marketInputIntegrity: {
          sequenceStatus: "ordered",
          gapStatus: "none",
          duplicateStatus: "none",
          freshnessStatus: "fresh",
          checksumStatus: "valid",
          payloadHash: `sha256:${eventId}`
        },
        provenance: {
          originRef: `mock-feed:${eventId}`,
          parentProvenanceIds: ["prov:mock-feed-root"]
        },
        metadataEvents: [{
          eventId: `metadata.${eventId}`,
          eventType: "metadata.provenance.recorded",
          source: "core",
          originRef: `mock-feed:${eventId}`,
          parentProvenanceIds: ["prov:mock-feed-root"],
          payload: { kind: "replay-revision-test" }
        }]
      }
    } as any,
    beforeSnapshot: snapshotAt(beforeRevision, `${eventId}:before`, beforeRevision > 0 ? price - 1 : undefined),
    afterSnapshot: snapshotAt(afterRevision, eventId, price),
    beforeReport: baseReport,
    afterReport: baseReport,
    transitionStatus: "accepted",
    hashChainLinkId: `hash-link:${afterRevision}`,
    generatedAt: "2099-01-01T00:00:00.000Z"
  });
}

const trace1 = trace("wave10b-event-1", 0, 1, 101);
const trace2 = trace("wave10b-event-2", 1, 2, 102);
const duplicateSnapshot = snapshotAt(2, "wave10b-event-2", 102);
const duplicateOrderingTrace = buildCausalityTrace({
  event: {
    eventId: "wave10b-duplicate-noop",
    eventType: "market.tick.received",
    source: "mock-market",
    payload: {
      symbol: "BTCUSDT",
      price: 102,
      bid: 101,
      ask: 103,
      volume: 1,
      provider: "mock-market",
      marketInputIntegrity: {
        sequenceStatus: "ordered",
        gapStatus: "none",
        duplicateStatus: "duplicate",
        freshnessStatus: "fresh",
        checksumStatus: "valid"
      },
      provenance: { originRef: "mock-feed:duplicate" }
    }
  } as any,
  beforeSnapshot: duplicateSnapshot,
  afterSnapshot: duplicateSnapshot,
  beforeReport: baseReport,
  afterReport: baseReport,
  transitionStatus: "duplicate_ignored",
  hashChainLinkId: "hash-link:2:duplicate",
  generatedAt: "1900-01-01T00:00:00.000Z"
});

const unorderedInput = [trace2, duplicateOrderingTrace, trace1];
const layerA = buildReplayRevisionObservableLayer(unorderedInput, "rev:1->2");
const layerB = buildReplayRevisionObservableLayer([duplicateOrderingTrace, trace1, trace2], "rev:1->2");

assert.deepEqual(
  layerA.revisionTimeline.map((entry) => entry.traceId),
  layerB.revisionTimeline.map((entry) => entry.traceId),
  "revision timeline ordering is stable"
);

assert.deepEqual(
  layerA.replaySteps.map((step) => `${step.order}:${step.cursor}:${step.traceId}`),
  layerB.replaySteps.map((step) => `${step.order}:${step.cursor}:${step.traceId}`),
  "deterministic replay ordering is stable"
);

assert.deepEqual(
  layerA.snapshotTimeline.map((entry) => ({
    cursor: entry.cursor,
    revision: entry.revision,
    mutated: entry.snapshotMutated,
    domains: entry.changedDomains
  })),
  layerB.snapshotTimeline.map((entry) => ({
    cursor: entry.cursor,
    revision: entry.revision,
    mutated: entry.snapshotMutated,
    domains: entry.changedDomains
  })),
  "snapshot timeline is deterministic"
);

assert.equal(layerA.navigation.selectedCursor, "rev:1->2");
assert.equal(layerA.navigation.readOnly, true);
assert.equal(layerA.navigation.noExecutionReplay, true);
assert.equal(layerA.navigation.noStateMutation, true);
assert.equal(layerA.navigation.noWebsocketAuthority, true);
assert.ok(layerA.navigation.previousCursor, "previous cursor exists");
assert.ok(layerA.navigation.nextCursor, "next cursor exists for duplicate same-revision trace");

assert.equal(layerA.replaySafeDto.length, 3);
assert.ok(layerA.replaySafeDto.every((dto) => dto.replaySafe && dto.readOnly), "DTO mapping is replay-safe and read-only");
assert.ok(layerA.replaySafeDto.every((dto) => dto.orderKey.includes("|")), "DTO order keys are explicit");

const timeline = buildRevisionTimeline(unorderedInput);
const snapshotTimeline = buildSnapshotTimeline(unorderedInput);
assert.equal(timeline.length, 3);
assert.equal(snapshotTimeline.length, 3);
assert.deepEqual(timeline.map((entry) => entry.order), [0, 1, 2]);

const dto = mapTraceToReplaySafeDto(trace1);
assert.equal(dto.dtoVersion, "replay-safe-trace-dto-v1");
assert.equal(dto.event.eventId, "wave10b-event-1");
assert.equal(dto.transition.revisionBefore, 0);
assert.equal(dto.transition.revisionAfter, 1);
assert.equal(dto.snapshot.hashChainLinkId, "hash-link:1");

const snapshotBefore = JSON.stringify(runtimeEngine.getSnapshot());
buildReplayRevisionObservableLayer(unorderedInput);
const snapshotAfter = JSON.stringify(runtimeEngine.getSnapshot());
assert.equal(snapshotAfter, snapshotBefore, "observable replay/revision layer does not mutate state");

console.log(JSON.stringify({
  exampleReplayRevisionObservableLayer: {
    layerVersion: layerA.layerVersion,
    ordering: layerA.ordering,
    revisionTimeline: layerA.revisionTimeline,
    snapshotTimeline: layerA.snapshotTimeline,
    navigation: layerA.navigation,
    firstReplaySafeDto: layerA.replaySafeDto[0],
    timeTravel: layerA.timeTravel
  }
}, null, 2));

console.log("wave10b replay revision observable layer checks passed");
