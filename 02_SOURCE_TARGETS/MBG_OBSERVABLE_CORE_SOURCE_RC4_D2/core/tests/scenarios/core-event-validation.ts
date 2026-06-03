import assert from "node:assert";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { EVENT_TYPE, makeEvent } from "../../core/contracts/src/events.js";

function eventIds() {
  return new Set(runtimeEngine.getEvents(1000).map((event) => event.eventId));
}

function assertRejected(result: ReturnType<typeof runtimeEngine.commitEventResult>, code: string) {
  assert.equal(result.ok, false, "event should be rejected");
  assert.equal(result.status, "rejected", "event should fail validation before idempotency");
  if (!result.ok && result.status === "rejected") {
    assert.ok(
      result.diagnostic.issues.some((issue) => issue.code === code),
      `expected diagnostic code ${code}, got ${result.diagnostic.issues.map((issue) => issue.code).join(",")}`
    );
  }
}

runtimeEngine.clearPersistenceAndReset();

const beforeValid = runtimeEngine.getSnapshot().revision;
const validMarketTick = makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
  symbol: "BTCUSDT",
  price: 65000,
  bid: 64999,
  ask: 65001,
  volume: 1,
  provider: "core-event-validation-test"
});
const validResult = runtimeEngine.commitEventResult(validMarketTick, { log: false });
assert.equal(validResult.ok, true);
assert.equal(runtimeEngine.getSnapshot().revision, beforeValid + 1);
assert.equal(runtimeEngine.getSnapshot().market.status, "open");
assert.ok(eventIds().has(validMarketTick.eventId), "valid event should appear in canonical journal window");

const beforeNegativePriceRevision = runtimeEngine.getSnapshot().revision;
const beforeNegativePriceEvents = eventIds();
const negativePrice = makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
  symbol: "BTCUSDT",
  price: -1,
  bid: 64999,
  ask: 65001,
  volume: 1,
  provider: "core-event-validation-test"
});
const negativePriceResult = runtimeEngine.commitEventResult(negativePrice, { log: false });
assertRejected(negativePriceResult, "payload_invalid");
assert.equal(runtimeEngine.getSnapshot().revision, beforeNegativePriceRevision, "invalid event must not increase revision");
assert.deepEqual(eventIds(), beforeNegativePriceEvents, "invalid event must not enter canonical journal window");
assert.ok(!eventIds().has(negativePrice.eventId), "negative price event must not enter canonical journal");

const beforeCrossedBookRevision = runtimeEngine.getSnapshot().revision;
const beforeCrossedBookEvents = eventIds();
const crossedBook = makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
  symbol: "BTCUSDT",
  price: 65000,
  bid: 65002,
  ask: 65001,
  volume: 1,
  provider: "core-event-validation-test"
});
const crossedBookResult = runtimeEngine.commitEventResult(crossedBook, { log: false });
assertRejected(crossedBookResult, "payload_invalid");
assert.equal(runtimeEngine.getSnapshot().revision, beforeCrossedBookRevision, "bid > ask must not increase revision");
assert.deepEqual(eventIds(), beforeCrossedBookEvents, "bid > ask event must not enter canonical journal window");
assert.ok(!eventIds().has(crossedBook.eventId), "bid > ask event must not enter canonical journal");

const beforeBadFillRevision = runtimeEngine.getSnapshot().revision;
const beforeBadFillEvents = eventIds();
const badFill = makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
  orderId: "order-validation-1",
  fillId: "fill-validation-1",
  symbol: "BTCUSDT",
  side: "buy",
  quantity: 0,
  filledQuantity: 0,
  filledQuantityDelta: 0,
  fillPrice: 65000,
  exchangeStatus: "FILLED",
  provider: "core-event-validation-test"
});
const badFillResult = runtimeEngine.commitEventResult(badFill, { log: false });
assertRejected(badFillResult, "payload_invalid");
assert.equal(runtimeEngine.getSnapshot().revision, beforeBadFillRevision, "quantity <= 0 must not increase revision");
assert.deepEqual(eventIds(), beforeBadFillEvents, "quantity <= 0 event must not enter canonical journal window");
assert.ok(!eventIds().has(badFill.eventId), "quantity <= 0 fill must not enter canonical journal");

const persistence = runtimeEngine.getPersistenceView().status;
assert.equal(persistence.eventCount, runtimeEngine.getSnapshot().revision, "canonical persisted event count must match accepted revision");

console.log("core event validation checks passed");
