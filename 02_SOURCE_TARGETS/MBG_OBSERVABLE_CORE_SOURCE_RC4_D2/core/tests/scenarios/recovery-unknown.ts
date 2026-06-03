
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { EVENT_TYPE, makeEvent } from "../../core/contracts/src/events.js";

const symbol = "BTCUSDT";
const price = 76000;
const quantity = 0.0001;
const partialDelta = 0.00004;
const orderId = "local_recovery_test_order";
const clientOrderId = "local_recovery_test_client";

runtimeEngine.ingestMarketTick({ symbol, price, bid: price - 0.01, ask: price + 0.01, provider: "local-recovery-test" });

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
  symbol,
  asset: "BTC",
  quoteAsset: "USDT",
  free: 1,
  locked: 0,
  quantity: 1,
  markPrice: price,
  exposure: price,
  source: "local-test"
}));

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
  symbol,
  side: "buy",
  quantity,
  price,
  orderId,
  clientOrderId,
  exchangeStatus: "NEW",
  provider: "local-recovery-test"
}));

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
  symbol,
  side: "buy",
  quantity,
  filledQuantity: partialDelta,
  filledQuantityDelta: partialDelta,
  fillPrice: price,
  orderId,
  clientOrderId,
  exchangeStatus: "PARTIALLY_FILLED",
  provider: "local-recovery-test"
}));

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "local_test_uncertain", orderId, clientOrderId }));
runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, { reason: "local_test_unknown", symbol }));

const denied = runtimeEngine.evaluateAction({
  actionId: "local-test:place-order-during-unknown",
  actionType: "place_order",
  symbol,
  side: "buy",
  quantity,
  price
} as any);

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, {
  symbol,
  side: "buy",
  quantity,
  filledQuantity: partialDelta,
  executedQty: String(partialDelta),
  origQty: String(quantity),
  orderId,
  clientOrderId,
  exchangeStatus: "PARTIALLY_FILLED",
  provider: "local-recovery-test"
}));

runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
  symbol,
  asset: "BTC",
  quoteAsset: "USDT",
  free: 1 + partialDelta,
  locked: 0,
  quantity: 1 + partialDelta,
  markPrice: price,
  exposure: (1 + partialDelta) * price,
  source: "local-test-recovery"
}));

const snapshot = runtimeEngine.getSnapshot();
const invariants = runtimeEngine.getInvariants();
const ok = denied.decision === "deny" &&
  snapshot.order.status === "partially_filled" &&
  snapshot.position.status === "open" &&
  snapshot.risk.status === "clear" &&
  snapshot.system.status === "healthy" &&
  invariants.every((c) => c.ok);

console.log(JSON.stringify({
  name: "local_recovery_unknown",
  ok,
  denied,
  order: snapshot.order,
  position: snapshot.position,
  risk: snapshot.risk,
  system: snapshot.system,
  invariants
}, null, 2));

if (!ok) process.exit(1);
