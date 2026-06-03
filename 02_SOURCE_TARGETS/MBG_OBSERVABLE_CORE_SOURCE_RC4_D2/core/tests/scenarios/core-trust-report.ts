import assert from "node:assert/strict";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { DomainEvent, EVENT_TYPE } from "../../core/contracts/src/events.js";
import { KERNEL_TRUST_STATE } from "../../core/kernel/kernel-constitution.js";

function isoNow() {
  return new Date().toISOString();
}

function event<TPayload>(
  eventType: string,
  eventId: string,
  payload: TPayload,
  source = "core-trust-report-test",
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
    provider: "core-trust-report-test",
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
    provider: "core-trust-report-test"
  }, "exchange"), "commit position reconciled");
}

function exchangeTruthSucceeded(id: string) {
  const now = isoNow();
  commit(event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, id, {
    source: "exchange",
    provider: "core-trust-report-test",
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
    provider: "core-trust-report-test",
    status: "healthy",
    connection: "websocket",
    connectionState: "connected",
    wsConnected: true,
    receivedAt: now,
    lastConnectionHeartbeatAt: now,
    reason: "websocket_connected"
  }, "system", now), "commit health connected");
}

function prepareTrustedRuntime() {
  runtimeEngine.clearPersistenceAndReset();
  bootstrap(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, "trust-report-bootstrap-loading");
  bootstrap(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, "trust-report-bootstrap-replay");
  bootstrap(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, "trust-report-bootstrap-awaiting");
  positionReconciled("trust-report-position-reconciled");
  exchangeTruthSucceeded("trust-report-exchange-truth-fresh");
  healthConnected("trust-report-health-connected");
  marketTick("trust-report-market-fresh");
  bootstrap(EVENT_TYPE.BOOTSTRAP_RECONCILED, "trust-report-bootstrap-reconciled");
}

function testReportContainsTrustState() {
  runtimeEngine.clearPersistenceAndReset();
  const report = runtimeEngine.getCoreTrustReport({ test: "contains-trust-state" });

  assert.equal(typeof report.trustState, "string");
  assert.ok(Object.values(KERNEL_TRUST_STATE).includes(report.trustState));
  assert.equal(report.revision, runtimeEngine.getSnapshot().revision);
}

function testReportContainsBlockingReasons() {
  runtimeEngine.clearPersistenceAndReset();
  const report = runtimeEngine.getCoreTrustReport({ test: "contains-blocking-reasons" });

  assert.ok(Array.isArray(report.blockingReasons));
  assert.ok(report.blockingReasons.length > 0);
  const first = report.blockingReasons[0];
  assert.equal(typeof first.code, "string");
  assert.equal(typeof first.domain, "string");
  assert.equal(typeof first.severity, "string");
  assert.equal(typeof first.message, "string");
}

function testColdStartTradingDenied() {
  runtimeEngine.clearPersistenceAndReset();
  const report = runtimeEngine.getCoreTrustReport({ test: "cold-start-denied" });

  assert.equal(report.tradingAllowed, false);
  assert.notEqual(report.trustState, KERNEL_TRUST_STATE.TRUSTED);
  assert.ok(report.blockingReasons.some((reason) => reason.code === "bootstrap_not_reconciled"));
}

function testTrustedReportDependsOnActionGateAllow() {
  prepareTrustedRuntime();

  const directDecision = runtimeEngine.evaluateAction({ type: ACTION_TYPE.PLACE_ORDER });
  const report = runtimeEngine.getCoreTrustReport({ test: "trusted-action-gate" });

  assert.equal(report.tradingAllowed, directDecision.decision === "allow");
  if (report.tradingAllowed) {
    assert.equal(report.trustState, KERNEL_TRUST_STATE.TRUSTED);
    assert.ok(report.allowedActionClasses.includes("NORMAL"));
  }
}

function testReportContainsCoreEvidenceBlocks() {
  runtimeEngine.clearPersistenceAndReset();
  const report = runtimeEngine.getCoreTrustReport({ test: "evidence-blocks" });

  assert.ok(report.bootstrap);
  assert.ok(report.exchangeTruth);
  assert.ok(report.freshness);
  assert.ok(report.healthTruth);
  assert.ok(report.replay);
  assert.ok(Array.isArray(report.invariants));
}

function testReportIsSufficientForFrontendTrustDisplay() {
  runtimeEngine.clearPersistenceAndReset();
  const report = runtimeEngine.getCoreTrustReport({ test: "frontend-does-not-compute-trust" });

  assert.equal(typeof report.tradingAllowed, "boolean");
  assert.ok(Array.isArray(report.allowedActionClasses));
  assert.ok(Array.isArray(report.nextRecoveryActions));
  assert.ok(report.nextRecoveryActions.length > 0);
  assert.ok(report.blockingReasons.every((reason) =>
    typeof reason.code === "string" &&
    typeof reason.domain === "string" &&
    typeof reason.severity === "string" &&
    typeof reason.message === "string"
  ));
}

testReportContainsTrustState();
testReportContainsBlockingReasons();
testColdStartTradingDenied();
testTrustedReportDependsOnActionGateAllow();
testReportContainsCoreEvidenceBlocks();
testReportIsSufficientForFrontendTrustDisplay();

console.log("core trust report checks passed");
