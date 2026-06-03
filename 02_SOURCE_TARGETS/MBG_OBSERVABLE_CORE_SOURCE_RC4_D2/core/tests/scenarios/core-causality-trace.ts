import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, makeEvent } from "../../core/contracts/src/events.js";
import {
  attachGateVerdict,
  attachLedgerRecord,
  attachQuarantineRecord,
  buildCausalityTrace,
  compareBlockingReasons,
  compareTrustState,
  summarizeChangedDomains
} from "../../core/trace/causality-trace.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

runtimeEngine.clearPersistenceAndReset();

const before = runtimeEngine.getSnapshot();
const accepted = runtimeEngine.commitEventResult(makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
  symbol: "BTCUSDT",
  price: 100,
  bid: 99,
  ask: 101,
  volume: 1,
  provider: "test"
}), { log: false });

assert.equal(accepted.status, "accepted");
let traces = runtimeEngine.getCausalityTraceView(10);
assert.ok(traces.some((trace) => trace.eventType === EVENT_TYPE.MARKET_TICK_RECEIVED && trace.transitionStatus === "accepted"), "accepted event creates causality trace");

const acceptedTrace = traces.at(-1)!;
assert.equal(acceptedTrace.revisionBefore, before.revision);
assert.equal(acceptedTrace.revisionAfter, runtimeEngine.getSnapshot().revision);
assert.ok(acceptedTrace.changedDomains.includes("market"), "changed domains detected correctly");
assert.ok(acceptedTrace.trustStateBefore);
assert.ok(acceptedTrace.trustStateAfter);
assert.ok(typeof acceptedTrace.summary === "string" && acceptedTrace.summary.includes(EVENT_TYPE.MARKET_TICK_RECEIVED), "trace summary is UI-readable");

const snapshotAfterAccepted = runtimeEngine.getSnapshot();
const revisionAfterAccepted = snapshotAfterAccepted.revision;
const rejected = runtimeEngine.commitEventResult({
  eventId: "bad-market-tick",
  eventType: EVENT_TYPE.MARKET_TICK_RECEIVED,
  timestamp: new Date().toISOString(),
  source: "test",
  payload: {
    symbol: "BTCUSDT",
    price: -1,
    bid: 99,
    ask: 101,
    volume: 1,
    provider: "test"
  }
} as any, { log: false });

assert.equal(rejected.status, "rejected");
assert.equal(runtimeEngine.getSnapshot().revision, revisionAfterAccepted, "trace does not mutate snapshot");
traces = runtimeEngine.getCausalityTraceView(20);
const rejectedTrace = traces.find((trace) => trace.eventId === "bad-market-tick");
assert.ok(rejectedTrace, "rejected event can create trace");
assert.equal(rejectedTrace?.transitionStatus, "rejected");
assert.ok(rejectedTrace?.quarantineRecordId, "rejected trace has quarantine reference");

const quarantine = runtimeEngine.getQuarantineRecords(1).at(-1)!;
const attachedQ = attachQuarantineRecord(acceptedTrace, quarantine);
assert.equal(attachedQ.quarantineRecordId, quarantine.quarantineId, "trace can reference quarantine record");

const dispatched = runtimeEngine.dispatchAction({ type: ACTION_TYPE.PLACE_ORDER });
const decision = (dispatched as any).decision ?? dispatched;
const ledgerRecord = runtimeEngine.getPermissionLedgerView(1).records.at(-1)!;
const attachedL = attachLedgerRecord(acceptedTrace, ledgerRecord);
assert.equal(attachedL.permissionRecordId, ledgerRecord.permissionId, "trace can reference permission ledger record");
assert.ok(runtimeEngine.getCausalityTraceView(20).some((trace) => trace.permissionRecordId === ledgerRecord.permissionId), "permission evaluation creates trace with ledger reference");

const attachedVerdict = attachGateVerdict(acceptedTrace, decision);
assert.equal(attachedVerdict.gateVerdictAfter?.actionType, ACTION_TYPE.PLACE_ORDER);

const manual = buildCausalityTrace({
  eventId: "manual",
  eventType: "manual.event",
  beforeSnapshot: snapshotAfterAccepted,
  afterSnapshot: snapshotAfterAccepted,
  beforeReport: runtimeEngine.getCoreTrustReport(),
  afterReport: runtimeEngine.getCoreTrustReport(),
  transitionStatus: "unknown",
  generatedAt: "1970-01-01T00:00:00.000Z"
});
const manualAgain = buildCausalityTrace({
  eventId: "manual",
  eventType: "manual.event",
  beforeSnapshot: snapshotAfterAccepted,
  afterSnapshot: snapshotAfterAccepted,
  beforeReport: runtimeEngine.getCoreTrustReport(),
  afterReport: runtimeEngine.getCoreTrustReport(),
  transitionStatus: "unknown",
  generatedAt: "2099-01-01T00:00:00.000Z"
});
assert.equal(manual.traceId, manualAgain.traceId, "trace has deterministic generation rule");

const domainSummary = summarizeChangedDomains(snapshotAfterAccepted, runtimeEngine.getSnapshot());
assert.deepEqual(domainSummary.changedDomains, [], "same snapshot has no changed domains");

const blockerDiff = compareBlockingReasons([{ code: "a", domain: "x", severity: "blocking", message: "A" }], [
  { code: "a", domain: "x", severity: "blocking", message: "A" },
  { code: "b", domain: "y", severity: "warning", message: "B" }
]);
assert.equal(blockerDiff.added.length, 1, "blocking reasons diff captured");
assert.equal(blockerDiff.unchanged.length, 1);

const trustDiff = compareTrustState("UNCERTAIN", "TRUSTED");
assert.equal(trustDiff.changed, true, "trust state diff captured");

console.log("core causality trace checks passed");
