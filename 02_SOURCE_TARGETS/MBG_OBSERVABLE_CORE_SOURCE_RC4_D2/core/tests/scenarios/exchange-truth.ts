import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, makeEvent } from "../../core/contracts/src/events.js";
import { ActionGate } from "../../core/gates/src/action-gate.js";
import { reduceSnapshot } from "../../core/runtime/src/runtime-engine.js";
import { initialSnapshot, RuntimeSnapshot } from "../../core/state/src/types.js";

function validProbeProvenance() {
  return {
    status: "complete" as const,
    blockingReasons: [],
    traceId: "exchange-truth-test-trace",
    sourceEventId: "exchange-truth-test-event",
    checkedAt: "2025-01-01T00:00:00.000Z",
    severity: "info" as const,
    evidence: { source: "exchange-truth-test" }
  };
}

function placeOrder(snapshot: RuntimeSnapshot) {
  return new ActionGate().evaluate({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  }, snapshot, { provenance: validProbeProvenance() });
}

function applyBootstrapReconciled(snapshot: RuntimeSnapshot) {
  const loading = reduceSnapshot(snapshot, makeEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "exchange-truth-test" }));
  const replaying = reduceSnapshot(loading, makeEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "exchange-truth-test" }));
  const awaiting = reduceSnapshot(replaying, makeEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "exchange-truth-test" }));
  return reduceSnapshot(awaiting, makeEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "exchange-truth-test" }));
}

function applyMarketAndPosition(snapshot: RuntimeSnapshot) {
  const afterMarket = reduceSnapshot(snapshot, makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "exchange-truth-test"
  }));

  return reduceSnapshot(afterMarket, makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    source: "exchange"
  }));
}

function applyExchangeTruthFresh(snapshot: RuntimeSnapshot) {
  return reduceSnapshot(snapshot, makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "test_exchange_reconcile",
    lastAccountReconcileAt: new Date().toISOString(),
    lastPositionReconcileAt: new Date().toISOString(),
    lastOrderReconcileAt: new Date().toISOString(),
    lastFillSyncAt: new Date().toISOString(),
    drift: {},
    conflicts: [],
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0
  }));
}

function readySnapshot() {
  return applyExchangeTruthFresh(applyBootstrapReconciled(applyMarketAndPosition(initialSnapshot())));
}

function testColdStartUnknown() {
  const snapshot = initialSnapshot();
  assert.equal(snapshot.exchangeTruth.status, "unknown");
  assert.equal(snapshot.exchangeTruth.reason, "exchange_truth_unknown");

  const decision = placeOrder(snapshot);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "bootstrap_not_reconciled");
  assert.ok(decision.blockingStates?.includes("exchangeTruth"));
}

function testExchangeTruthUnknownDeniesAfterBootstrapReconciled() {
  const snapshot = applyBootstrapReconciled(applyMarketAndPosition(initialSnapshot()));
  assert.equal(snapshot.bootstrap.status, "reconciled");
  assert.equal(snapshot.exchangeTruth.status, "unknown");

  const decision = placeOrder(snapshot);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "exchange_truth_unknown");
  assert.ok(decision.blockingStates?.includes("exchangeTruth"));
}

function testReconcileSucceededFresh() {
  const snapshot = applyExchangeTruthFresh(initialSnapshot());
  assert.equal(snapshot.exchangeTruth.status, "fresh");
  assert.equal(snapshot.exchangeTruth.conflicts.length, 0);
  assert.ok(snapshot.exchangeTruth.lastAccountReconcileAt);
}

function testStaleDetectedDenies() {
  const fresh = readySnapshot();
  assert.equal(placeOrder(fresh).decision, "allow");

  const stale = reduceSnapshot(fresh, makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_STALE_DETECTED, {
    source: "test_exchange_reconcile",
    reason: "last reconcile exceeded ttl"
  }));

  assert.equal(stale.exchangeTruth.status, "stale");
  const decision = placeOrder(stale);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "exchange_truth_stale");
}

function testConflictDetectedDenies() {
  const fresh = readySnapshot();
  const conflicted = reduceSnapshot(fresh, makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_CONFLICT_DETECTED, {
    source: "test_exchange_reconcile",
    reason: "local flat but exchange open",
    localPositionStatus: "flat",
    exchangePositionStatus: "open",
    exchangePositionQuantity: 0.2
  }));

  assert.equal(conflicted.exchangeTruth.status, "conflicted");
  assert.ok(conflicted.exchangeTruth.conflicts.some((c) => c.code === "local_flat_exchange_open"));
  const decision = placeOrder(conflicted);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "exchange_truth_conflicted");
}

function testUnavailableDetectedDenies() {
  const fresh = readySnapshot();
  const unavailable = reduceSnapshot(fresh, makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_UNAVAILABLE_DETECTED, {
    source: "test_exchange_reconcile",
    reason: "exchange api unavailable"
  }));

  assert.equal(unavailable.exchangeTruth.status, "unavailable");
  const decision = placeOrder(unavailable);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "exchange_truth_unavailable");
}

function testBootstrapStillBlocksFreshExchangeTruth() {
  const freshTruthButColdBootstrap = applyExchangeTruthFresh(applyMarketAndPosition(initialSnapshot()));
  assert.equal(freshTruthButColdBootstrap.exchangeTruth.status, "fresh");
  assert.notEqual(freshTruthButColdBootstrap.bootstrap.status, "reconciled");

  const decision = placeOrder(freshTruthButColdBootstrap);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "bootstrap_not_reconciled");
  assert.ok(decision.blockingStates?.includes("bootstrap"));
}

function testAllowOnlyWhenBootstrapAndExchangeTruthAndRuntimeAreValid() {
  const snapshot = readySnapshot();
  assert.equal(snapshot.bootstrap.status, "reconciled");
  assert.equal(snapshot.exchangeTruth.status, "fresh");
  assert.equal(snapshot.market.status, "open");
  assert.equal(snapshot.position.status, "flat");
  assert.equal(snapshot.risk.status, "clear");

  const decision = placeOrder(snapshot);
  assert.equal(decision.decision, "allow");
}

testColdStartUnknown();
testExchangeTruthUnknownDeniesAfterBootstrapReconciled();
testReconcileSucceededFresh();
testStaleDetectedDenies();
testConflictDetectedDenies();
testUnavailableDetectedDenies();
testBootstrapStillBlocksFreshExchangeTruth();
testAllowOnlyWhenBootstrapAndExchangeTruthAndRuntimeAreValid();

console.log(JSON.stringify({
  name: "exchange_truth_domain",
  ok: true
}, null, 2));
