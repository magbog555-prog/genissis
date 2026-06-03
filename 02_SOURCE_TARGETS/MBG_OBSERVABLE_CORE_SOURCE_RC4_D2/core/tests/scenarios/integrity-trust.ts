import assert from "node:assert/strict";
import { ACTION_TYPE, type GateDecision } from "../../core/contracts/src/actions.js";
import { DomainEvent, EVENT_TYPE } from "../../core/contracts/src/events.js";
import { ActionGate } from "../../core/gates/src/action-gate.js";
import { buildCoreTrustReport } from "../../core/kernel/core-trust-report.js";
import { KERNEL_TRUST_STATE } from "../../core/kernel/kernel-constitution.js";
import { buildCausalityReport, buildIntegrityReport, type IntegrityReport } from "../../core/integrity/integrity-report.js";
import { DEFAULT_FRESHNESS_CONFIG } from "../../core/runtime/src/freshness.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { planRecovery, RECOVERY_ACTION_TYPE } from "../../core/recovery/recovery-planner.js";

function isoNow() {
  return new Date().toISOString();
}

function event<TPayload>(
  eventType: string,
  eventId: string,
  payload: TPayload,
  source = "integrity-trust-test",
  timestamp = isoNow()
): DomainEvent<TPayload> {
  return {
    eventId,
    eventType: eventType as any,
    timestamp,
    source,
    schemaVersion: "1",
    payload
  } as DomainEvent<TPayload>;
}

function commit(e: DomainEvent, message: string) {
  const result = runtimeEngine.commitEventResult(e, { log: false });
  assert.equal(result.ok, true, `${message}: ${JSON.stringify(result)}`);
}

function bootstrap(eventType: string, id: string) {
  commit(event(eventType, id, {
    source: "core",
    provider: "core",
    reason: id
  }, "core"), `commit ${eventType}`);
}

function marketTick(id: string) {
  commit(event(EVENT_TYPE.MARKET_TICK_RECEIVED, id, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "integrity-trust-test",
    source: "market-data"
  }, "market-data"), "commit market tick");
}

function positionReconciled(id: string) {
  commit(event(EVENT_TYPE.POSITION_RECONCILED, id, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    quantity: 0,
    free: 0,
    locked: 0,
    exposure: 0,
    markPrice: 65000,
    source: "exchange",
    provider: "integrity-trust-test"
  }, "exchange"), "commit position reconciled");
}

function exchangeTruthSucceeded(id: string) {
  const now = isoNow();
  commit(event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, id, {
    source: "exchange",
    provider: "integrity-trust-test",
    reason: "exchange_truth_reconciled",
    lastAccountReconcileAt: now,
    lastPositionReconcileAt: now,
    lastOrderReconcileAt: now,
    lastFillSyncAt: now,
    drift: {},
    conflicts: []
  }, "exchange", now), "commit exchange truth succeeded");
}

function healthConnected(id: string) {
  const now = isoNow();
  commit(event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, id, {
    source: "system",
    provider: "integrity-trust-test",
    status: "healthy",
    connection: "websocket",
    connectionState: "connected",
    wsConnected: true,
    receivedAt: now,
    lastConnectionHeartbeatAt: now,
    reason: "websocket_connected"
  }, "system", now), "commit health connected");
}

function prepareTrustedRuntime(prefix: string) {
  runtimeEngine.clearPersistenceAndReset();
  bootstrap(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, `${prefix}-bootstrap-loading`);
  bootstrap(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, `${prefix}-bootstrap-replay`);
  bootstrap(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, `${prefix}-bootstrap-awaiting`);
  positionReconciled(`${prefix}-position-reconciled`);
  exchangeTruthSucceeded(`${prefix}-exchange-truth-fresh`);
  healthConnected(`${prefix}-health-connected`);
  marketTick(`${prefix}-market-fresh`);
  bootstrap(EVENT_TYPE.BOOTSTRAP_RECONCILED, `${prefix}-bootstrap-reconciled`);
}

function reportWithIntegrity(integrity: IntegrityReport, gateVerdict?: GateDecision) {
  const snapshot = runtimeEngine.getSnapshot();
  const now = new Date();
  const freshness = runtimeEngine.getFreshness(now);
  const healthTruth = runtimeEngine.getHealthSnapshot();
  const lastEvent = runtimeEngine.getEvents(1).at(-1);
  const lastTransition = runtimeEngine.getTransitions(1).at(-1);
  const causality = buildCausalityReport({
    lastEvent,
    lastTransition,
    gateVerdict
  });
  const gate = new ActionGate();
  const actions = gate.evaluateAll(snapshot, {
    enforceFreshness: true,
    now,
    freshness,
    freshnessConfig: DEFAULT_FRESHNESS_CONFIG,
    integrity,
    causality
  });
  return buildCoreTrustReport({
    snapshot,
    permissions: {
      tradingAllowed: actions.place_order.decision === "allow",
      actions
    },
    freshness,
    healthTruth,
    replay: runtimeEngine.replayCheck(),
    invariants: runtimeEngine.getInvariants(),
    lastEvent,
    lastTransition,
    integrity,
    causality
  });
}

function testIntegrityUnknownDoesNotCompromiseColdStart() {
  runtimeEngine.clearPersistenceAndReset();

  const report = runtimeEngine.getCoreTrustReport({ test: "integrity-unknown-cold-start" });

  assert.equal(report.integrity?.status, "unknown");
  assert.notEqual(report.trustState, KERNEL_TRUST_STATE.COMPROMISED);
  assert.notEqual(report.trustState, KERNEL_TRUST_STATE.PANIC);
}

function testIntegrityValidKeepsExistingTrustBehavior() {
  prepareTrustedRuntime("integrity-valid");

  const baseline = runtimeEngine.getCoreTrustReport({ test: "baseline-valid" });
  const validIntegrity = buildIntegrityReport({
    snapshot: runtimeEngine.getSnapshot(),
    lastEvent: runtimeEngine.getEvents(1).at(-1),
    lastTransition: runtimeEngine.getTransitions(1).at(-1),
    forcedStatus: "valid"
  });
  const integrated = reportWithIntegrity(validIntegrity);

  assert.equal(integrated.integrity?.status, "valid");
  assert.equal(integrated.tradingAllowed, baseline.tradingAllowed);
  assert.equal(integrated.trustState, baseline.trustState);
}

function testIntegrityBrokenProducesBlockingReason() {
  prepareTrustedRuntime("integrity-broken");

  const broken = buildIntegrityReport({
    snapshot: runtimeEngine.getSnapshot(),
    lastEvent: runtimeEngine.getEvents(1).at(-1),
    lastTransition: runtimeEngine.getTransitions(1).at(-1),
    forcedStatus: "broken",
    mismatchReason: "test_broken_chain"
  });
  const report = reportWithIntegrity(broken);

  assert.equal(report.integrity?.status, "broken");
  assert.ok(report.blockingReasons.some((reason) => reason.code === "integrity_broken"));
  assert.notEqual(report.trustState, KERNEL_TRUST_STATE.TRUSTED);
}

function testTamperedHashProducesCompromisedOrPanic() {
  prepareTrustedRuntime("integrity-tampered");

  const tampered = buildIntegrityReport({
    snapshot: runtimeEngine.getSnapshot(),
    lastEvent: runtimeEngine.getEvents(1).at(-1),
    lastTransition: runtimeEngine.getTransitions(1).at(-1),
    expectedSnapshotHash: "not-the-real-hash"
  });
  const report = reportWithIntegrity(tampered);

  assert.equal(report.integrity?.status, "tampered");
  assert.ok(
    report.trustState === KERNEL_TRUST_STATE.COMPROMISED || report.trustState === KERNEL_TRUST_STATE.PANIC,
    `expected COMPROMISED or PANIC, got ${report.trustState}`
  );
}

function testCoreTrustReportIncludesIntegrityAndCausality() {
  prepareTrustedRuntime("integrity-report-fields");

  const report = runtimeEngine.getCoreTrustReport({ test: "integrity-and-causality" });

  assert.ok(report.integrity);
  assert.equal(report.integrity.revision, runtimeEngine.getSnapshot().revision);
  assert.ok(report.integrity.snapshotHash);
  assert.ok(report.causality);
  assert.equal(report.causality.traceAvailable, true);
  assert.equal(report.causality.revisionAfter, runtimeEngine.getSnapshot().revision);
}

function testActionGateVerdictIncludesTraceAndIntegrityWhenAvailable() {
  prepareTrustedRuntime("action-gate-integrity");

  const decision = runtimeEngine.evaluateAction({ type: ACTION_TYPE.PLACE_ORDER });

  assert.ok(decision.integrityStatus);
  assert.ok(decision.traceId);
}

function testRecoveryPlanSuggestsReplayManualReviewOnBrokenIntegrity() {
  prepareTrustedRuntime("recovery-broken-integrity");

  const broken = buildIntegrityReport({
    snapshot: runtimeEngine.getSnapshot(),
    lastEvent: runtimeEngine.getEvents(1).at(-1),
    lastTransition: runtimeEngine.getTransitions(1).at(-1),
    forcedStatus: "broken",
    mismatchReason: "test_recovery_broken_chain"
  });
  const report = reportWithIntegrity(broken);
  const recovery = planRecovery({
    coreTrustReport: report
  });

  assert.ok(recovery.nextActions.includes(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK));
  assert.ok(recovery.nextActions.includes(RECOVERY_ACTION_TYPE.MANUAL_REVIEW));
}

function testCausalityMissingSuggestsReplayOrInspectTrace() {
  prepareTrustedRuntime("causality-missing");

  const validIntegrity = buildIntegrityReport({
    snapshot: runtimeEngine.getSnapshot(),
    lastEvent: runtimeEngine.getEvents(1).at(-1),
    lastTransition: runtimeEngine.getTransitions(1).at(-1),
    forcedStatus: "valid"
  });
  const missingCausality = buildCausalityReport({
    lastEvent: runtimeEngine.getEvents(1).at(-1),
    lastTransition: undefined
  });
  const snapshot = runtimeEngine.getSnapshot();
  const now = new Date();
  const freshness = runtimeEngine.getFreshness(now);
  const actions = new ActionGate().evaluateAll(snapshot, {
    enforceFreshness: true,
    now,
    freshness,
    freshnessConfig: DEFAULT_FRESHNESS_CONFIG,
    integrity: validIntegrity,
    causality: missingCausality
  });
  const report = buildCoreTrustReport({
    snapshot,
    permissions: { tradingAllowed: actions.place_order.decision === "allow", actions },
    freshness,
    healthTruth: runtimeEngine.getHealthSnapshot(),
    replay: runtimeEngine.replayCheck(),
    invariants: runtimeEngine.getInvariants(),
    lastEvent: runtimeEngine.getEvents(1).at(-1),
    lastTransition: runtimeEngine.getTransitions(1).at(-1),
    integrity: validIntegrity,
    causality: missingCausality
  });
  const recovery = planRecovery({ coreTrustReport: report });

  assert.equal(report.causality?.traceAvailable, false);
  assert.ok(
    recovery.nextActions.includes(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK) ||
    recovery.nextActions.includes(RECOVERY_ACTION_TYPE.INSPECT_TRACE)
  );
}

function testIntegrationDoesNotMutateSnapshot() {
  prepareTrustedRuntime("no-mutation");

  const before = JSON.stringify(runtimeEngine.getSnapshot());
  const beforeRevision = runtimeEngine.getSnapshot().revision;

  runtimeEngine.getIntegrityReport();
  runtimeEngine.getCausalityReport();
  runtimeEngine.getCoreTrustReport({ test: "no-mutation" });
  runtimeEngine.getRecoveryPlan({ test: "no-mutation" });

  assert.equal(runtimeEngine.getSnapshot().revision, beforeRevision);
  assert.equal(JSON.stringify(runtimeEngine.getSnapshot()), before);
}

testIntegrityUnknownDoesNotCompromiseColdStart();
testIntegrityValidKeepsExistingTrustBehavior();
testIntegrityBrokenProducesBlockingReason();
testTamperedHashProducesCompromisedOrPanic();
testCoreTrustReportIncludesIntegrityAndCausality();
testActionGateVerdictIncludesTraceAndIntegrityWhenAvailable();
testRecoveryPlanSuggestsReplayManualReviewOnBrokenIntegrity();
testCausalityMissingSuggestsReplayOrInspectTrace();
testIntegrationDoesNotMutateSnapshot();

console.log("integrity + trust integration checks passed");
