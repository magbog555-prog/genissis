import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `mbg-core-wave4-scenario-audit-${process.pid}-${Date.now()}`);
process.env.GENESIS_DATA_DIR = dataDir;
process.env.PERSISTENCE_ENABLED = "true";
process.env.MBG_HEALTH_CONNECTION_STATUS_TTL_MS = "15000";
process.env.MBG_EVENT_FUTURE_TOLERANCE_MS = "5000";

const { runtimeEngine } = await import("../../core/runtime/src/runtime-engine.js");
const { ACTION_TYPE } = await import("../../core/contracts/src/actions.js");
const { EVENT_TYPE } = await import("../../core/contracts/src/events.js");

type ScenarioResult = {
  name: string;
  covers: string[];
  ok: boolean;
  detail?: string;
};

type CommitResult = {
  ok: boolean;
  status?: string;
  snapshot?: unknown;
  snapshotRevision?: number;
  diagnostic?: unknown;
};

type CoreTrustReport = {
  trustState?: string;
  tradingAllowed?: boolean;
  blockingReasons?: unknown[];
  reasons?: unknown[];
  sections?: Record<string, unknown>;
  bootstrap?: unknown;
  exchangeTruth?: unknown;
  freshness?: unknown;
  healthTruth?: unknown;
  actionVerdicts?: unknown;
  allowedActions?: unknown;
  deniedActions?: unknown;
  recoveryActions?: unknown;
  requiredRecovery?: unknown;
  recoveryHints?: unknown;
  [key: string]: unknown;
};

type Wave4Runtime = typeof runtimeEngine & {
  commitEventResult?: (event: Record<string, unknown>, options?: { log?: boolean }) => CommitResult;
  getCoreTrustReport?: (options?: Record<string, unknown>) => CoreTrustReport;
  getHealthSnapshot?: () => Record<string, unknown>;
  replayCheck?: () => Record<string, unknown>;
};

const engine = runtimeEngine as Wave4Runtime;
const results: ScenarioResult[] = [];

function scenario(name: string, covers: string[], body: () => void) {
  try {
    runtimeEngine.clearPersistenceAndReset();
    body();
    results.push({ name, covers, ok: true });
  } catch (err) {
    results.push({
      name,
      covers,
      ok: false,
      detail: err instanceof Error ? err.message : String(err)
    });
  }
}

function isoNow() {
  return new Date().toISOString();
}

function isoPast(msAgo: number) {
  return new Date(Date.now() - msAgo).toISOString();
}

function fixedEvent(
  eventType: string,
  payload: Record<string, unknown>,
  eventId: string,
  source = "wave4-scenario-audit",
  timestamp = isoNow()
) {
  return {
    eventId,
    eventType,
    timestamp,
    source,
    schemaVersion: 1,
    payload
  };
}

function commitOk(event: Record<string, unknown>, message: string) {
  assert.equal(typeof engine.commitEventResult, "function", "runtimeEngine.commitEventResult(event, { log: false }) is required");
  const result = engine.commitEventResult!(event, { log: false });
  assert.equal(result.ok, true, `${message}: expected accepted event, got ${JSON.stringify(result)}`);
  assert.ok(result.status === "accepted" || result.status === "duplicate_ignored", `${message}: unexpected status ${String(result.status)}`);
  return result;
}

function bootstrapEvent(eventType: string, eventId: string, reason = eventType.replace(".", "_")) {
  return fixedEvent(eventType, {
    source: "wave4-scenario-audit",
    provider: "wave4-scenario-audit",
    reason
  }, eventId, "core");
}

function completeBootstrap(prefix = "w4-bootstrap") {
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, `${prefix}-loading`), "bootstrap.loading_snapshot");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, `${prefix}-replaying`), "bootstrap.replaying_tail");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, `${prefix}-awaiting-exchange-truth`), "bootstrap.awaiting_exchange_truth");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, `${prefix}-reconciled`), "bootstrap.reconciled");
}

function validProvenanceRecorded(eventId: string, timestamp = isoNow()) {
  return fixedEvent(EVENT_TYPE.METADATA_PROVENANCE_RECORDED, {
    provenanceId: `${eventId}:provenance`,
    originType: "observation",
    originEventId: eventId,
    targetId: "action:place_order",
    parentProvenanceIds: [],
    source: "wave4-scenario-audit",
    confidence: 1,
    createdAtFromEvent: timestamp
  }, eventId, "core", timestamp);
}

function validMarketTick(eventId: string, timestamp = isoNow()) {
  return fixedEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "wave4-scenario-audit",
    source: "market-data",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp
  }, eventId, "market-data", timestamp);
}

function validMarketInputObservation(eventId: string, timestamp = isoNow(), sequence = 1) {
  return fixedEvent(EVENT_TYPE.MARKET_INPUT_OBSERVED, {
    observation: {
      observationId: `${eventId}:observation`,
      sourceType: "simulated",
      sourceName: "wave4-scenario-audit",
      symbol: "BTCUSDT",
      channel: "ticker",
      sequence,
      previousSequence: sequence > 1 ? sequence - 1 : undefined,
      exchangeTimestamp: timestamp,
      receivedTimestampFromEvent: timestamp,
      payloadHash: `sha256:${eventId}`,
      provenanceId: `${eventId}:provenance`,
      freshnessHint: { maxAgeMs: 15000, observedAgeMs: 0, stale: false },
      schemaVersion: "1"
    }
  }, eventId, "market-input", timestamp);
}

function validPositionReconciled(eventId: string, quantity = 0, timestamp = isoNow()) {
  return fixedEvent(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    quantity,
    free: quantity,
    locked: 0,
    markPrice: 65000,
    exposure: Math.abs(quantity * 65000),
    provider: "wave4-scenario-audit",
    source: "exchange",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp
  }, eventId, "exchange", timestamp);
}

function validOrderReconciled(eventId: string, timestamp = isoNow()) {
  return fixedEvent(EVENT_TYPE.ORDER_RECONCILED, {
    orderId: `${eventId}:order`,
    clientOrderId: `${eventId}:client`,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    filledQuantity: 0,
    provider: "wave4-scenario-audit",
    source: "exchange",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp
  }, eventId, "exchange", timestamp);
}

function exchangeTruthFresh(eventId: string, timestamp = isoNow()) {
  return fixedEvent(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    provider: "wave4-scenario-audit",
    lastAccountReconcileAt: timestamp,
    lastPositionReconcileAt: timestamp,
    lastOrderReconcileAt: timestamp,
    lastFillSyncAt: timestamp,
    drift: {},
    conflicts: [],
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0
  }, eventId, "exchange", timestamp);
}

function exchangeTruthStale(eventId: string, timestamp = isoPast(60000)) {
  return fixedEvent(EVENT_TYPE.EXCHANGE_TRUTH_STALE_DETECTED, {
    source: "exchange",
    provider: "wave4-scenario-audit",
    reason: "exchange_truth_stale",
    lastAccountReconcileAt: timestamp,
    lastPositionReconcileAt: timestamp,
    lastOrderReconcileAt: timestamp,
    lastFillSyncAt: timestamp,
    staleAfterMs: 15000
  }, eventId, "exchange", timestamp);
}

function healthChanged(
  eventId: string,
  status: "connected" | "disconnected" | "unknown",
  timestamp = isoNow()
) {
  return fixedEvent(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status,
    connectionState: status,
    wsConnected: status === "connected" ? true : status === "disconnected" ? false : "unknown",
    provider: "wave4-scenario-audit",
    source: "health-truth",
    reason: status === "connected" ? "connection_healthy" : "connection_state_unknown",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp
  }, eventId, "health-truth", timestamp);
}

function systemHalted(eventId: string) {
  return fixedEvent(EVENT_TYPE.SYSTEM_HALTED, {
    source: "core",
    provider: "wave4-scenario-audit",
    reason: "manual_halt_for_wave4_audit"
  }, eventId, "core");
}

function prepareReadyState(prefix = "w4-ready") {
  const now = isoNow();
  commitOk(validMarketTick(`${prefix}-market`, now), "market.tick.received");
  commitOk(validMarketInputObservation(`${prefix}-market-input`, now), "market.input.observed");
  commitOk(validPositionReconciled(`${prefix}-position`, 0, now), "position.reconciled");
  commitOk(validOrderReconciled(`${prefix}-order`, now), "order.reconciled");
  commitOk(healthChanged(`${prefix}-health`, "connected", now), "system.health.changed connected");
  completeBootstrap(`${prefix}-bootstrap`);
  commitOk(exchangeTruthFresh(`${prefix}-exchange-truth`, now), "exchange_truth.reconcile_succeeded");
  commitOk(validProvenanceRecorded(`${prefix}-provenance`, now), "metadata.provenance.recorded");
}

function getReport(message = "CoreTrustReport") {
  assert.equal(typeof engine.getCoreTrustReport, "function", "runtimeEngine.getCoreTrustReport() is required for Wave 4 Kernel Authority audit");
  const before = JSON.stringify(runtimeEngine.getSnapshot());
  const beforeRevision = runtimeEngine.getSnapshot().revision;
  const report = engine.getCoreTrustReport!({
    actions: [ACTION_TYPE.PLACE_ORDER, ACTION_TYPE.RECONCILE_POSITION, ACTION_TYPE.RECONCILE_ORDER, ACTION_TYPE.PAUSE_RUNTIME]
  });
  const after = JSON.stringify(runtimeEngine.getSnapshot());
  assert.equal(runtimeEngine.getSnapshot().revision, beforeRevision, `${message}: Kernel Authority must not mutate snapshot revision`);
  assert.equal(after, before, `${message}: Kernel Authority must not mutate runtime state`);
  assert.ok(report && typeof report === "object", `${message}: report must be an object`);
  return report;
}

function assertTrustState(report: CoreTrustReport, expected: string, message: string) {
  assert.equal(report.trustState, expected, `${message}: expected trustState=${expected}, got ${String(report.trustState)} in ${JSON.stringify(report)}`);
}

function assertNotTrusted(report: CoreTrustReport, message: string) {
  assert.notEqual(report.trustState, "TRUSTED", `${message}: report must not be TRUSTED`);
  assert.equal(report.tradingAllowed, false, `${message}: tradingAllowed must be false`);
}

function reasonValues(report: CoreTrustReport) {
  const values: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string") values.push(value);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["code", "reason", "reasonCode", "id", "message"]) {
        if (typeof record[key] === "string") values.push(record[key] as string);
      }
    }
  };

  if (Array.isArray(report.blockingReasons)) report.blockingReasons.forEach(collect);
  if (Array.isArray(report.reasons)) report.reasons.forEach(collect);
  for (const sectionName of ["bootstrap", "exchangeTruth", "freshness", "healthTruth"]) {
    const section = (report as Record<string, unknown>)[sectionName];
    if (section && typeof section === "object") {
      const record = section as Record<string, unknown>;
      collect(record.reason);
      collect(record.status);
      if (Array.isArray(record.reasons)) record.reasons.forEach(collect);
      if (Array.isArray(record.blockingReasons)) record.blockingReasons.forEach(collect);
      if (Array.isArray(record.diagnostics)) record.diagnostics.forEach(collect);
    }
  }
  return Array.from(new Set(values));
}

function assertHasReason(report: CoreTrustReport, expected: string, message: string) {
  const reasons = reasonValues(report);
  assert.ok(reasons.includes(expected) || reasons.some((reason) => reason.includes(expected)), `${message}: expected reason ${expected}, got ${JSON.stringify(reasons)} in ${JSON.stringify(report)}`);
}

function assertRequiredSections(report: CoreTrustReport) {
  for (const section of ["bootstrap", "exchangeTruth", "freshness", "healthTruth"]) {
    const direct = (report as Record<string, unknown>)[section];
    const nested = report.sections?.[section];
    assert.ok(direct || nested, `CoreTrustReport must contain ${section} section`);
  }
}

function actionDecisionFromReport(report: CoreTrustReport, actionType: string): Record<string, unknown> | undefined {
  const candidates = [report.actionVerdicts, report.allowedActions, report.deniedActions, report.actions];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      const found = candidate.find((item) => item && typeof item === "object" && ((item as any).actionType === actionType || (item as any).type === actionType));
      if (found) return found as Record<string, unknown>;
    }
    if (typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      const direct = record[actionType];
      if (direct && typeof direct === "object") return direct as Record<string, unknown>;
    }
  }
  return undefined;
}

function assertMachineReadableDeniedVerdict(decision: Record<string, unknown>, message: string) {
  assert.equal(decision.decision, "deny", `${message}: expected deny decision, got ${JSON.stringify(decision)}`);
  const reasons = [
    decision.reason,
    decision.reasonCode,
    ...(Array.isArray(decision.reasons) ? decision.reasons : []),
    ...(Array.isArray(decision.blockingReasons) ? decision.blockingReasons : [])
  ];
  const hasMachineReason = reasons.some((reason) => {
    if (typeof reason === "string") return /^[a-z0-9_.:-]+$/.test(reason);
    if (reason && typeof reason === "object") {
      const record = reason as Record<string, unknown>;
      return typeof record.code === "string" || typeof record.reasonCode === "string";
    }
    return false;
  });
  assert.ok(hasMachineReason, `${message}: denied verdict must contain machine-readable reason/code, got ${JSON.stringify(decision)}`);
}

function assertFrontendCanUseReport(report: CoreTrustReport) {
  assert.ok(typeof report.trustState === "string", "frontend must receive top-level trustState");
  assert.ok(typeof report.tradingAllowed === "boolean", "frontend must receive top-level tradingAllowed");
  assert.ok(Array.isArray(report.blockingReasons) || Array.isArray(report.reasons), "frontend must receive top-level blocking reasons / reasons");
  assert.ok(report.actionVerdicts || report.allowedActions || report.deniedActions || report.actions, "frontend must receive action verdicts/permissions, not compute them from raw flags");
  assert.ok(report.requiredRecovery || report.recoveryHints || report.recoveryActions, "frontend must receive recovery-oriented output/hints");
}

function appendUncommittedTailEventForReplayMismatch() {
  const eventsDir = path.join(dataDir, "events");
  fs.mkdirSync(eventsDir, { recursive: true });
  const segment = path.join(eventsDir, "segment-00000000.jsonl");
  const extra = validMarketTick(`w4-replay-mismatch-tail-${Date.now()}`, isoNow());
  fs.appendFileSync(segment, `${JSON.stringify(extra)}\n`, "utf8");
}

scenario("cold start -> CoreTrustReport trustState=UNCERTAIN and tradingAllowed=false", ["Kernel Authority", "CoreTrustReport"], () => {
  const report = getReport("cold start report");
  assertTrustState(report, "UNCERTAIN", "cold start");
  assert.equal(report.tradingAllowed, false);
  assertRequiredSections(report);
});

scenario("bootstrap not reconciled -> not TRUSTED", ["Bootstrap", "Kernel Authority"], () => {
  const now = isoNow();
  commitOk(validMarketTick("w4-bootstrap-block-market", now), "market.tick.received");
  commitOk(validPositionReconciled("w4-bootstrap-block-position", 0, now), "position.reconciled");
  commitOk(healthChanged("w4-bootstrap-block-health", "connected", now), "system.health.changed connected");
  commitOk(exchangeTruthFresh("w4-bootstrap-block-exchange", now), "exchange_truth.reconcile_succeeded");

  const report = getReport("bootstrap not reconciled report");
  assertNotTrusted(report, "bootstrap not reconciled");
  assertHasReason(report, "bootstrap_not_reconciled", "bootstrap not reconciled");
});

scenario("exchangeTruth stale -> not TRUSTED with blocking reason", ["ExchangeTruth", "Kernel Authority"], () => {
  prepareReadyState("w4-stale");
  commitOk(exchangeTruthStale("w4-stale-detected"), "exchange_truth.stale_detected");

  const report = getReport("stale exchange truth report");
  assertNotTrusted(report, "exchangeTruth stale");
  assertHasReason(report, "exchange_truth_stale", "exchangeTruth stale");
});

scenario("health unknown -> not TRUSTED", ["Health Truth", "Kernel Authority"], () => {
  const now = isoNow();
  commitOk(validMarketTick("w4-health-unknown-market", now), "market.tick.received");
  commitOk(validPositionReconciled("w4-health-unknown-position", 0, now), "position.reconciled");
  commitOk(exchangeTruthFresh("w4-health-unknown-exchange", now), "exchange_truth.reconcile_succeeded");
  completeBootstrap("w4-health-unknown-bootstrap");
  commitOk(healthChanged("w4-health-unknown-event", "unknown", now), "system.health.changed unknown");

  const report = getReport("health unknown report");
  assertNotTrusted(report, "health unknown");
  assertHasReason(report, "connection_state_unknown", "health unknown");
});

scenario("replay mismatch -> COMPROMISED", ["Replay Check", "Kernel Authority"], () => {
  prepareReadyState("w4-replay");
  appendUncommittedTailEventForReplayMismatch();
  assert.equal(typeof engine.replayCheck, "function", "runtimeEngine.replayCheck() is required");
  const replay = engine.replayCheck!();
  assert.equal(replay.ok, false, `audit setup must create replay mismatch, got ${JSON.stringify(replay)}`);

  const report = getReport("replay mismatch report");
  assertTrustState(report, "COMPROMISED", "replay mismatch");
  assert.equal(report.tradingAllowed, false);
  assertHasReason(report, "replay_mismatch", "replay mismatch");
});

scenario("halted system -> HALTED", ["System Halt", "Kernel Authority"], () => {
  prepareReadyState("w4-halted");
  commitOk(systemHalted("w4-system-halted"), "system.halted");

  const report = getReport("halted system report");
  assertTrustState(report, "HALTED", "halted system");
  assert.equal(report.tradingAllowed, false);
  assertHasReason(report, "system_halted", "halted system");
});

scenario("full ready state -> TRUSTED", ["Kernel Authority", "ActionGate Verdict v2"], () => {
  prepareReadyState("w4-full-ready");

  const report = getReport("full ready report");
  assertTrustState(report, "TRUSTED", "full ready state");
  assert.equal(report.tradingAllowed, true, `full ready state must allow trading at trust level when ActionGate allows: ${JSON.stringify(report)}`);
});

scenario("ActionGate denied verdict contains machine-readable reason", ["ActionGate Verdict v2"], () => {
  const decision = runtimeEngine.evaluateAction({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  }) as unknown as Record<string, unknown>;

  assertMachineReadableDeniedVerdict(decision, "direct ActionGate denied verdict");

  const report = getReport("denied action verdict report");
  const reportDecision = actionDecisionFromReport(report, ACTION_TYPE.PLACE_ORDER);
  assert.ok(reportDecision, `CoreTrustReport must include PLACE_ORDER verdict, got ${JSON.stringify(report)}`);
  assertMachineReadableDeniedVerdict(reportDecision!, "CoreTrustReport PLACE_ORDER verdict");
});

scenario("CoreTrustReport contains bootstrap/exchangeTruth/freshness/healthTruth sections", ["CoreTrustReport"], () => {
  const report = getReport("section report");
  assertRequiredSections(report);
});

scenario("frontend should not need to calculate trust from raw flags", ["CoreTrustReport", "Kernel Authority"], () => {
  prepareReadyState("w4-frontend");
  const report = getReport("frontend-ready report");
  assertFrontendCanUseReport(report);
});

const failed = results.filter((result) => !result.ok);

console.log(JSON.stringify({
  name: "wave4_scenario_audit",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  scenarios: results,
  expectedOnAlpha4: {
    total: 10,
    passed: 10,
    failed: 0
  }
}, null, 2));

try {
  fs.rmSync(dataDir, { recursive: true, force: true });
} catch {
  // best effort cleanup only
}

if (failed.length > 0) {
  process.exitCode = 1;
}
