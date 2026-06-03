import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, type DomainEvent } from "../../core/contracts/src/events.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { KERNEL_TRUST_STATE } from "../../core/kernel/kernel-constitution.js";
import { type CoreTrustReport } from "../../core/kernel/core-trust-report.js";
import {
  planRecovery,
  RECOVERY_ACTION_TYPE,
  RECOVERY_PLANNER_VERSION
} from "../../core/recovery/recovery-planner.js";

const nowMs = Date.now();
const freshPast = new Date(nowMs - 100).toISOString();

function event<TPayload>(
  eventType: string,
  payload: TPayload,
  eventId: string,
  timestamp = freshPast,
  source = "recovery-planner-test"
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

function commitTrustedRuntime(prefix: string) {
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "recovery-planner-test"
  }, `${prefix}-market`));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.MARKET_INPUT_OBSERVED, {
    observation: {
      observationId: `${prefix}-market-input-observation`,
      sourceType: "simulated",
      sourceName: "recovery-planner-test",
      symbol: "BTCUSDT",
      channel: "ticker",
      sequence: 1,
      exchangeTimestamp: freshPast,
      receivedTimestampFromEvent: freshPast,
      payloadHash: `sha256:${prefix}-market-input`,
      provenanceId: `${prefix}-market-input-provenance`,
      freshnessHint: { maxAgeMs: 15000, observedAgeMs: 0, stale: false },
      schemaVersion: "1"
    }
  }, `${prefix}-market-input`, freshPast, "market-input"));

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
  }, `${prefix}-position`));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "loading" }, `${prefix}-bootstrap-loading`));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "replay" }, `${prefix}-bootstrap-replay`));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "awaiting" }, `${prefix}-bootstrap-awaiting`));
  runtimeEngine.commitEventSilent(event(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: "reconciled" }, `${prefix}-bootstrap-reconciled`));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    provider: "recovery-planner-test",
    lastAccountReconcileAt: freshPast,
    lastPositionReconcileAt: freshPast,
    lastOrderReconcileAt: freshPast,
    lastFillSyncAt: freshPast,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }, `${prefix}-exchange-truth`, freshPast, "exchange"));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    source: "recovery-planner-test"
  }, `${prefix}-health`));

  runtimeEngine.commitEventSilent(event(EVENT_TYPE.METADATA_PROVENANCE_RECORDED, {
    provenanceId: `${prefix}-provenance`,
    originType: "observation",
    originEventId: `${prefix}-health`,
    targetId: "action:place_order",
    parentProvenanceIds: [],
    source: "recovery-planner-test",
    confidence: 1,
    createdAtFromEvent: freshPast
  }, `${prefix}-provenance-event`, freshPast, "core"));
}

function trustedReport(): CoreTrustReport {
  reset();
  commitTrustedRuntime("trusted-recovery-planner");
  const report = runtimeEngine.getCoreTrustReport({ test: "recovery-planner-trusted" });
  assert.equal(report.trustState, KERNEL_TRUST_STATE.TRUSTED);
  return report;
}

function cloneReport(report: CoreTrustReport): CoreTrustReport {
  return structuredClone(report) as CoreTrustReport;
}

function testColdStartSuggestsPositionAndExchangeReconcile() {
  reset();
  const report = runtimeEngine.getCoreTrustReport({ test: "recovery-planner-cold-start" });
  const plan = planRecovery({ coreTrustReport: report });

  assert.equal(plan.plannerVersion, RECOVERY_PLANNER_VERSION);
  assert.equal(plan.required, true);
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.RECONCILE_POSITION));
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.RECONCILE_ORDERS));
  assert.ok(plan.reasons.includes("position_unknown"));
  assert.ok(plan.reasons.includes("exchange_truth_unknown"));
  assert.ok(plan.forbiddenActions.includes("PLACE_ORDER"));
  assert.ok(plan.forbiddenActions.includes("BYPASS_ACTION_GATE"));
}

function testMarketStaleSuggestsRefreshMarketData() {
  const report = cloneReport(trustedReport());
  report.trustState = KERNEL_TRUST_STATE.RECOVERABLE;
  report.freshness.marketDataFreshness.status = "stale";
  report.freshness.marketDataFreshness.reason = "market_data_stale";
  report.freshness.blockingReasons = ["market_data_stale"];
  report.freshness.okForNormalTrading = false;
  report.blockingReasons = [{
    code: "market_data_stale",
    domain: "freshness",
    severity: "blocking",
    message: "Market data is stale."
  }];

  const plan = planRecovery({ coreTrustReport: report });

  assert.equal(plan.required, true);
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.REFRESH_MARKET_DATA));
  assert.ok(plan.reasons.includes("market_data_stale"));
}

function testHealthUnknownSuggestsCheckHealth() {
  const report = cloneReport(trustedReport());
  report.trustState = KERNEL_TRUST_STATE.UNCERTAIN;
  report.healthTruth.healthTruthComplete = false;
  report.healthTruth.wsConnected = "unknown";
  report.healthTruth.healthTruthDiagnostics = ["health_truth_unknown"];
  report.blockingReasons = [{
    code: "health_truth_unknown",
    domain: "healthTruth",
    severity: "blocking",
    message: "Health truth is unknown."
  }];

  const plan = planRecovery({ coreTrustReport: report });

  assert.equal(plan.required, true);
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.CHECK_HEALTH));
  assert.ok(plan.reasons.includes("health_truth_unknown"));
}

function testCompromisedSuggestsReplayCheckAndManualReview() {
  const report = cloneReport(trustedReport());
  report.trustState = KERNEL_TRUST_STATE.COMPROMISED;
  report.replay = { ok: false, mismatch: true, reason: "replay mismatch" };
  report.blockingReasons = [{
    code: "replay_mismatch",
    domain: "replay",
    severity: "critical",
    message: "Replay mismatch."
  }];

  const plan = planRecovery({ coreTrustReport: report });

  assert.equal(plan.required, true);
  assert.equal(plan.mode, "forensic_review");
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK));
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.MANUAL_REVIEW));
  assert.equal(plan.manualReviewRequired, true);
}

function testPanicSuggestsHaltRuntimeAndManualReview() {
  const report = cloneReport(trustedReport());
  report.trustState = KERNEL_TRUST_STATE.PANIC;
  report.blockingReasons = [{
    code: "critical_corruption",
    domain: "system",
    severity: "panic",
    message: "Critical corruption detected."
  }];

  const plan = planRecovery({ coreTrustReport: report });

  assert.equal(plan.required, true);
  assert.equal(plan.mode, "panic_halt");
  assert.equal(plan.priority, "critical");
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.HALT_RUNTIME));
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.MANUAL_REVIEW));
  assert.equal(plan.manualReviewRequired, true);
}

function testTrustedDoesNotRequireRecovery() {
  const report = trustedReport();
  const plan = planRecovery({ coreTrustReport: report });

  assert.equal(plan.required, false);
  assert.equal(plan.mode, "none");
  assert.deepEqual(plan.nextActions, []);
  assert.equal(plan.priority, "none");
  assert.equal(plan.manualReviewRequired, false);
}

function testQuarantineSuggestsInspection() {
  const report = trustedReport();
  const plan = planRecovery({
    coreTrustReport: report,
    quarantineSummary: {
      count: 1,
      reasons: ["invalid_event_quarantined"]
    }
  });

  assert.equal(plan.required, true);
  assert.ok(plan.nextActions.includes(RECOVERY_ACTION_TYPE.INSPECT_QUARANTINE));
  assert.ok(plan.reasons.includes("quarantine_items_present"));
}

function testPlannerDoesNotMutateSnapshot() {
  reset();
  const beforeSnapshot = structuredClone(runtimeEngine.getSnapshot());
  const report = runtimeEngine.getCoreTrustReport({ test: "recovery-planner-purity" });
  const beforeReport = structuredClone(report);

  planRecovery({
    coreTrustReport: report,
    lastActionGateVerdict: runtimeEngine.evaluateAction({ type: ACTION_TYPE.PLACE_ORDER })
  });

  assert.deepEqual(runtimeEngine.getSnapshot(), beforeSnapshot);
  assert.deepEqual(report, beforeReport);
}

testColdStartSuggestsPositionAndExchangeReconcile();
testMarketStaleSuggestsRefreshMarketData();
testHealthUnknownSuggestsCheckHealth();
testCompromisedSuggestsReplayCheckAndManualReview();
testPanicSuggestsHaltRuntimeAndManualReview();
testTrustedDoesNotRequireRecovery();
testQuarantineSuggestsInspection();
testPlannerDoesNotMutateSnapshot();

console.log(JSON.stringify({
  name: "recovery_planner",
  ok: true,
  plannerVersion: RECOVERY_PLANNER_VERSION
}, null, 2));
