import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, type DomainEvent } from "../../core/contracts/src/events.js";
import { ActionGate } from "../../core/gates/src/action-gate.js";
import {
  buildMarketInputIntegrityReport,
  buildProvenanceHealthReport,
  MARKET_INPUT_BLOCKING_REASON,
  type MarketInputIntegrityReport
} from "../../core/integrity/integrity-report.js";
import { buildCoreTrustReport } from "../../core/kernel/core-trust-report.js";
import { KERNEL_TRUST_STATE } from "../../core/kernel/kernel-constitution.js";
import { planRecovery, RECOVERY_ACTION_TYPE } from "../../core/recovery/recovery-planner.js";
import { DEFAULT_FRESHNESS_CONFIG } from "../../core/runtime/src/freshness.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

const now = new Date().toISOString();

function event<TPayload>(
  eventType: string,
  payload: TPayload,
  eventId: string,
  timestamp = now,
  source = "wave9-market-input-trust-test"
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

function commit(e: DomainEvent, label: string) {
  const result = runtimeEngine.commitEventResult(e, { log: false });
  assert.equal(result.ok, true, `${label}: ${JSON.stringify(result)}`);
}

function prepareTrustedRuntime(prefix: string) {
  runtimeEngine.clearPersistenceAndReset();

  commit(event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "wave9-market-input-trust-test",
    source: "market-observation-fixture"
  }, `${prefix}-market`, now, "market-data"), "market tick");

  commit(event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    source: "exchange",
    provider: "wave9-market-input-trust-test"
  }, `${prefix}-position`, now, "exchange"), "position reconciled");

  commit(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: `${prefix}-loading` }, `${prefix}-bootstrap-loading`, now, "core"), "bootstrap loading");
  commit(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: `${prefix}-replay` }, `${prefix}-bootstrap-replay`, now, "core"), "bootstrap replay");
  commit(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: `${prefix}-awaiting` }, `${prefix}-bootstrap-awaiting`, now, "core"), "bootstrap awaiting");
  commit(event(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: `${prefix}-reconciled` }, `${prefix}-bootstrap-reconciled`, now, "core"), "bootstrap reconciled");

  commit(event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    provider: "wave9-market-input-trust-test",
    lastAccountReconcileAt: now,
    lastPositionReconcileAt: now,
    lastOrderReconcileAt: now,
    lastFillSyncAt: now,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }, `${prefix}-exchange-truth`, now, "exchange"), "exchange truth");

  commit(event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    connectionState: "connected",
    wsConnected: true,
    source: "wave9-market-input-trust-test",
    receivedAt: now,
    lastConnectionHeartbeatAt: now
  }, `${prefix}-health`, now, "core"), "health");
}

const completeProvenance = () => buildProvenanceHealthReport({
  status: "complete",
  checkedAt: now,
  traceId: "provenance:market-input-fixture",
  sourceEventId: "market-input-source"
});

const validMarketInput = () => buildMarketInputIntegrityReport({
  status: "valid",
  checkedAt: now,
  eventId: "market:event:valid",
  source: "market-data",
  provider: "wave9-market-input-trust-test",
  observedAt: now,
  provenanceId: "provenance:market-input-fixture",
  checksum: "sha256:valid"
});

function gateOptions(marketInput: MarketInputIntegrityReport) {
  const snapshot = runtimeEngine.getSnapshot();
  const freshness = runtimeEngine.getFreshness(now);
  const integrity = runtimeEngine.getIntegrityReport(now);
  const causality = runtimeEngine.getCausalityReport();
  return {
    enforceFreshness: true,
    now,
    freshness,
    freshnessConfig: DEFAULT_FRESHNESS_CONFIG,
    integrity,
    causality,
    provenance: completeProvenance(),
    marketInput
  };
}

function buildReportWithMarketInput(marketInput: MarketInputIntegrityReport) {
  const snapshot = runtimeEngine.getSnapshot();
  const gate = new ActionGate();
  const actions = gate.evaluateAll(snapshot, gateOptions(marketInput));
  const causality = runtimeEngine.getCausalityReport(undefined, undefined, actions.place_order);
  return buildCoreTrustReport({
    snapshot,
    permissions: {
      tradingAllowed: actions.place_order.decision === "allow",
      actions
    },
    freshness: runtimeEngine.getFreshness(now),
    healthTruth: runtimeEngine.getHealthSnapshot(),
    replay: runtimeEngine.replayCheck(),
    invariants: runtimeEngine.getInvariants(),
    lastEvent: runtimeEngine.getEvents(1).at(-1),
    lastTransition: runtimeEngine.getTransitions(1).at(-1),
    integrity: runtimeEngine.getIntegrityReport(now),
    causality,
    provenance: completeProvenance(),
    marketInput
  });
}

function assertRiskDenied(marketInput: MarketInputIntegrityReport, expectedReason: string) {
  prepareTrustedRuntime(`wave9-${marketInput.status}`);
  const gate = new ActionGate();
  const before = structuredClone(runtimeEngine.getSnapshot());
  const verdict = gate.evaluate({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  }, runtimeEngine.getSnapshot(), gateOptions(marketInput));

  assert.equal(verdict.decision, "deny");
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.marketInputStatus, marketInput.status);
  assert.ok(verdict.blockingReasons.includes(expectedReason), JSON.stringify(verdict.blockingReasons));
  assert.equal(runtimeEngine.getSnapshot().revision, before.revision);
  assert.deepEqual(runtimeEngine.getSnapshot(), before);
}

function testUnknownMarketInputDeniesRisk() {
  assertRiskDenied(buildMarketInputIntegrityReport({ status: "unknown", checkedAt: now }), MARKET_INPUT_BLOCKING_REASON.UNKNOWN);
}

function testStaleInputDeniesRisk() {
  assertRiskDenied(buildMarketInputIntegrityReport({ status: "stale", checkedAt: now }), MARKET_INPUT_BLOCKING_REASON.STALE);
}

function testGapDeniesRisk() {
  assertRiskDenied(buildMarketInputIntegrityReport({ status: "gap_detected", checkedAt: now }), MARKET_INPUT_BLOCKING_REASON.GAP);
}

function testInvalidDeniesRisk() {
  assertRiskDenied(buildMarketInputIntegrityReport({ status: "invalid", checkedAt: now }), MARKET_INPUT_BLOCKING_REASON.INVALID);
}

function testValidInputAloneDoesNotGrantAllow() {
  runtimeEngine.clearPersistenceAndReset();
  const gate = new ActionGate();
  const verdict = gate.evaluate({ type: ACTION_TYPE.PLACE_ORDER }, runtimeEngine.getSnapshot(), {
    marketInput: validMarketInput(),
    provenance: completeProvenance()
  });

  assert.equal(verdict.decision, "deny");
  assert.equal(verdict.marketInputStatus, "valid");
  assert.ok(!verdict.blockingReasons.includes(MARKET_INPUT_BLOCKING_REASON.UNKNOWN));
  assert.ok(verdict.blockingReasons.length > 0, "Other trust blockers must still deny cold/unsafe state.");
}

function testRecoveryCancelReduceOnlyAvailable() {
  prepareTrustedRuntime("wave9-recovery-actions");
  const unknownMarket = buildMarketInputIntegrityReport({ status: "unknown", checkedAt: now });

  const cancel = new ActionGate().evaluate({ type: ACTION_TYPE.CANCEL_ORDER }, runtimeEngine.getSnapshot(), gateOptions(unknownMarket));
  const reconcile = new ActionGate().evaluate({ type: ACTION_TYPE.RECONCILE_POSITION }, runtimeEngine.getSnapshot(), gateOptions(unknownMarket));

  assert.equal(cancel.decision, "allow");
  assert.equal(cancel.actionClass, "RISK_REDUCING");
  assert.equal(reconcile.decision, "allow");
  assert.equal(reconcile.actionClass, "RECOVERY");
}

function testUnknownInputIsNotCorruption() {
  prepareTrustedRuntime("wave9-unknown-not-corruption");
  const report = buildReportWithMarketInput(buildMarketInputIntegrityReport({ status: "unknown", checkedAt: now }));

  assert.equal(report.marketInputStatus, "unknown");
  assert.ok(report.marketInputBlockingReasons.includes(MARKET_INPUT_BLOCKING_REASON.UNKNOWN));
  assert.notEqual(report.trustState, KERNEL_TRUST_STATE.COMPROMISED);
  assert.notEqual(report.trustState, KERNEL_TRUST_STATE.PANIC);
}

function testChecksumMismatchCanCompromiseTrustIfProven() {
  prepareTrustedRuntime("wave9-checksum-mismatch");
  const mismatch = buildMarketInputIntegrityReport({
    status: "checksum_mismatch",
    checkedAt: now,
    eventId: "market:event:tampered",
    checksum: "sha256:bad",
    evidence: { expectedChecksum: "sha256:good", observedChecksum: "sha256:bad" }
  });
  const report = buildReportWithMarketInput(mismatch);

  assert.equal(report.marketInputStatus, "checksum_mismatch");
  assert.ok(report.blockingReasons.some((reason) => reason.code === MARKET_INPUT_BLOCKING_REASON.CHECKSUM_MISMATCH));
  assert.equal(report.trustState, KERNEL_TRUST_STATE.COMPROMISED);
}

function testCoreTrustReportAndGateContainMarketInputEvidence() {
  prepareTrustedRuntime("wave9-evidence");
  const marketInput = buildMarketInputIntegrityReport({
    status: "gap_detected",
    checkedAt: now,
    eventId: "market:event:gap",
    sequence: 42,
    provider: "fixture"
  });
  const gate = new ActionGate();
  const verdict = gate.evaluate({ type: ACTION_TYPE.PLACE_ORDER }, runtimeEngine.getSnapshot(), gateOptions(marketInput));
  const report = buildReportWithMarketInput(marketInput);

  assert.equal(verdict.marketInputStatus, "gap_detected");
  assert.equal(verdict.marketInputEventId, "market:event:gap");
  assert.ok(verdict.marketInputBlockingReasons?.includes(MARKET_INPUT_BLOCKING_REASON.GAP));
  assert.equal(report.marketInputStatus, "gap_detected");
  assert.ok(report.marketInputBlockingReasons.includes(MARKET_INPUT_BLOCKING_REASON.GAP));
}

function testRecoveryPlannerSuggestsMarketInputRecoveryPath() {
  prepareTrustedRuntime("wave9-recovery");
  const invalid = buildMarketInputIntegrityReport({
    status: "invalid",
    checkedAt: now,
    eventId: "market:event:invalid",
    evidence: { validation: "failed" }
  });
  const report = buildReportWithMarketInput(invalid);
  const plan = planRecovery({ coreTrustReport: report });

  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.RUN_MARKET_REPLAY_CHECK));
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.QUARANTINE_INVALID_MARKET_INPUT));
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.MANUAL_REVIEW));
}

testUnknownMarketInputDeniesRisk();
testStaleInputDeniesRisk();
testGapDeniesRisk();
testInvalidDeniesRisk();
testValidInputAloneDoesNotGrantAllow();
testRecoveryCancelReduceOnlyAvailable();
testUnknownInputIsNotCorruption();
testChecksumMismatchCanCompromiseTrustIfProven();
testCoreTrustReportAndGateContainMarketInputEvidence();
testRecoveryPlannerSuggestsMarketInputRecoveryPath();

console.log("Wave 9 market input trust integration checks passed");
