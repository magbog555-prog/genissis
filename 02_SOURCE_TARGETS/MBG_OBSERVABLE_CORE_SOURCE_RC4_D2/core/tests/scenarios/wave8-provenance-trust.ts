import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { EVENT_TYPE, type DomainEvent } from "../../core/contracts/src/events.js";
import { ActionGate } from "../../core/gates/src/action-gate.js";
import {
  buildProvenanceHealthReport,
  PROVENANCE_BLOCKING_REASON
} from "../../core/integrity/integrity-report.js";
import { buildCoreTrustReport } from "../../core/kernel/core-trust-report.js";
import { KERNEL_TRUST_STATE } from "../../core/kernel/kernel-constitution.js";
import {
  planRecovery,
  RECOVERY_ACTION_TYPE
} from "../../core/recovery/recovery-planner.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { DEFAULT_FRESHNESS_CONFIG } from "../../core/runtime/src/freshness.js";

const now = new Date().toISOString();

function event<TPayload>(
  eventType: string,
  payload: TPayload,
  eventId: string,
  timestamp = now,
  source = "wave8-provenance-trust-test"
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
    provider: "wave8-provenance-trust-test"
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
    provider: "wave8-provenance-trust-test"
  }, `${prefix}-position`, now, "exchange"), "position reconciled");

  commit(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: `${prefix}-loading` }, `${prefix}-bootstrap-loading`, now, "core"), "bootstrap loading");
  commit(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: `${prefix}-replay` }, `${prefix}-bootstrap-replay`, now, "core"), "bootstrap replay");
  commit(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: `${prefix}-awaiting` }, `${prefix}-bootstrap-awaiting`, now, "core"), "bootstrap awaiting");
  commit(event(EVENT_TYPE.BOOTSTRAP_RECONCILED, { reason: `${prefix}-reconciled` }, `${prefix}-bootstrap-reconciled`, now, "core"), "bootstrap reconciled");

  commit(event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    provider: "wave8-provenance-trust-test",
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
    source: "wave8-provenance-trust-test",
    receivedAt: now,
    lastConnectionHeartbeatAt: now
  }, `${prefix}-health`, now, "core"), "health");
}

function gateOptions(provenance = buildProvenanceHealthReport({ status: "complete", checkedAt: now, traceId: "trace:complete" })) {
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
    provenance
  };
}

function buildReportWithProvenance(provenance = buildProvenanceHealthReport({ status: "complete", checkedAt: now, traceId: "trace:complete" })) {
  const snapshot = runtimeEngine.getSnapshot();
  const gate = new ActionGate();
  const actions = gate.evaluateAll(snapshot, gateOptions(provenance));
  const placeOrder = actions.place_order;
  const causality = runtimeEngine.getCausalityReport(undefined, undefined, placeOrder);
  return buildCoreTrustReport({
    snapshot,
    permissions: {
      tradingAllowed: placeOrder.decision === "allow",
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
    provenance
  });
}

function testRiskIncreasingActionWithoutProvenanceDenied() {
  prepareTrustedRuntime("wave8-missing");
  const revisionBefore = runtimeEngine.getSnapshot().revision;
  const verdict = runtimeEngine.evaluateAction({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  });

  assert.equal(verdict.decision, "deny");
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.provenanceStatus, "missing");
  assert.ok(verdict.blockingReasons.includes("provenance_missing"));
  assert.ok(verdict.provenanceBlockingReasons?.includes(PROVENANCE_BLOCKING_REASON.MISSING));
  assert.equal(runtimeEngine.getSnapshot().revision, revisionBefore, "ActionGate evaluation must not mutate snapshot.");
}

function testCancelAndRecoveryActionsAreNotBlockedByMissingProvenance() {
  prepareTrustedRuntime("wave8-cancel");
  const cancel = runtimeEngine.evaluateAction({ type: ACTION_TYPE.CANCEL_ORDER });
  const reconcile = runtimeEngine.evaluateAction({ type: ACTION_TYPE.RECONCILE_POSITION });

  assert.equal(cancel.decision, "allow");
  assert.equal(cancel.actionClass, "RISK_REDUCING");
  assert.equal(reconcile.decision, "allow");
  assert.equal(reconcile.actionClass, "RECOVERY");
}

function testMissingProvenanceIsNotCorruption() {
  prepareTrustedRuntime("wave8-missing-report");
  const report = runtimeEngine.getCoreTrustReport({ test: "missing-provenance-not-corruption" });

  assert.equal(report.provenanceStatus, "missing");
  assert.ok(report.provenanceBlockingReasons.includes(PROVENANCE_BLOCKING_REASON.MISSING));
  assert.notEqual(report.trustState, KERNEL_TRUST_STATE.COMPROMISED);
  assert.notEqual(report.trustState, KERNEL_TRUST_STATE.PANIC);
}

function testInconsistentProvenanceBlocksRisk() {
  prepareTrustedRuntime("wave8-inconsistent-gate");
  const gate = new ActionGate();
  const inconsistent = buildProvenanceHealthReport({
    status: "inconsistent",
    checkedAt: now,
    traceId: "trace:bad",
    evidence: { mismatch: true }
  });
  const verdict = gate.evaluate({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  }, runtimeEngine.getSnapshot(), gateOptions(inconsistent));

  assert.equal(verdict.decision, "deny");
  assert.equal(verdict.provenanceStatus, "inconsistent");
  assert.ok(verdict.blockingReasons.includes("provenance_inconsistent"));
  assert.ok(verdict.provenanceBlockingReasons?.includes(PROVENANCE_BLOCKING_REASON.INCONSISTENT));
}

function testProvenMismatchAffectsTrust() {
  prepareTrustedRuntime("wave8-mismatch-trust");
  const inconsistent = buildProvenanceHealthReport({
    status: "inconsistent",
    checkedAt: now,
    traceId: "trace:tampered-parent",
    evidence: { parentChainTampered: true }
  });
  const report = buildReportWithProvenance(inconsistent);

  assert.equal(report.provenanceStatus, "inconsistent");
  assert.ok(report.blockingReasons.some((reason) => reason.code === PROVENANCE_BLOCKING_REASON.INCONSISTENT));
  assert.equal(report.trustState, KERNEL_TRUST_STATE.COMPROMISED);
}

function testGateVerdictContainsProvenanceEvidence() {
  prepareTrustedRuntime("wave8-verdict-evidence");
  const complete = buildProvenanceHealthReport({
    status: "complete",
    checkedAt: now,
    traceId: "trace:complete",
    sourceEventId: "source:event"
  });
  const gate = new ActionGate();
  const verdict = gate.evaluate({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  }, runtimeEngine.getSnapshot(), gateOptions(complete));

  assert.equal(verdict.decision, "allow");
  assert.equal(verdict.provenanceStatus, "complete");
  assert.equal(verdict.provenanceTraceId, "trace:complete");
  assert.deepEqual(verdict.provenanceBlockingReasons, []);
}

function testCoreTrustReportContainsProvenanceStatus() {
  prepareTrustedRuntime("wave8-report-status");
  const complete = buildProvenanceHealthReport({
    status: "complete",
    checkedAt: now,
    traceId: "trace:report-complete"
  });
  const report = buildReportWithProvenance(complete);

  assert.equal(report.provenanceStatus, "complete");
  assert.deepEqual(report.provenanceBlockingReasons, []);
  assert.equal(report.provenance?.traceId, "trace:report-complete");
}

function testRecoveryPlannerSuggestsProvenanceRecoveryPath() {
  prepareTrustedRuntime("wave8-recovery");
  const missingReport = runtimeEngine.getCoreTrustReport({ test: "missing-provenance-recovery" });
  const missingPlan = planRecovery({ coreTrustReport: missingReport });

  assert.ok(missingPlan.nextActions.includes(RECOVERY_ACTION_TYPE.ATTACH_PROVENANCE));

  const inconsistent = buildProvenanceHealthReport({
    status: "inconsistent",
    checkedAt: now,
    traceId: "trace:bad",
    evidence: { mismatch: true }
  });
  const inconsistentReport = buildReportWithProvenance(inconsistent);
  const inconsistentPlan = planRecovery({ coreTrustReport: inconsistentReport });

  assert.ok(inconsistentPlan.nextActions.includes(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK));
  assert.ok(inconsistentPlan.nextActions.includes(RECOVERY_ACTION_TYPE.REPAIR_METADATA_CHAIN));
  assert.ok(inconsistentPlan.nextActions.includes(RECOVERY_ACTION_TYPE.QUARANTINE_INCONSISTENT_METADATA));
  assert.ok(inconsistentPlan.nextActions.includes(RECOVERY_ACTION_TYPE.MANUAL_REVIEW));
}

function testIntegrationDoesNotMutateSnapshot() {
  prepareTrustedRuntime("wave8-no-mutation");
  const before = structuredClone(runtimeEngine.getSnapshot());
  const report = runtimeEngine.getCoreTrustReport({ test: "no-mutation" });
  const plan = planRecovery({ coreTrustReport: report });
  const after = runtimeEngine.getSnapshot();

  assert.equal(after.revision, before.revision);
  assert.deepEqual(after, before);
  assert.equal(plan.required, true);
}

testRiskIncreasingActionWithoutProvenanceDenied();
testCancelAndRecoveryActionsAreNotBlockedByMissingProvenance();
testMissingProvenanceIsNotCorruption();
testInconsistentProvenanceBlocksRisk();
testProvenMismatchAffectsTrust();
testGateVerdictContainsProvenanceEvidence();
testCoreTrustReportContainsProvenanceStatus();
testRecoveryPlannerSuggestsProvenanceRecoveryPath();
testIntegrationDoesNotMutateSnapshot();

console.log("Wave 8 provenance trust integration checks passed");
