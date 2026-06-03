import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `mbg-core-idempotency-${process.pid}-${Date.now()}`);
process.env.GENESIS_DATA_DIR = dataDir;
process.env.PERSISTENCE_ENABLED = "true";

const { RuntimeEngine } = await import("../../core/runtime/src/runtime-engine.js");
const { EVENT_TYPE } = await import("../../core/contracts/src/events.js");
const { PnLEngine } = await import("../../core/pnl/pnl-engine.js");

function clone<T>(value: T): T {
  return structuredClone(value);
}

function makeEvent(eventId: string, eventType: string, payload: unknown, timestamp = "2026-05-06T00:00:00.000Z") {
  return { eventId, eventType: eventType as any, timestamp, payload };
}

const engine = new RuntimeEngine();
engine.clearPersistenceAndReset();

const firstMarket = makeEvent("evt-market-1", EVENT_TYPE.MARKET_TICK_RECEIVED, {
  symbol: "BTCUSDT",
  price: 100,
  bid: 99,
  ask: 101,
  volume: 1,
  provider: "idempotency-test"
});

const firstCommit = engine.commitEventWithDiagnostic(firstMarket);
assert.equal(firstCommit.diagnostic.decision, "accepted");
assert.equal(firstCommit.snapshot.revision, 1);

const snapshotBeforeDuplicate = clone(engine.getSnapshot());
const duplicateCommit = engine.commitEventWithDiagnostic(firstMarket);
assert.equal(duplicateCommit.diagnostic.decision, "duplicate_ignored");
assert.equal(duplicateCommit.diagnostic.scope, "eventId");
assert.deepEqual(engine.getSnapshot(), snapshotBeforeDuplicate);
assert.equal(engine.getSnapshot().revision, snapshotBeforeDuplicate.revision);
assert.equal(engine.getMetrics().totalEvents, 1);

const conflictingDuplicate = makeEvent("evt-market-1", EVENT_TYPE.MARKET_TICK_RECEIVED, {
  symbol: "BTCUSDT",
  price: 101,
  bid: 100,
  ask: 102,
  volume: 2,
  provider: "idempotency-test"
});
const beforeConflict = clone(engine.getSnapshot());
const conflictCommit = engine.commitEventWithDiagnostic(conflictingDuplicate);
assert.equal(conflictCommit.diagnostic.decision, "duplicate_conflict");
assert.equal(conflictCommit.diagnostic.scope, "eventId");
assert.deepEqual(engine.getSnapshot(), beforeConflict);
assert.equal(engine.getSnapshot().revision, beforeConflict.revision);

const fillPayload = {
  fillId: "fill-1",
  exchangeReportId: "report-1",
  orderId: "order-1",
  symbol: "BTCUSDT",
  side: "buy",
  quantity: 0.1,
  filledQuantity: 0.1,
  filledQuantityDelta: 0.1,
  fillPrice: 100,
  exchangeStatus: "FILLED",
  provider: "idempotency-test"
};

const fillEvent = makeEvent("evt-fill-1", EVENT_TYPE.ORDER_EXECUTION_REPORTED, fillPayload, "2026-05-06T00:00:01.000Z");
engine.commitEventWithDiagnostic(fillEvent);
const afterFill = clone(engine.getSnapshot());
assert.equal(afterFill.position.quantity, 0.1);

const duplicateFillEvent = makeEvent("evt-fill-duplicate-new-event-id", EVENT_TYPE.ORDER_EXECUTION_REPORTED, fillPayload, "2026-05-06T00:00:02.000Z");
const duplicateFill = engine.commitEventWithDiagnostic(duplicateFillEvent);
assert.equal(duplicateFill.diagnostic.decision, "duplicate_ignored");
assert.equal(duplicateFill.diagnostic.scope, "fillId");
assert.deepEqual(engine.getSnapshot(), afterFill);
assert.equal(engine.getSnapshot().revision, afterFill.revision);
assert.equal(engine.getSnapshot().position.quantity, 0.1);

const pnlEngine = new PnLEngine();
const pnlFill = pnlEngine.normalizeFill({
  id: "pnl-fill-1",
  symbol: "BTCUSDT",
  side: "BUY",
  price: 100,
  qty: 0.1,
  quoteQty: 10,
  commission: 0,
  time: 1,
  expectedPrice: 100
});
const pnlAfterFirst = pnlEngine.onFill(pnlFill);
const pnlNetAfterFirst = pnlEngine.getPnL().netPnl;
const pnlAfterDuplicate = pnlEngine.onFill(pnlFill);
assert.equal(pnlAfterDuplicate.processedFillIds.length, 1);
assert.deepEqual(pnlAfterDuplicate.duplicateFillIds, ["pnl-fill-1"]);
assert.equal(pnlAfterDuplicate.position, pnlAfterFirst.position);
assert.equal(pnlEngine.getPnL().netPnl, pnlNetAfterFirst);

const reconcilePayload = {
  reconcileId: "reconcile-1",
  symbol: "BTCUSDT",
  asset: "BTC",
  quoteAsset: "USDT",
  free: 0.1,
  locked: 0,
  quantity: 0.1,
  markPrice: 100,
  exposure: 10,
  source: "exchange"
};
engine.commitEventWithDiagnostic(makeEvent("evt-reconcile-1", EVENT_TYPE.POSITION_RECONCILED, reconcilePayload, "2026-05-06T00:00:03.000Z"));
const afterReconcile = clone(engine.getSnapshot());
const duplicateReconcile = engine.commitEventWithDiagnostic(makeEvent("evt-reconcile-2", EVENT_TYPE.POSITION_RECONCILED, reconcilePayload, "2026-05-06T00:00:04.000Z"));
assert.equal(duplicateReconcile.diagnostic.decision, "duplicate_ignored");
assert.equal(duplicateReconcile.diagnostic.scope, "reconcileId");
assert.deepEqual(engine.getSnapshot(), afterReconcile);
assert.equal(engine.getSnapshot().revision, afterReconcile.revision);

const replay = engine.replayCheck();
assert.equal(replay.ok, true);
assert.equal(replay.currentRevision, engine.getSnapshot().revision);
assert.equal(replay.replayRevision, engine.getSnapshot().revision);

const recoveredEngine = new RuntimeEngine();
const recoveredBefore = clone(recoveredEngine.getSnapshot());
assert.equal(recoveredBefore.revision, engine.getSnapshot().revision);

const duplicateAfterRecovery = recoveredEngine.commitEventWithDiagnostic(firstMarket);
assert.equal(duplicateAfterRecovery.diagnostic.decision, "duplicate_ignored");
assert.equal(duplicateAfterRecovery.diagnostic.scope, "eventId");
assert.deepEqual(recoveredEngine.getSnapshot(), recoveredBefore);
assert.equal(recoveredEngine.getSnapshot().revision, recoveredBefore.revision);

const idempotency = engine.getIdempotencyView();
assert.ok(idempotency.duplicateEventCount >= 3);
assert.equal(idempotency.conflictCount, 1);

fs.rmSync(dataDir, { recursive: true, force: true });

console.log(JSON.stringify({
  name: "core_idempotency",
  ok: true,
  revision: engine.getSnapshot().revision,
  replay,
  idempotency
}, null, 2));
