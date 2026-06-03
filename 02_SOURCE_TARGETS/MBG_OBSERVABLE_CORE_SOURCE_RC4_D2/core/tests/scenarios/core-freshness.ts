import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { DomainEvent, EVENT_TYPE } from "../../core/contracts/src/events.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { calculateFreshness } from "../../core/runtime/src/freshness.js";

const nowMs = Date.now();
const now = new Date(nowMs).toISOString();
const freshPast = new Date(nowMs - 100).toISOString();
const oldPast = new Date(nowMs - 120_000).toISOString();

function event<TPayload>(
  eventType: string,
  payload: TPayload,
  eventId: string,
  timestamp = freshPast,
  source = "freshness-test"
): DomainEvent<TPayload> {
  return {
    eventId,
    eventType: eventType as any,
    timestamp,
    source,
    schemaVersion: "1",
    payload
  };
}

function marketTick(eventId: string, timestamp = freshPast) {
  return event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "freshness-test",
    source: "market-data"
  }, eventId, timestamp, "market-data");
}

function marketInputObservation(eventId: string, timestamp = freshPast, sequence = 1) {
  return event(EVENT_TYPE.MARKET_INPUT_OBSERVED, {
    observation: {
      observationId: `${eventId}-obs`,
      sourceType: "simulated",
      sourceName: "freshness-test",
      symbol: "BTCUSDT",
      channel: "ticker",
      sequence,
      previousSequence: sequence > 1 ? sequence - 1 : undefined,
      exchangeTimestamp: timestamp,
      receivedTimestampFromEvent: timestamp,
      payloadHash: `sha256:${eventId}`,
      provenanceId: `${eventId}-prov`,
      freshnessHint: { maxAgeMs: 15000, observedAgeMs: 0, stale: false },
      schemaVersion: "1"
    }
  }, eventId, timestamp, "market-input");
}

function positionReconciled(eventId: string, timestamp = freshPast) {
  return event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    provider: "freshness-test",
    source: "exchange"
  }, eventId, timestamp, "exchange");
}

function heartbeat(eventId: string, timestamp = freshPast) {
  return event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    source: "core"
  }, eventId, timestamp, "core");
}

function provenanceRecorded(eventId: string, timestamp = freshPast) {
  return event(EVENT_TYPE.METADATA_PROVENANCE_RECORDED, {
    provenanceId: `${eventId}-prov`,
    originType: "observation",
    originEventId: eventId,
    targetId: "action:place_order",
    parentProvenanceIds: [],
    source: "freshness-test",
    confidence: 1,
    createdAtFromEvent: timestamp
  }, eventId, timestamp, "core");
}

function exchangeTruthSucceeded(eventId: string, timestamp = freshPast) {
  return event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    lastAccountReconcileAt: timestamp,
    lastPositionReconcileAt: timestamp,
    lastOrderReconcileAt: timestamp,
    lastFillSyncAt: timestamp,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }, eventId, timestamp, "exchange");
}

function bootstrapReconciled(prefix: string, timestamp = freshPast) {
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: `${prefix}-loading`, source: "core" }, `${prefix}-bootstrap-loading`, timestamp, "core"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: `${prefix}-replay`, source: "core" }, `${prefix}-bootstrap-replay`, timestamp, "core"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: `${prefix}-awaiting`, source: "core" }, `${prefix}-bootstrap-awaiting`, timestamp, "core"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: `${prefix}-reconciled`, source: "core" }, `${prefix}-bootstrap-reconciled`, timestamp, "core"));
}

function placeOrder() {
  return runtimeEngine.evaluateAction({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  });
}

function reset() {
  runtimeEngine.clearPersistenceAndReset();
}

function prepareReadyExceptMarket(prefix: string) {
  runtimeEngine.commitEventSilent(positionReconciled(`${prefix}-position`));
  bootstrapReconciled(prefix);
  runtimeEngine.commitEventSilent(exchangeTruthSucceeded(`${prefix}-exchange-truth`));
  runtimeEngine.commitEventSilent(heartbeat(`${prefix}-heartbeat`));
}

function prepareReady(prefix: string, marketTimestamp = freshPast, exchangeTimestamp = freshPast, heartbeatTimestamp = freshPast) {
  runtimeEngine.commitEventSilent(marketTick(`${prefix}-market`, marketTimestamp));
  runtimeEngine.commitEventSilent(positionReconciled(`${prefix}-position`, exchangeTimestamp));
  bootstrapReconciled(prefix);
  runtimeEngine.commitEventSilent(exchangeTruthSucceeded(`${prefix}-exchange-truth`, exchangeTimestamp));
  runtimeEngine.commitEventSilent(heartbeat(`${prefix}-heartbeat`, heartbeatTimestamp));
  runtimeEngine.commitEventSilent(provenanceRecorded(`${prefix}-provenance`, heartbeatTimestamp));
  runtimeEngine.commitEventSilent(marketInputObservation(`${prefix}-market-input`, marketTimestamp));
}

function testNoMarketEventDeniesPlaceOrder() {
  reset();
  prepareReadyExceptMarket("no-market");

  const freshness = runtimeEngine.getFreshness(now);
  assert.equal(freshness.marketDataFreshness.status, "unknown");
  assert.equal(freshness.okForNormalTrading, false);

  const decision = placeOrder();
  assert.equal(decision.decision, "deny");
}

function testFreshMarketEventIsFresh() {
  const freshness = calculateFreshness({
    lastMarketEventAt: freshPast,
    lastBookTickerAt: freshPast,
    lastExchangeReconcileAt: freshPast,
    lastConnectionHeartbeatAt: freshPast,
    maxMarketAgeMs: 15_000,
    maxExchangeAgeMs: 60_000,
    maxConnectionAgeMs: 30_000
  }, { now });

  assert.equal(freshness.marketDataFreshness.status, "fresh");
  assert.equal(freshness.okForNormalTrading, true);
}

function testOldMarketEventIsStale() {
  const freshness = calculateFreshness({
    lastMarketEventAt: oldPast,
    lastBookTickerAt: oldPast,
    lastExchangeReconcileAt: freshPast,
    lastConnectionHeartbeatAt: freshPast,
    maxMarketAgeMs: 15_000,
    maxExchangeAgeMs: 60_000,
    maxConnectionAgeMs: 30_000
  }, { now });

  assert.ok(["stale", "expired"].includes(freshness.marketDataFreshness.status));
  assert.equal(freshness.marketDataFreshness.reason, "market_data_stale");
  assert.equal(freshness.okForNormalTrading, false);
}

function testOldExchangeReconcileDeniesPlaceOrder() {
  reset();
  prepareReady("old-exchange", freshPast, oldPast, freshPast);

  const freshness = runtimeEngine.getFreshness(now);
  assert.ok(["stale", "expired"].includes(freshness.exchangeTruthFreshness.status));
  assert.equal(freshness.exchangeTruthFreshness.reason, "exchange_truth_stale");

  const decision = placeOrder();
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "exchange_truth_stale");
}

function testConnectionUnknownIsNotConnected() {
  reset();
  runtimeEngine.commitEventSilent(marketTick("connection-unknown-market"));
  runtimeEngine.commitEventSilent(positionReconciled("connection-unknown-position"));
  bootstrapReconciled("connection-unknown");
  runtimeEngine.commitEventSilent(exchangeTruthSucceeded("connection-unknown-exchange-truth"));

  const freshness = runtimeEngine.getFreshness(now);
  assert.equal(freshness.connectionFreshness.status, "unknown");
  assert.equal(freshness.connectionFreshness.reason, "connection_state_unknown");

  const health = runtimeEngine.getHealthSnapshot();
  assert.equal(health.wsConnected, "unknown");

  const decision = placeOrder();
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "connection_state_unknown");
}

function testBootstrapReconciledExchangeFreshMarketStaleDenies() {
  reset();
  prepareReady("market-stale", oldPast, freshPast, freshPast);

  const freshness = runtimeEngine.getFreshness(now);
  assert.ok(["stale", "expired"].includes(freshness.marketDataFreshness.status));
  assert.equal(freshness.exchangeTruthFreshness.status, "fresh");

  const decision = placeOrder();
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reason, "market_data_stale");
}

function testAllFreshAllowsOnlyIfActionGateAllows() {
  reset();
  prepareReady("all-fresh", freshPast, freshPast, freshPast);

  const freshness = runtimeEngine.getFreshness(now);
  assert.equal(freshness.marketDataFreshness.status, "fresh");
  assert.equal(freshness.exchangeTruthFreshness.status, "fresh");
  assert.equal(freshness.connectionFreshness.status, "fresh");
  assert.equal(freshness.okForNormalTrading, true);

  const decision = placeOrder();
  assert.equal(decision.decision, "allow");
}

testNoMarketEventDeniesPlaceOrder();
testFreshMarketEventIsFresh();
testOldMarketEventIsStale();
testOldExchangeReconcileDeniesPlaceOrder();
testConnectionUnknownIsNotConnected();
testBootstrapReconciledExchangeFreshMarketStaleDenies();
testAllFreshAllowsOnlyIfActionGateAllows();

console.log("core freshness checks passed");
