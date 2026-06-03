import assert from "node:assert/strict";
import { EVENT_TYPE } from "../../core/contracts/src/events.js";
import {
  buildCausalityTrace,
  summarizeChangedDomains
} from "../../core/trace/causality-trace.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

runtimeEngine.clearPersistenceAndReset();

const beforeSnapshot = runtimeEngine.getSnapshot();
const beforeReport = runtimeEngine.getCoreTrustReport();

const metadataEvent = {
  eventId: "metadata.provenance.1",
  eventType: "metadata.provenance.recorded",
  source: "core",
  timestamp: "2026-01-01T00:00:00.000Z",
  schemaVersion: "v1",
  metadataType: "action_provenance",
  originRef: "operator:intake:wave8",
  parentProvenanceIds: ["prov:parent:root"],
  payload: {
    actor: "role5",
    intent: "observe-provenance"
  }
};

const provenanceEvent = {
  eventId: "wave8-market-with-provenance",
  eventType: EVENT_TYPE.MARKET_TICK_RECEIVED,
  timestamp: "2026-01-01T00:00:01.000Z",
  source: "test-provider",
  payload: {
    symbol: "BTCUSDT",
    price: 100,
    bid: 99,
    ask: 101,
    volume: 1,
    provider: "test-provider",
    metadataEvents: [metadataEvent],
    provenance: {
      originRef: "operator:intake:wave8",
      parentProvenanceIds: ["prov:parent:root"]
    }
  }
};

const afterSnapshot = runtimeEngine.commitEventSilent(provenanceEvent as any);
const afterReport = runtimeEngine.getCoreTrustReport();
const runtimeTrace = runtimeEngine.getCausalityTraceView(5).at(-1)!;

assert.equal(runtimeTrace.eventId, "wave8-market-with-provenance");
assert.equal(runtimeTrace.traceVersion, "causality-trace-v2");
assert.equal(runtimeTrace.originRef, "operator:intake:wave8", "action provenance is visible in trace");
assert.equal(runtimeTrace.metadataEvents.length, 1, "metadata event appears in CausalityTrace");
assert.equal(runtimeTrace.metadataEvents[0].eventId, "metadata.provenance.1");
assert.deepEqual(runtimeTrace.parentProvenanceIds, ["prov:parent:root"], "parent provenance chain is displayed");
assert.equal(runtimeTrace.provenanceCompleteness.status, "complete");
assert.ok(runtimeTrace.provenanceTraceSummary.summary.includes("provenance complete"), "trace summary is UI-readable");
assert.ok(runtimeTrace.summary.includes("provenance complete"), "main summary contains provenance status");

const changed = summarizeChangedDomains(beforeSnapshot, afterSnapshot);
assert.ok(changed.changedDomains.includes("market"));

const manual = buildCausalityTrace({
  event: provenanceEvent as any,
  beforeSnapshot,
  afterSnapshot,
  beforeReport,
  afterReport,
  transitionStatus: "accepted",
  reducerName: "reduceSnapshot",
  generatedAt: "1970-01-01T00:00:00.000Z"
});
const manualAgain = buildCausalityTrace({
  event: provenanceEvent as any,
  beforeSnapshot,
  afterSnapshot,
  beforeReport,
  afterReport,
  transitionStatus: "accepted",
  reducerName: "reduceSnapshot",
  generatedAt: "2099-01-01T00:00:00.000Z"
});
assert.equal(manual.traceId, manualAgain.traceId, "trace remains deterministic independent of generatedAt");

const missing = buildCausalityTrace({
  eventId: "no-provenance",
  eventType: "manual.event",
  beforeSnapshot: afterSnapshot,
  afterSnapshot,
  beforeReport: afterReport,
  afterReport,
  transitionStatus: "unknown",
  generatedAt: "1970-01-01T00:00:00.000Z"
});
assert.equal(missing.provenanceCompleteness.status, "missing", "missing provenance is visible as gap");
assert.ok(missing.provenanceCompleteness.gaps.includes("origin_ref_missing"));
assert.ok(missing.provenanceCompleteness.gaps.includes("metadata_events_missing"));
assert.equal(missing.provenanceChain[0].status, "gap", "missing provenance is not modeled as corruption");

const snapshotAfterTraceBuild = runtimeEngine.getSnapshot();
buildCausalityTrace({
  event: provenanceEvent as any,
  beforeSnapshot: snapshotAfterTraceBuild,
  afterSnapshot: snapshotAfterTraceBuild,
  beforeReport: runtimeEngine.getCoreTrustReport(),
  afterReport: runtimeEngine.getCoreTrustReport(),
  transitionStatus: "unknown",
  generatedAt: "1970-01-01T00:00:00.000Z"
});
assert.equal(runtimeEngine.getSnapshot().revision, snapshotAfterTraceBuild.revision, "trace does not mutate state");

console.log(JSON.stringify({
  exampleTrace: {
    traceId: runtimeTrace.traceId,
    eventId: runtimeTrace.eventId,
    eventType: runtimeTrace.eventType,
    originRef: runtimeTrace.originRef,
    parentProvenanceIds: runtimeTrace.parentProvenanceIds,
    metadataEvents: runtimeTrace.metadataEvents,
    provenanceCompleteness: runtimeTrace.provenanceCompleteness,
    provenanceTraceSummary: runtimeTrace.provenanceTraceSummary
  }
}, null, 2));

console.log("wave8 causality provenance checks passed");
