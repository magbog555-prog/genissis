import assert from "node:assert";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { EVENT_TYPE, makeEvent } from "../../core/contracts/src/events.js";

runtimeEngine.clearPersistenceAndReset();

let p = runtimeEngine.getPermissions();
assert.equal(p.tradingAllowed, false);
assert.equal(p.actions.place_order.decision, "deny");
assert.equal(p.actions.place_order.reason, "bootstrap_not_reconciled");

runtimeEngine.ingestMarketTick({
  symbol: "BTCUSDT",
  price: 65000,
  bid: 64999,
  ask: 65001,
  volume: 1,
  provider: "test"
});
p = runtimeEngine.getPermissions();
assert.equal(p.tradingAllowed, false);
assert.equal(p.actions.place_order.decision, "deny");
assert.equal(p.actions.place_order.reason, "bootstrap_not_reconciled");

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
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

p = runtimeEngine.getPermissions();
assert.equal(p.tradingAllowed, false);
assert.equal(p.actions.place_order.decision, "deny");
assert.equal(p.actions.place_order.reason, "bootstrap_not_reconciled");

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "test" }));
runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "test" }));
runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "test" }));
runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "test" }));

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
  source: "exchange",
  provider: "test",
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

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
  connection: "websocket",
  status: "connected",
  source: "test"
}));


p = runtimeEngine.getPermissions();
assert.equal(p.tradingAllowed, false);
assert.equal(p.actions.place_order.decision, "deny");
assert.equal(p.actions.place_order.reason, "provenance_missing");
assert.equal(p.actions.place_order.provenanceStatus, "missing");

console.log("5 gate scenario base checks passed with provenance risk gate");
