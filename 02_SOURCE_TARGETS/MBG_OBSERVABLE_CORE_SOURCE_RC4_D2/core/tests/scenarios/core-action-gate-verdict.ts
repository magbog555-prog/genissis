import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, type DomainEvent } from "../../core/contracts/src/events.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

const nowMs = Date.now();
const now = new Date(nowMs).toISOString();
const freshPast = new Date(nowMs - 100).toISOString();
const stalePast = new Date(nowMs - 120_000).toISOString();

function event<TPayload>(
  eventType: string,
  payload: TPayload,
  eventId: string,
  timestamp = freshPast,
  source = "action-gate-verdict-test"
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

function reset() {
  runtimeEngine.clearPersistenceAndReset();
}

function commitReady(prefix: string, timestamps: {
  market?: string;
  exchange?: string;
  health?: string;
} = {}) {
  const marketTimestamp = timestamps.market ?? freshPast;
  const exchangeTimestamp = timestamps.exchange ?? freshPast;
  const healthTimestamp = timestamps.health ?? freshPast;

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "action-gate-verdict-test"
  }, `${prefix}-market`, marketTimestamp, "market-data"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    source: "exchange"
  }, `${prefix}-position`, exchangeTimestamp, "exchange"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: `${prefix}-loading` }, `${prefix}-bootstrap-loading`, exchangeTimestamp, "core"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: `${prefix}-replay` }, `${prefix}-bootstrap-replay`, exchangeTimestamp, "core"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: `${prefix}-awaiting` }, `${prefix}-bootstrap-awaiting`, exchangeTimestamp, "core"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: `${prefix}-reconciled` }, `${prefix}-bootstrap-reconciled`, exchangeTimestamp, "core"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    provider: "action-gate-verdict-test",
    lastAccountReconcileAt: exchangeTimestamp,
    lastPositionReconcileAt: exchangeTimestamp,
    lastOrderReconcileAt: exchangeTimestamp,
    lastFillSyncAt: exchangeTimestamp,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }, `${prefix}-exchange-truth`, exchangeTimestamp, "exchange"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    source: "action-gate-verdict-test"
  }, `${prefix}-health`, healthTimestamp, "core"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.METADATA_PROVENANCE_RECORDED, {
    provenanceId: `${prefix}-provenance`,
    originType: "observation",
    originEventId: `${prefix}-health`,
    targetId: "action:place_order",
    parentProvenanceIds: [],
    source: "action-gate-verdict-test",
    confidence: 1,
    createdAtFromEvent: healthTimestamp
  }, `${prefix}-provenance-event`, healthTimestamp, "core"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.MARKET_INPUT_OBSERVED, {
    observation: {
      observationId: `${prefix}-market-input-observation`,
      sourceType: "simulated",
      sourceName: "action-gate-verdict-test",
      symbol: "BTCUSDT",
      channel: "ticker",
      sequence: 1,
      exchangeTimestamp: marketTimestamp,
      receivedTimestampFromEvent: marketTimestamp,
      payloadHash: `sha256:${prefix}-market-input`,
      provenanceId: `${prefix}-market-input-provenance`,
      freshnessHint: { maxAgeMs: 15000, observedAgeMs: 0, stale: false },
      schemaVersion: "1"
    }
  }, `${prefix}-market-input`, marketTimestamp, "market-input"));
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

function assertVerdictShape(verdict: ReturnType<typeof placeOrder>) {
  assert.equal(verdict.gateVersion, "action-gate-v2");
  assert.equal(verdict.action.actionType, ACTION_TYPE.PLACE_ORDER);
  assert.equal(verdict.actionClass, "NORMAL");
  assert.equal(typeof verdict.allowed, "boolean");
  assert.equal(verdict.snapshotRevision, runtimeEngine.getSnapshot().revision);
  assert.ok(Array.isArray(verdict.blockingReasons));
  assert.ok(Array.isArray(verdict.allowedAlternatives));
  assert.ok(Array.isArray(verdict.relatedInvariants));
}

function testColdStartPlaceOrderDeniedWithReason() {
  reset();
  const verdict = placeOrder();

  assertVerdictShape(verdict);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.decision, "deny");
  assert.equal(verdict.reason, "bootstrap_not_reconciled");
  assert.ok(verdict.blockingReasons.includes("bootstrap_not_reconciled"));
  assert.ok(verdict.blockingReasons.includes("exchange_truth_unknown"));
  assert.ok(verdict.blockingReasons.includes("connection_state_unknown"));
  assert.ok(verdict.allowedAlternatives.includes(ACTION_TYPE.RECONCILE_POSITION));
  assert.ok(verdict.relatedInvariants.includes("bootstrap_must_be_reconciled_before_normal_action"));
}

function testExchangeTruthUnknownDeniedWithReason() {
  reset();
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "action-gate-verdict-test"
  }, "exchange-unknown-market"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    source: "exchange"
  }, "exchange-unknown-position"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "loading" }, "exchange-unknown-bootstrap-loading"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "replay" }, "exchange-unknown-bootstrap-replay"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "awaiting" }, "exchange-unknown-bootstrap-awaiting"));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "reconciled" }, "exchange-unknown-bootstrap-reconciled"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected"
  }, "exchange-unknown-health"));

  const verdict = placeOrder();

  assertVerdictShape(verdict);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, "exchange_truth_unknown");
  assert.ok(verdict.blockingReasons.includes("exchange_truth_unknown"));
  assert.ok(verdict.relatedInvariants.includes("exchange_truth_must_be_fresh_before_normal_action"));
}

function testFreshnessStaleDeniedWithReason() {
  reset();
  commitReady("stale-market", { market: stalePast, exchange: freshPast, health: freshPast });

  const verdict = placeOrder();

  assertVerdictShape(verdict);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, "market_data_stale");
  assert.ok(verdict.blockingReasons.includes("market_data_stale"));
  assert.ok(verdict.relatedInvariants.includes("market_data_must_be_fresh_before_normal_action"));
}

function testHealthUnknownDeniedWithReason() {
  reset();
  const prefix = "health-unknown";
  const exchangeTimestamp = freshPast;

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "action-gate-verdict-test"
  }, `${prefix}-market`, freshPast, "market-data"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    source: "exchange"
  }, `${prefix}-position`, exchangeTimestamp, "exchange"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "loading" }, `${prefix}-bootstrap-loading`));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "replay" }, `${prefix}-bootstrap-replay`));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "awaiting" }, `${prefix}-bootstrap-awaiting`));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "reconciled" }, `${prefix}-bootstrap-reconciled`));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    lastAccountReconcileAt: exchangeTimestamp,
    lastPositionReconcileAt: exchangeTimestamp,
    lastOrderReconcileAt: exchangeTimestamp,
    lastFillSyncAt: exchangeTimestamp,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }, `${prefix}-exchange-truth`, exchangeTimestamp, "exchange"));

  const verdict = placeOrder();

  assertVerdictShape(verdict);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, "connection_state_unknown");
  assert.ok(verdict.blockingReasons.includes("connection_state_unknown"));
  assert.ok(verdict.relatedInvariants.includes("health_truth_must_be_known_before_normal_action"));
}

function testTrustedStateAllowsWithVerdict() {
  reset();
  commitReady("trusted");

  const verdict = placeOrder();

  assertVerdictShape(verdict);
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.decision, "allow");
  assert.equal(verdict.reason, undefined);
  assert.deepEqual(verdict.blockingReasons, []);
  assert.equal(verdict.gateVersion, "action-gate-v2");
  assert.equal(verdict.kernelTrustState, "TRUSTED");
}

function testRecoveryActionAllowedWhenNormalTradingDenied() {
  reset();
  const verdict = runtimeEngine.evaluateAction({
    type: ACTION_TYPE.RECONCILE_POSITION
  });

  assert.equal(verdict.gateVersion, "action-gate-v2");
  assert.equal(verdict.actionClass, "RECOVERY");
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.decision, "allow");
  assert.equal(verdict.snapshotRevision, runtimeEngine.getSnapshot().revision);
}

testColdStartPlaceOrderDeniedWithReason();
testExchangeTruthUnknownDeniedWithReason();
testFreshnessStaleDeniedWithReason();
testHealthUnknownDeniedWithReason();
testTrustedStateAllowsWithVerdict();
testRecoveryActionAllowedWhenNormalTradingDenied();

console.log(JSON.stringify({
  name: "core_action_gate_verdict_v2",
  ok: true,
  gateVersion: "action-gate-v2"
}, null, 2));
