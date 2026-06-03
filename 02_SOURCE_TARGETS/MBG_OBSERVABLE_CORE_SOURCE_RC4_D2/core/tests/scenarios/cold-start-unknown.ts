import assert from "node:assert/strict";
import { initialSnapshot } from "../../core/state/src/types.js";
import { ActionGate } from "../../core/gates/src/action-gate.js";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, makeEvent } from "../../core/contracts/src/events.js";
import { reduceSnapshot } from "../../core/runtime/src/runtime-engine.js";

function validProbeProvenance() {
  return {
    status: "complete" as const,
    blockingReasons: [],
    traceId: "cold-start-test-trace",
    sourceEventId: "cold-start-test-event",
    checkedAt: "2025-01-01T00:00:00.000Z",
    severity: "info" as const,
    evidence: { source: "cold-start-test" }
  };
}

function placeOrderProbe(snapshot: ReturnType<typeof initialSnapshot>, withProvenance = false) {
  return new ActionGate().evaluate({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 100
  }, snapshot, withProvenance ? { provenance: validProbeProvenance() } : {});
}

function testColdStartIsUnknownAndBlocked() {
  const snapshot = initialSnapshot();

  assert.equal(snapshot.position.status, "unknown");
  assert.equal(snapshot.position.quantity, 0);
  assert.equal(snapshot.position.exposure, 0);

  assert.equal(snapshot.risk.status, "blocked");
  assert.deepEqual(snapshot.risk.reasons, ["bootstrap_position_not_reconciled"]);

  assert.equal(snapshot.system.status, "bootstrapping");

  const decision = placeOrderProbe(snapshot);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "bootstrap_not_reconciled");
  assert.deepEqual(decision.blockingStates, ["bootstrap", "exchangeTruth", "position", "risk", "provenance", "market"]);
}

function testPositionReconciledZeroBecomesFlatOnlyAfterExchangeReconcile() {
  const initial = initialSnapshot();
  assert.equal(initial.position.status, "unknown");

  const snapshot = reduceSnapshot(initial, makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 100,
    exposure: 0,
    source: "exchange"
  }));

  assert.equal(snapshot.position.status, "flat");
  assert.equal(snapshot.position.quantity, 0);
  assert.equal(snapshot.position.source, "exchange");
  assert.ok(snapshot.position.lastReconciledAt);
}

function testPositionReconciledNonZeroBecomesOpen() {
  const snapshot = reduceSnapshot(initialSnapshot(), makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0.25,
    locked: 0,
    quantity: 0.25,
    markPrice: 100,
    exposure: 25,
    source: "exchange"
  }));

  assert.equal(snapshot.position.status, "open");
  assert.equal(snapshot.position.quantity, 0.25);
  assert.equal(snapshot.position.exposure, 25);
  assert.equal(snapshot.position.source, "exchange");
}

function testPlaceOrderAllowedOnlyAfterMarketAndPositionReconcile() {
  const afterMarket = reduceSnapshot(initialSnapshot(), makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 100,
    bid: 99,
    ask: 101,
    volume: 1,
    provider: "cold-start-test"
  }));

  const deniedBeforeReconcile = placeOrderProbe(afterMarket);
  assert.equal(deniedBeforeReconcile.decision, "deny");
  assert.equal(deniedBeforeReconcile.reason, "bootstrap_not_reconciled");

  const afterReconcile = reduceSnapshot(afterMarket, makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 100,
    exposure: 0,
    source: "exchange"
  }));

  assert.equal(afterReconcile.position.status, "flat");
  assert.equal(afterReconcile.risk.status, "blocked");
  assert.ok(afterReconcile.risk.reasons.includes("bootstrap_not_reconciled"));
  assert.equal(afterReconcile.system.status, "degraded");

  const deniedBeforeBootstrap = placeOrderProbe(afterReconcile);
  assert.equal(deniedBeforeBootstrap.decision, "deny");
  assert.equal(deniedBeforeBootstrap.reason, "bootstrap_not_reconciled");

  const afterBootstrapLoading = reduceSnapshot(afterReconcile, makeEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "cold-start-test" }));
  const afterBootstrapReplay = reduceSnapshot(afterBootstrapLoading, makeEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "cold-start-test" }));
  const afterBootstrapAwaitingTruth = reduceSnapshot(afterBootstrapReplay, makeEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "cold-start-test" }));
  const afterBootstrapReconciled = reduceSnapshot(afterBootstrapAwaitingTruth, makeEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "cold-start-test" }));

  assert.equal(afterBootstrapReconciled.bootstrap.status, "reconciled");

  const afterExchangeTruth = reduceSnapshot(afterBootstrapReconciled, makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    lastAccountReconcileAt: new Date().toISOString(),
    lastPositionReconcileAt: new Date().toISOString(),
    lastOrderReconcileAt: new Date().toISOString(),
    lastFillSyncAt: new Date().toISOString(),
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }));

  const afterHealthTruth = reduceSnapshot(afterExchangeTruth, makeEvent(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    source: "cold-start-test"
  }));

  assert.equal(afterHealthTruth.exchangeTruth.status, "fresh");
  assert.equal(afterHealthTruth.risk.status, "clear");
  assert.deepEqual(afterHealthTruth.risk.reasons, []);
  assert.equal(afterHealthTruth.system.status, "healthy");

  const allowedAfterReconcile = placeOrderProbe(afterHealthTruth, true);
  assert.equal(allowedAfterReconcile.decision, "allow");
}

testColdStartIsUnknownAndBlocked();
testPositionReconciledZeroBecomesFlatOnlyAfterExchangeReconcile();
testPositionReconciledNonZeroBecomesOpen();
testPlaceOrderAllowedOnlyAfterMarketAndPositionReconcile();

console.log(JSON.stringify({
  name: "cold_start_unknown",
  ok: true
}, null, 2));
