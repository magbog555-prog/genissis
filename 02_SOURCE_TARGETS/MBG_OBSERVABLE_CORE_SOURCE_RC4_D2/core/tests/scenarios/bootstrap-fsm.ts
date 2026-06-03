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
    traceId: "bootstrap-test-trace",
    sourceEventId: "bootstrap-test-event",
    checkedAt: "2025-01-01T00:00:00.000Z",
    severity: "info" as const,
    evidence: { source: "bootstrap-test" }
  };
}

function placeOrder(snapshot: RuntimeSnapshot, withProvenance = false) {
  return new ActionGate().evaluate({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  }, snapshot, withProvenance ? { provenance: validProbeProvenance() } : {});
}

function marketAndPositionReconciled(snapshot: RuntimeSnapshot) {
  const afterMarket = reduceSnapshot(snapshot, makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "bootstrap-test"
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

function advanceBootstrap(snapshot: RuntimeSnapshot) {
  const loading = reduceSnapshot(snapshot, makeEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "test_loading_snapshot" }));
  assert.equal(loading.bootstrap.status, "loading_snapshot");

  const replaying = reduceSnapshot(loading, makeEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "test_replaying_tail" }));
  assert.equal(replaying.bootstrap.status, "replaying_tail");

  const awaiting = reduceSnapshot(replaying, makeEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "test_awaiting_exchange_truth" }));
  assert.equal(awaiting.bootstrap.status, "awaiting_exchange_truth");

  const reconciled = reduceSnapshot(awaiting, makeEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "test_reconciled" }));
  assert.equal(reconciled.bootstrap.status, "reconciled");

  return { loading, replaying, awaiting, reconciled };
}

function testColdStartStatus() {
  const snapshot = initialSnapshot();

  assert.equal(snapshot.bootstrap.status, "cold");
  assert.equal(snapshot.bootstrap.quarantineRequired, false);
  assert.equal(snapshot.position.status, "unknown");
  assert.equal(snapshot.risk.status, "blocked");

  const decision = placeOrder(snapshot);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "bootstrap_not_reconciled");
}

function testLifecycleSequence() {
  const snapshot = initialSnapshot();
  const { loading, replaying, awaiting, reconciled } = advanceBootstrap(snapshot);

  assert.equal(loading.bootstrap.status, "loading_snapshot");
  assert.equal(replaying.bootstrap.status, "replaying_tail");
  assert.equal(awaiting.bootstrap.status, "awaiting_exchange_truth");
  assert.equal(reconciled.bootstrap.status, "reconciled");
}

function testFailedCannotDirectlyReconcile() {
  const failed = reduceSnapshot(initialSnapshot(), makeEvent(EVENT_TYPE.BOOTSTRAP_FAILED, {
    reason: "test_failure",
    quarantineRequired: true
  }));

  assert.equal(failed.bootstrap.status, "failed");
  assert.equal(failed.bootstrap.quarantineRequired, true);

  const illegalDirectReconcile = reduceSnapshot(failed, makeEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, {
    reason: "illegal_direct_reconcile"
  }));

  assert.equal(illegalDirectReconcile.bootstrap.status, "failed");
  assert.equal(placeOrder(illegalDirectReconcile).decision, "deny");
  assert.equal(placeOrder(illegalDirectReconcile).reason, "bootstrap_failed");

  const recovered = reduceSnapshot(failed, makeEvent(EVENT_TYPE.BOOTSTRAP_RECOVERY_STARTED, {
    reason: "test_recovery"
  }));

  assert.equal(recovered.bootstrap.status, "loading_snapshot");
  assert.equal(recovered.bootstrap.quarantineRequired, false);
}

function testPlaceOrderDeniedUntilBootstrapReconciled() {
  const readyExceptBootstrap = marketAndPositionReconciled(initialSnapshot());

  const loading = reduceSnapshot(readyExceptBootstrap, makeEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, {}));
  const replaying = reduceSnapshot(loading, makeEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, {}));
  const awaiting = reduceSnapshot(replaying, makeEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, {}));

  const states = [readyExceptBootstrap, loading, replaying, awaiting];
  for (const state of states) {
    const decision = placeOrder(state);
    assert.equal(decision.decision, "deny", `PLACE_ORDER must be denied during ${state.bootstrap.status}`);
    if (state.bootstrap.status === "awaiting_exchange_truth") {
      assert.equal(decision.reason, "bootstrap_awaiting_exchange_truth");
    } else {
      assert.equal(decision.reason, "bootstrap_not_reconciled");
    }
  }

  const reconciled = reduceSnapshot(awaiting, makeEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, {}));
  const deniedWithoutExchangeTruth = placeOrder(reconciled);
  assert.equal(reconciled.bootstrap.status, "reconciled");
  assert.equal(deniedWithoutExchangeTruth.decision, "deny");
  assert.equal(deniedWithoutExchangeTruth.reason, "exchange_truth_unknown");

  const exchangeFresh = reduceSnapshot(reconciled, makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
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

  const healthy = reduceSnapshot(exchangeFresh, makeEvent(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    source: "bootstrap-test"
  }));

  const decision = placeOrder(healthy, true);
  assert.equal(healthy.risk.status, "clear");
  assert.equal(decision.decision, "allow");
}

testColdStartStatus();
testLifecycleSequence();
testFailedCannotDirectlyReconcile();
testPlaceOrderDeniedUntilBootstrapReconciled();

console.log(JSON.stringify({
  name: "bootstrap_fsm",
  ok: true
}, null, 2));
