import assert from "node:assert/strict";
import { EVENT_TYPE } from "../../core/contracts/src/events.js";
import {
  buildCausalityTrace,
  buildObservableTraceMapping,
  mapTraceToObservableSteps
} from "../../core/trace/causality-trace.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

runtimeEngine.clearPersistenceAndReset();

const beforeSnapshot = runtimeEngine.getSnapshot();
const beforeReport = runtimeEngine.getCoreTrustReport();

const marketEvent = {
  eventId: "wave10-market-1",
  eventType: EVENT_TYPE.MARKET_TICK_RECEIVED,
  timestamp: "2026-01-01T00:00:01.000Z",
  source: "mock-market",
  payload: {
    symbol: "BTCUSDT",
    price: 101,
    bid: 100,
    ask: 102,
    volume: 1,
    provider: "mock-market",
    marketInputIntegrity: {
      sequence: 1,
      sequenceStatus: "ordered",
      gapStatus: "none",
      duplicateStatus: "none",
      freshnessStatus: "fresh",
      checksumStatus: "valid",
      payloadHash: "sha256:wave10-market-1"
    },
    provenance: {
      originRef: "mock-feed:BTCUSDT:1",
      parentProvenanceIds: ["prov:mock-feed-root"]
    },
    metadataEvents: [{
      eventId: "metadata.wave10.market.1",
      eventType: "metadata.provenance.recorded",
      source: "core",
      timestamp: "2026-01-01T00:00:00.000Z",
      originRef: "mock-feed:BTCUSDT:1",
      parentProvenanceIds: ["prov:mock-feed-root"],
      payload: { kind: "observable-trace-provenance" }
    }]
  }
};

const accepted = runtimeEngine.commitEventResult(marketEvent as any, { log: false });
assert.equal(accepted.status, "accepted");

const acceptedTrace = runtimeEngine.getCausalityTraceView(10).find((trace) => trace.eventId === "wave10-market-1");
assert.ok(acceptedTrace, "accepted market event creates trace");

const manualTraceA = buildCausalityTrace({
  event: {
    eventId: "wave10-manual-a",
    eventType: "manual.observable.test",
    source: "test",
    payload: {
      metadataEvents: [{
        eventId: "metadata.wave10.manual.a",
        eventType: "metadata.provenance.recorded",
        source: "core",
        originRef: "manual-origin-a",
        payload: { kind: "manual" }
      }],
      provenance: { originRef: "manual-origin-a" }
    }
  } as any,
  beforeSnapshot,
  afterSnapshot: beforeSnapshot,
  beforeReport,
  afterReport: beforeReport,
  transitionStatus: "unknown",
  generatedAt: "2099-01-01T00:00:00.000Z"
});

const manualTraceB = buildCausalityTrace({
  event: {
    eventId: "wave10-manual-b",
    eventType: "manual.observable.test",
    source: "test",
    payload: {
      marketInputIntegrity: {
        sequenceStatus: "ordered",
        gapStatus: "gap",
        duplicateStatus: "none",
        freshnessStatus: "stale",
        checksumStatus: "valid"
      },
      symbol: "ETHUSDT",
      price: 200,
      bid: 199,
      ask: 201,
      provider: "mock-market"
    }
  } as any,
  beforeSnapshot,
  afterSnapshot: beforeSnapshot,
  beforeReport,
  afterReport: beforeReport,
  transitionStatus: "rejected",
  generatedAt: "1970-01-01T00:00:00.000Z",
  quarantineRecordId: "quarantine:wave10-manual-b"
});

const mappingA = buildObservableTraceMapping([manualTraceB, acceptedTrace!, manualTraceA]);
const mappingB = buildObservableTraceMapping([acceptedTrace!, manualTraceA, manualTraceB]);

assert.deepEqual(
  mappingA.replaySteps.map((step) => step.traceId),
  mappingB.replaySteps.map((step) => step.traceId),
  "replay ordering stable"
);

assert.deepEqual(
  mappingA.causalityChain.map((step) => step.observableId),
  mappingB.causalityChain.map((step) => step.observableId),
  "causality ordering stable"
);

assert.ok(mappingA.revisionHistory.length >= 3, "revision history is present");
assert.ok(mappingA.provenanceLineage.some((step) => step.refs.metadataEventIds.includes("metadata.wave10.market.1")), "provenance lineage visible");
assert.ok(mappingA.marketInputIntegrity.some((step) => step.eventId === "wave10-market-1"), "market input integrity visible");
assert.ok(mappingA.integrityFailures.some((step) => step.eventId === "wave10-manual-b"), "integrity failures visible");
assert.ok(mappingA.quarantineRecoveryVisibility.some((step) => step.refs.quarantineRecordId === "quarantine:wave10-manual-b"), "quarantine visibility present");
assert.equal(mappingA.timeTravel.cursorField, "revisionCursor");
assert.ok(mappingA.timeTravel.readOnlyRule.includes("UI observes"), "time-travel semantics keep UI read-only");

const snapshotStepsA = mappingA.snapshotTransitions.map((step) => ({
  observableId: step.observableId,
  revision: step.revision,
  summary: step.summary
}));
const snapshotStepsB = mappingB.snapshotTransitions.map((step) => ({
  observableId: step.observableId,
  revision: step.revision,
  summary: step.summary
}));
assert.deepEqual(snapshotStepsA, snapshotStepsB, "snapshot transition deterministic");

const stepKinds = mapTraceToObservableSteps(acceptedTrace!).map((step) => step.kind);
assert.ok(stepKinds.includes("event"));
assert.ok(stepKinds.includes("metadata_provenance"));
assert.ok(stepKinds.includes("transition"));
assert.ok(stepKinds.includes("snapshot"));
assert.ok(stepKinds.includes("trust"));
assert.ok(stepKinds.includes("gate_verdict"));
assert.ok(stepKinds.includes("market_input"));

console.log(JSON.stringify({
  exampleObservableTraceMapping: {
    mappingVersion: mappingA.mappingVersion,
    ordering: mappingA.ordering,
    revisionCursor: mappingA.revisionCursor,
    firstReplayStep: mappingA.replaySteps[0],
    firstCausalityStep: mappingA.causalityChain[0],
    timeTravel: mappingA.timeTravel
  }
}, null, 2));
console.log("wave10 observable trace mapping checks passed");
