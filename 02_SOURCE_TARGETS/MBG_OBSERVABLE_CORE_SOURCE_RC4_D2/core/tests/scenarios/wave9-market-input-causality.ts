import assert from "node:assert/strict";
import { EVENT_TYPE } from "../../core/contracts/src/events.js";
import { buildCausalityTrace } from "../../core/trace/causality-trace.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

runtimeEngine.clearPersistenceAndReset();

const beforeSnapshot = runtimeEngine.getSnapshot();
const beforeReport = runtimeEngine.getCoreTrustReport();

const validEvent = {
  eventId: "wave9-market-valid-1",
  eventType: EVENT_TYPE.MARKET_TICK_RECEIVED,
  timestamp: "2026-01-01T00:00:01.000Z",
  source: "market-sim",
  payload: {
    symbol: "BTCUSDT",
    price: 101,
    bid: 100,
    ask: 102,
    volume: 3,
    provider: "market-sim",
    marketInputIntegrity: {
      sequence: 10,
      sequenceStatus: "ordered",
      gapStatus: "none",
      duplicateStatus: "none",
      freshnessStatus: "fresh",
      checksumStatus: "valid",
      payloadHash: "sha256:test-payload"
    },
    provenance: {
      originRef: "market-observation:sim:1",
      parentProvenanceIds: ["prov:feed:root"]
    },
    metadataEvents: [{
      eventId: "metadata.market.wave9.1",
      eventType: "metadata.provenance.recorded",
      source: "core",
      timestamp: "2026-01-01T00:00:00.000Z",
      originRef: "market-observation:sim:1",
      parentProvenanceIds: ["prov:feed:root"],
      payload: { kind: "market-input-provenance" }
    }]
  }
};

const accepted = runtimeEngine.commitEventResult(validEvent as any, { log: false });
assert.equal(accepted.status, "accepted");
const acceptedTrace = runtimeEngine.getCausalityTraceView(10).find((trace) => trace.eventId === "wave9-market-valid-1")!;
assert.ok(acceptedTrace, "valid market input visible in trace");
assert.equal(acceptedTrace.marketInputObservation?.symbol, "BTCUSDT");
assert.equal(acceptedTrace.validationResult.status, "passed");
assert.equal(acceptedTrace.sequenceStatus, "ordered");
assert.equal(acceptedTrace.gapStatus, "none");
assert.equal(acceptedTrace.duplicateStatus, "none");
assert.equal(acceptedTrace.freshnessStatus, "fresh");
assert.equal(acceptedTrace.checksumStatus, "valid");
assert.equal(acceptedTrace.provenanceRef, "market-observation:sim:1");
assert.equal(acceptedTrace.marketInputIntegritySummary.status, "valid");
assert.ok(acceptedTrace.marketInputIntegritySummary.snapshotMutated, "trace shows whether snapshot changed");

const snapshotAfterValid = runtimeEngine.getSnapshot();
const rejected = runtimeEngine.commitEventResult({
  eventId: "wave9-market-rejected-1",
  eventType: EVENT_TYPE.MARKET_TICK_RECEIVED,
  timestamp: "2026-01-01T00:00:02.000Z",
  source: "market-sim",
  payload: {
    symbol: "BTCUSDT",
    price: -1,
    bid: 100,
    ask: 102,
    volume: 1,
    provider: "market-sim",
    marketInputIntegrity: {
      sequence: 11,
      gapStatus: "gap",
      duplicateStatus: "none",
      freshnessStatus: "fresh",
      checksumStatus: "valid"
    }
  }
} as any, { log: false });

assert.equal(rejected.status, "rejected");
assert.equal(runtimeEngine.getSnapshot().revision, snapshotAfterValid.revision, "trace does not mutate state");
const rejectedTrace = runtimeEngine.getCausalityTraceView(20).find((trace) => trace.eventId === "wave9-market-rejected-1")!;
assert.equal(rejectedTrace.validationResult.status, "failed", "rejected input visible in trace");
assert.equal(rejectedTrace.gapStatus, "gap", "gap visible in trace");
assert.equal(rejectedTrace.marketInputIntegritySummary.status, "rejected");

const staleTrace = buildCausalityTrace({
  event: {
    eventId: "wave9-market-stale-1",
    eventType: EVENT_TYPE.MARKET_TICK_RECEIVED,
    timestamp: "2026-01-01T00:00:03.000Z",
    source: "market-sim",
    payload: {
      symbol: "ETHUSDT",
      price: 200,
      bid: 199,
      ask: 201,
      volume: 2,
      provider: "market-sim",
      marketInputIntegrity: {
        sequenceStatus: "ordered",
        gapStatus: "none",
        duplicateStatus: "none",
        freshnessStatus: "stale"
      }
    }
  } as any,
  beforeSnapshot: snapshotAfterValid,
  afterSnapshot: snapshotAfterValid,
  beforeReport,
  afterReport: runtimeEngine.getCoreTrustReport(),
  transitionStatus: "accepted",
  generatedAt: "1970-01-01T00:00:00.000Z"
});
assert.equal(staleTrace.freshnessStatus, "stale", "stale visible in trace");
assert.ok(staleTrace.marketInputIntegritySummary.issues.includes("freshness_stale"));
assert.equal(staleTrace.provenanceCompleteness.status, "missing", "missing provenance visible as gap, not corruption");
assert.ok(staleTrace.provenanceCompleteness.gaps.includes("origin_ref_missing"));

const duplicateTrace = buildCausalityTrace({
  event: validEvent as any,
  beforeSnapshot: snapshotAfterValid,
  afterSnapshot: snapshotAfterValid,
  beforeReport: runtimeEngine.getCoreTrustReport(),
  afterReport: runtimeEngine.getCoreTrustReport(),
  transitionStatus: "duplicate_ignored",
  generatedAt: "1970-01-01T00:00:00.000Z"
});
assert.equal(duplicateTrace.duplicateStatus, "duplicate", "duplicate visible in trace");

const deterministicA = buildCausalityTrace({
  event: validEvent as any,
  beforeSnapshot,
  afterSnapshot: snapshotAfterValid,
  beforeReport,
  afterReport: runtimeEngine.getCoreTrustReport(),
  transitionStatus: "accepted",
  generatedAt: "1970-01-01T00:00:00.000Z"
});
const deterministicB = buildCausalityTrace({
  event: validEvent as any,
  beforeSnapshot,
  afterSnapshot: snapshotAfterValid,
  beforeReport,
  afterReport: runtimeEngine.getCoreTrustReport(),
  transitionStatus: "accepted",
  generatedAt: "2099-01-01T00:00:00.000Z"
});
assert.equal(deterministicA.traceId, deterministicB.traceId, "trace remains deterministic");

assert.ok(typeof acceptedTrace.marketInputIntegritySummary.summary === "string");
console.log(JSON.stringify({
  exampleTrace: {
    traceId: acceptedTrace.traceId,
    eventId: acceptedTrace.eventId,
    marketInputObservation: acceptedTrace.marketInputObservation,
    validationResult: acceptedTrace.validationResult,
    sequenceStatus: acceptedTrace.sequenceStatus,
    gapStatus: acceptedTrace.gapStatus,
    duplicateStatus: acceptedTrace.duplicateStatus,
    freshnessStatus: acceptedTrace.freshnessStatus,
    provenanceRef: acceptedTrace.provenanceRef,
    payloadHash: acceptedTrace.payloadHash,
    checksumStatus: acceptedTrace.checksumStatus,
    marketInputIntegritySummary: acceptedTrace.marketInputIntegritySummary
  }
}, null, 2));
console.log("wave9 market input causality checks passed");
