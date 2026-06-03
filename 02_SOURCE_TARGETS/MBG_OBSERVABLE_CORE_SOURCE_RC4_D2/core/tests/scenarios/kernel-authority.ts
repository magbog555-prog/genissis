import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, makeEvent } from "../../core/contracts/src/events.js";
import { ActionGate } from "../../core/gates/src/action-gate.js";
import { evaluateKernelTrust, KERNEL_TRUST_STATE, type ReplayStatusInput } from "../../core/kernel/kernel-authority.js";
import { calculateFreshness } from "../../core/runtime/src/freshness.js";
import { RuntimeEngine, reduceSnapshot } from "../../core/runtime/src/runtime-engine.js";
import { initialSnapshot, RuntimeSnapshot } from "../../core/state/src/types.js";

const now = new Date();
const nowIso = now.toISOString();

function event(eventType: string, payload: unknown, eventId: string) {
  return {
    eventId,
    eventType: eventType as any,
    timestamp: nowIso,
    source: "kernel-authority-test",
    schemaVersion: "1",
    payload
  };
}

function bootstrapReconciled(snapshot: RuntimeSnapshot) {
  const loading = reduceSnapshot(snapshot, makeEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "kernel-test" }));
  const replaying = reduceSnapshot(loading, makeEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "kernel-test" }));
  const awaiting = reduceSnapshot(replaying, makeEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "kernel-test" }));
  return reduceSnapshot(awaiting, makeEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "kernel-test" }));
}

function marketAndPosition(snapshot: RuntimeSnapshot) {
  const afterMarket = reduceSnapshot(snapshot, makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "kernel-authority-test"
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

function exchangeTruthFresh(snapshot: RuntimeSnapshot) {
  return reduceSnapshot(snapshot, makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "kernel-authority-test",
    lastAccountReconcileAt: nowIso,
    lastPositionReconcileAt: nowIso,
    lastOrderReconcileAt: nowIso,
    lastFillSyncAt: nowIso,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }));
}

function trustedEngine() {
  const engine = new RuntimeEngine();
  engine.clearPersistenceAndReset();
  engine.commitEventSilent(event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "kernel-authority-test"
  }, "ka-market"));

  engine.commitEventSilent(event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    source: "exchange"
  }, "ka-position"));

  engine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "kernel-test" }, "ka-bootstrap-loading"));
  engine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "kernel-test" }, "ka-bootstrap-replay"));
  engine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "kernel-test" }, "ka-bootstrap-awaiting"));
  engine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "kernel-test" }, "ka-bootstrap-reconciled"));

  engine.commitEventSilent(event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "kernel-authority-test",
    lastAccountReconcileAt: nowIso,
    lastPositionReconcileAt: nowIso,
    lastOrderReconcileAt: nowIso,
    lastFillSyncAt: nowIso,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }, "ka-exchange-truth"));

  engine.commitEventSilent(event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    source: "kernel-authority-test"
  }, "ka-health"));

  engine.commitEventSilent(event(EVENT_TYPE.METADATA_PROVENANCE_RECORDED, {
    provenanceId: "ka-provenance",
    originType: "observation",
    originEventId: "ka-health",
    targetId: "action:place_order",
    parentProvenanceIds: [],
    source: "kernel-authority-test",
    confidence: 1,
    createdAtFromEvent: nowIso
  }, "ka-provenance-event"));

  engine.commitEventSilent(event(EVENT_TYPE.MARKET_INPUT_OBSERVED, {
    observation: {
      observationId: "ka-market-input-observation",
      sourceType: "simulated",
      sourceName: "kernel-authority-test",
      symbol: "BTCUSDT",
      channel: "ticker",
      sequence: 1,
      exchangeTimestamp: nowIso,
      receivedTimestampFromEvent: nowIso,
      payloadHash: "sha256:ka-market-input",
      provenanceId: "ka-market-input-provenance",
      freshnessHint: { maxAgeMs: 15000, observedAgeMs: 0, stale: false },
      schemaVersion: "1"
    }
  }, "ka-market-input"));

  return engine;
}

function evaluateFromEngine(engine: RuntimeEngine, replay: ReplayStatusInput = { ok: true }) {
  const gate = new ActionGate();
  return evaluateKernelTrust({
    snapshot: engine.getSnapshot(),
    freshness: engine.getFreshness(now),
    healthTruth: engine.getHealthSnapshot(),
    replay,
    invariants: engine.getInvariants().map((check) => ({ ok: check.ok, name: check.name, details: check.details })),
    provenance: engine.getProvenanceHealthReport(now),
    marketInput: engine.getMarketInputIntegrityReport(now),
    actionGate: {
      placeOrder: gate.evaluate({
        type: ACTION_TYPE.PLACE_ORDER,
        symbol: "BTCUSDT",
        side: "buy",
        quantity: 0.01,
        price: 65000
      }, engine.getSnapshot(), { enforceFreshness: true, now, freshness: engine.getFreshness(now), provenance: engine.getProvenanceHealthReport(now), marketInput: engine.getMarketInputIntegrityReport(now) })
    }
  }, now);
}

function minimalFreshness(snapshot: RuntimeSnapshot, okForNormalTrading: boolean) {
  return calculateFreshness({
    lastMarketEventAt: snapshot.market.lastTickAt,
    lastBookTickerAt: snapshot.market.lastTickAt,
    lastExchangeReconcileAt: snapshot.exchangeTruth.lastPositionReconcileAt,
    exchangeTruthStatus: snapshot.exchangeTruth.status,
    lastConnectionHeartbeatAt: nowIso,
    connectionStatus: true,
    maxMarketAgeMs: 15_000,
    maxExchangeAgeMs: 60_000,
    maxConnectionAgeMs: 30_000
  }, { now, config: { maxMarketAgeMs: 15_000, maxExchangeAgeMs: 60_000, maxConnectionAgeMs: 30_000 } });
}

function completeHealth(snapshot: RuntimeSnapshot) {
  return {
    systemState: snapshot.system.status,
    wsConnected: true as const,
    connections: {
      websocket: {
        status: true as const,
        observedAt: nowIso,
        sourceEventId: "synthetic-health"
      }
    },
    healthTruthComplete: true,
    healthTruthDiagnostics: [],
    reconcileFresh: true as const,
    positionMatchesFills: true as const,
    openOrders: 0,
    unknownOrders: 0,
    driftDetected: false,
    reconcileLatencyMs: 0,
    wsReconnects: "unknown" as const,
    timestamp: nowIso
  };
}

function testColdStartUncertain() {
  const snapshot = initialSnapshot();
  const verdict = evaluateKernelTrust({ snapshot }, now);
  assert.equal(verdict.trustState, KERNEL_TRUST_STATE.UNCERTAIN);
  assert.equal(verdict.trusted, false);
  assert.ok(verdict.blockers.some((b) => b.reasonCode === "bootstrap_not_reconciled"));
  assert.ok(verdict.blockers.some((b) => b.reasonCode === "exchange_truth_unknown"));
}

function testBootstrapNotReconciledNotTrusted() {
  const snapshot = marketAndPosition(initialSnapshot());
  const verdict = evaluateKernelTrust({
    snapshot,
    freshness: minimalFreshness(snapshot, false),
    healthTruth: completeHealth(snapshot),
    replay: { ok: true },
    invariants: []
  }, now);

  assert.notEqual(verdict.trustState, KERNEL_TRUST_STATE.TRUSTED);
  assert.equal(verdict.trusted, false);
  assert.ok(verdict.blockers.some((b) => b.domain === "bootstrap"));
}

function testExchangeTruthStaleRecoverableOrUncertain() {
  const fresh = exchangeTruthFresh(bootstrapReconciled(marketAndPosition(initialSnapshot())));
  const stale = reduceSnapshot(fresh, makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_STALE_DETECTED, {
    reason: "ttl exceeded",
    source: "kernel-authority-test"
  }));

  const verdict = evaluateKernelTrust({
    snapshot: stale,
    freshness: minimalFreshness(stale, false),
    healthTruth: completeHealth(stale),
    replay: { ok: true },
    invariants: []
  }, now);

  assert.ok((new Set<string>([KERNEL_TRUST_STATE.RECOVERABLE, KERNEL_TRUST_STATE.UNCERTAIN])).has(verdict.trustState));
  assert.equal(verdict.trusted, false);
  assert.ok(verdict.blockers.some((b) => b.reasonCode === "exchange_truth_stale"));
}

function testHealthUnknownNotTrusted() {
  const engine = trustedEngine();
  const snapshot = engine.getSnapshot();
  const verdict = evaluateKernelTrust({
    snapshot,
    freshness: engine.getFreshness(now),
    healthTruth: {
      ...engine.getHealthSnapshot(),
      wsConnected: "unknown",
      connections: { websocket: { status: "unknown", reason: "ws_status_unknown" } },
      healthTruthComplete: false,
      healthTruthDiagnostics: ["connection_state_unknown", "ws_status_unknown", "health_truth_partial"]
    },
    replay: { ok: true },
    invariants: []
  }, now);

  assert.notEqual(verdict.trustState, KERNEL_TRUST_STATE.TRUSTED);
  assert.equal(verdict.trusted, false);
  assert.ok(verdict.blockers.some((b) => b.reasonCode === "ws_status_unknown"));
}

function testReplayMismatchCompromised() {
  const engine = trustedEngine();
  const verdict = evaluateFromEngine(engine, { ok: false, reason: "forced replay mismatch" });
  assert.equal(verdict.trustState, KERNEL_TRUST_STATE.COMPROMISED);
  assert.equal(verdict.trusted, false);
  assert.ok(verdict.blockers.some((b) => b.reasonCode === "replay_mismatch"));
}

function testSystemHalted() {
  const engine = trustedEngine();
  engine.commitEventSilent(event(EVENT_TYPE.SYSTEM_HALTED, { reason: "operator halt" }, "ka-system-halted"));
  const verdict = evaluateFromEngine(engine, { ok: true });
  assert.equal(verdict.trustState, KERNEL_TRUST_STATE.HALTED);
  assert.equal(verdict.trusted, false);
}

function testEverythingFreshReconciledHealthyTrusted() {
  const engine = trustedEngine();
  const verdict = evaluateFromEngine(engine, { ok: true });
  assert.equal(verdict.trustState, KERNEL_TRUST_STATE.TRUSTED);
  assert.equal(verdict.trusted, true);
  assert.equal(verdict.blockers.length, 0);
  assert.ok(verdict.allowedActions.includes(ACTION_TYPE.PLACE_ORDER));
}

testColdStartUncertain();
testBootstrapNotReconciledNotTrusted();
testExchangeTruthStaleRecoverableOrUncertain();
testHealthUnknownNotTrusted();
testReplayMismatchCompromised();
testSystemHalted();
testEverythingFreshReconciledHealthyTrusted();

console.log(JSON.stringify({
  name: "core_kernel_authority",
  ok: true,
  cases: [
    "cold_start_uncertain",
    "bootstrap_not_reconciled_not_trusted",
    "exchange_truth_stale_recoverable_or_uncertain",
    "health_unknown_not_trusted",
    "replay_mismatch_compromised",
    "system_halted",
    "everything_fresh_reconciled_healthy_trusted"
  ]
}, null, 2));
