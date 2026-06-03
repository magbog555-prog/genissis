import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, makeEvent } from "../../core/contracts/src/events.js";

function assert(name: string, ok: boolean, details?: unknown) {
  if (!ok) {
    console.error(`FAIL ${name}`, details ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

function placeOrderProbe() {
  return runtimeEngine.evaluateAction({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  });
}

function commitBootstrapReconciled() {
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "audit", source: "core" }));
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "audit", source: "core" }));
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "audit", source: "core" }));
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "audit", source: "core" }));
}

function commitMarketInputObserved() {
  const ts = new Date().toISOString();
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.MARKET_INPUT_OBSERVED, {
    observation: {
      observationId: "audit-market-input-observation",
      sourceType: "simulated",
      sourceName: "audit",
      symbol: "BTCUSDT",
      channel: "ticker",
      sequence: 1,
      exchangeTimestamp: ts,
      receivedTimestampFromEvent: ts,
      payloadHash: "sha256:audit-market-input",
      provenanceId: "audit-market-input-provenance",
      freshnessHint: { maxAgeMs: 15000, observedAgeMs: 0, stale: false },
      schemaVersion: "1"
    }
  }));
}

function commitPositionReconciled() {
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    source: "exchange",
    provider: "audit"
  }));
}

function commitExchangeTruthFresh() {
  const ts = new Date().toISOString();
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    provider: "audit",
    lastAccountReconcileAt: ts,
    lastPositionReconcileAt: ts,
    lastOrderReconcileAt: ts,
    lastFillSyncAt: ts,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }));
}

function commitHealthConnected() {
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    wsConnected: true,
    source: "audit",
    provider: "audit"
  }));
}

function commitProvenanceRecorded() {
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.METADATA_PROVENANCE_RECORDED, {
    provenanceId: "audit-provenance",
    originType: "observation",
    originEventId: "audit-health",
    targetId: "action:place_order",
    parentProvenanceIds: [],
    source: "audit",
    confidence: 1,
    createdAtFromEvent: new Date().toISOString()
  }));
}

console.log("Genesis v1 runtime audit");

runtimeEngine.clearPersistenceAndReset();

const initial = runtimeEngine.getRuntimeView();
assert("initial has all eight state domains", Object.keys(initial.stateDomains).length === 8, initial.stateDomains);
assert("initial position is unknown", initial.stateDomains.position === "unknown", initial.stateDomains);
assert("initial risk is blocked", initial.stateDomains.risk === "blocked", initial.stateDomains);

runtimeEngine.ingestMarketTick({
  symbol: "BTCUSDT",
  price: 65000,
  bid: 64999,
  ask: 65001,
  volume: 1,
  provider: "audit"
});

const afterMarket = runtimeEngine.getSnapshot();
assert("market opened", afterMarket.market.status === "open", afterMarket.market);
assert("market sourceEventId exists", Boolean(afterMarket.market.meta.sourceEventId), afterMarket.market.meta);

commitMarketInputObserved();

runtimeEngine.ingestSignal({
  symbol: "BTCUSDT",
  side: "buy",
  confidence: 0.8,
  quantity: 0.01,
  reason: "audit_signal"
});

const afterSignal = runtimeEngine.getSnapshot();
assert("trade signal ready", afterSignal.trade.status === "signal_ready", afterSignal.trade);

let decision = placeOrderProbe();
assert("gate uses current snapshot", decision.snapshotRevision === runtimeEngine.getSnapshot().revision, decision);
assert("gate denies before position reconcile", decision.decision === "deny", decision);
assert("gate explains bootstrap block", decision.reason === "bootstrap_not_reconciled", decision);

commitPositionReconciled();

decision = placeOrderProbe();
assert("gate stays denied until bootstrap reconcile", decision.decision === "deny" && decision.reason === "bootstrap_not_reconciled", decision);

commitBootstrapReconciled();

decision = placeOrderProbe();
assert("gate still denies without exchange truth after bootstrap reconcile", decision.decision === "deny", decision);
assert("gate explains missing exchange truth", decision.reason === "exchange_truth_unknown", decision);

commitExchangeTruthFresh();

decision = placeOrderProbe();
assert("gate still denies without health truth after exchange truth", decision.decision === "deny", decision);
assert("gate explains missing health truth", decision.reason === "connection_state_unknown", decision);

commitHealthConnected();
commitProvenanceRecorded();

decision = placeOrderProbe();
assert("gate allows only after readiness including market input is complete", decision.decision === "allow", decision);

runtimeEngine.dispatchAction({ type: ACTION_TYPE.PLACE_ORDER, symbol: "BTCUSDT", side: "buy", quantity: 0.01, price: 65000 });
assert("order becomes pending", runtimeEngine.getSnapshot().order.status === "pending", runtimeEngine.getSnapshot().order);

const invariants = runtimeEngine.getInvariants();
for (const check of invariants) {
  assert(`invariant:${check.name}`, check.ok, check.details);
}

console.log("Runtime view:");
console.dir(runtimeEngine.getRuntimeView(), { depth: null });

console.log("Health snapshot:");
console.dir(runtimeEngine.getHealthSnapshot(), { depth: null });

console.log("Last transitions:");
console.dir(runtimeEngine.getTransitions(10), { depth: null });

if (process.exitCode) process.exit(process.exitCode);
