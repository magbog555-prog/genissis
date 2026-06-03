import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `mbg-core-wave8-scenario-audit-${process.pid}`);
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
  ok?: boolean;
  status?: string;
  eventId?: string;
  eventType?: string;
  snapshotRevision?: number;
  snapshot?: unknown;
  diagnostic?: unknown;
  [key: string]: unknown;
};

type RuntimeLike = typeof runtimeEngine & {
  commitEventResult?: (event: Record<string, unknown>, options?: { log?: boolean }) => CommitResult;
  clearPersistenceAndReset?: () => void;
  getSnapshot?: () => unknown;
  getRuntimeView?: () => unknown;
  getEvents?: (limit?: number) => unknown;
  getCanonicalJournal?: (limit?: number) => unknown;
  getJournalView?: (limit?: number) => unknown;
  getTransitions?: (limit?: number) => unknown;
  getCoreTrustReport?: (input?: unknown) => unknown;
  evaluateAction?: (action: unknown) => unknown;
  dispatchAction?: (action: unknown) => unknown;
  getPermissions?: () => unknown;
  replayCheck?: () => unknown;
  verifyReplay?: () => unknown;
  getCausalityTrace?: (input?: unknown) => unknown;
  getCausalityTraceView?: (input?: unknown) => unknown;
  getCausalityView?: (input?: unknown) => unknown;
  getTrace?: (input?: unknown) => unknown;
  getQuarantineView?: (limit?: number) => unknown;
  getQuarantineRecords?: (limit?: number) => unknown;
  getQuarantine?: (limit?: number) => unknown;
  getQuarantinedEvents?: (limit?: number) => unknown;
  getPermissionLedgerView?: (limit?: number) => unknown;
  getPermissionLedger?: (limit?: number) => unknown;
  getPermissionsLedgerView?: (limit?: number) => unknown;
  getRecoveryPlan?: (input?: unknown) => unknown;
  getRecoveryPlannerView?: (input?: unknown) => unknown;
  getRecoverySuggestions?: (input?: unknown) => unknown;
  planRecovery?: (input?: unknown) => unknown;
  getProvenanceView?: (input?: unknown) => unknown;
  getProvenanceRecords?: (input?: unknown) => unknown;
  getProvenanceLedger?: (input?: unknown) => unknown;
  getMetadataEvents?: (input?: unknown) => unknown;
  getProvenance?: (input?: unknown) => unknown;
};

const engine = runtimeEngine as RuntimeLike;
const results: ScenarioResult[] = [];

const FIXED_TIMESTAMP = "2025-01-01T00:00:00.000Z";
let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `wave8-${prefix}-${String(sequence).padStart(4, "0")}`;
}

function scenario(name: string, covers: string[], body: () => void) {
  try {
    sequence = 0;
    if (typeof engine.clearPersistenceAndReset === "function") engine.clearPersistenceAndReset();
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

function metadataEventType() {
  return (EVENT_TYPE as Record<string, string>).METADATA_PROVENANCE_ATTACHED
    ?? (EVENT_TYPE as Record<string, string>).PROVENANCE_ATTACHED
    ?? "metadata.provenance.attached";
}

function provenanceMismatchEventType() {
  return (EVENT_TYPE as Record<string, string>).METADATA_PROVENANCE_MISMATCH_DETECTED
    ?? (EVENT_TYPE as Record<string, string>).PROVENANCE_MISMATCH_DETECTED
    ?? "metadata.provenance.mismatch_detected";
}

function event(
  eventType: string,
  payload: Record<string, unknown>,
  eventId = nextId(eventType.replace(/[^a-z0-9]+/gi, "-")),
  source = "wave8-scenario-audit"
) {
  return {
    eventId,
    eventType,
    timestamp: FIXED_TIMESTAMP,
    source,
    schemaVersion: "1",
    payload
  };
}

function provenanceRef(overrides: Record<string, unknown> = {}) {
  return {
    provenanceId: "prov-wave8-origin-001",
    originEventId: "origin-wave8-001",
    subjectType: "action",
    subjectId: "action-wave8-place-order-001",
    sourceSystem: "scenario-audit",
    source: "scenario-audit",
    evidenceHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    traceId: "trace-wave8-001",
    createdAt: FIXED_TIMESTAMP,
    ...overrides
  };
}

function metadataProvenanceEvent(overrides: Record<string, unknown> = {}, eventId = "wave8-metadata-event-001") {
  const ref = provenanceRef(overrides);
  return event(metadataEventType(), {
    provenanceRef: ref,
    target: {
      type: ref.subjectType,
      id: ref.subjectId
    },
    deterministic: true,
    provider: "scenario-audit",
    source: "scenario-audit"
  }, eventId, "metadata");
}

function inconsistentProvenanceEvent() {
  return event(provenanceMismatchEventType(), {
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave8-inconsistent-001",
      subjectId: "action-wave8-place-order-001",
      evidenceHash: "sha256:2222222222222222222222222222222222222222222222222222222222222222"
    }),
    expectedHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    actualHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    reason: "provenance_mismatch",
    provider: "scenario-audit",
    source: "scenario-audit"
  }, "wave8-provenance-mismatch-001", "metadata");
}

function marketTick(eventId = "wave8-market-tick-001", price = 65000) {
  return event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price,
    bid: price - 1,
    ask: price + 1,
    volume: 1,
    provider: "wave8-scenario-audit"
  }, eventId, "market-data");
}

function bootstrapReconciled(eventId = "wave8-bootstrap-reconciled-001") {
  return event(EVENT_TYPE.BOOTSTRAP_RECONCILED, {
    reason: "wave8_bootstrap_reconciled",
    provider: "wave8-scenario-audit",
    source: "wave8-scenario-audit"
  }, eventId, "core");
}

function positionFlat(eventId = "wave8-position-flat-001") {
  return event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    quantity: 0,
    exposure: 0,
    status: "flat",
    source: "wave8-scenario-audit",
    provider: "wave8-scenario-audit"
  }, eventId, "exchange");
}

function exchangeTruthFresh(eventId = "wave8-exchange-truth-fresh-001") {
  return event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    reason: "wave8_exchange_truth_fresh",
    source: "wave8-scenario-audit",
    provider: "wave8-scenario-audit",
    lastAccountReconcileAt: FIXED_TIMESTAMP,
    lastPositionReconcileAt: FIXED_TIMESTAMP,
    lastOrderReconcileAt: FIXED_TIMESTAMP,
    lastFillSyncAt: FIXED_TIMESTAMP,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {}
  }, eventId, "exchange");
}

function healthHealthy(eventId = "wave8-health-healthy-001") {
  return event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    wsConnected: true,
    status: "healthy",
    observedAt: FIXED_TIMESTAMP,
    source: "wave8-scenario-audit",
    provider: "wave8-scenario-audit"
  }, eventId, "system");
}

function fillEvent(eventId = "wave8-fill-001") {
  return event(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
    orderId: "order-wave8-001",
    fillId: "fill-wave8-001",
    tradeId: "trade-wave8-001",
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    filledQuantity: 0.01,
    filledQuantityDelta: 0.01,
    price: 65000,
    fillPrice: 65000,
    commission: 0,
    commissionAsset: "USDT",
    provider: "wave8-scenario-audit",
    source: "wave8-scenario-audit",
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave8-fill-001",
      subjectType: "fill",
      subjectId: "fill-wave8-001",
      originEventId: "wave8-order-origin-001"
    })
  }, eventId, "exchange");
}

function stable(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, val) => {
    if (["timestamp", "observedAt", "generatedAt", "committedAt", "checkedAt", "createdAt", "updatedAt", "detectedAt", "decidedAt", "evaluatedAt", "asOf"].includes(key)) {
      return "[time]";
    }
    if (["ageMs", "eventsPerSecond", "timeSinceLastCommitMs", "uptimeMs"].includes(key)) {
      return "[dynamic]";
    }
    return val;
  }));
}

function flatten(value: unknown): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<unknown>();

  function visit(current: unknown) {
    if (current === null || current === undefined) return;
    if (typeof current !== "object") {
      out.push(current);
      return;
    }
    if (seen.has(current)) return;
    seen.add(current);
    out.push(current);
    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }
    for (const nested of Object.values(current as Record<string, unknown>)) visit(nested);
  }

  visit(value);
  return out;
}

function asText(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function textIncludes(value: unknown, fragments: string[]) {
  const text = asText(value).toLowerCase();
  return fragments.every((fragment) => text.includes(fragment.toLowerCase()));
}

function viewRecords(view: unknown): unknown[] {
  if (Array.isArray(view)) return view;
  if (!view || typeof view !== "object") return [];
  const object = view as Record<string, unknown>;
  const candidates = [
    object.records,
    object.entries,
    object.events,
    object.items,
    object.provenance,
    object.provenanceRefs,
    object.refs,
    object.traces,
    object.decisions,
    object.quarantine,
    object.metadata,
    object.journal
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return flatten(view).filter((item) => item && typeof item === "object");
}

function findRecord(view: unknown, fragments: string[]) {
  return viewRecords(view).find((record) => textIncludes(record, fragments));
}

function getRevision() {
  const snapshot = getSnapshot() as unknown as Record<string, unknown>;
  assert.equal(typeof snapshot.revision, "number", "snapshot.revision must be available");
  return snapshot.revision as number;
}

function getSnapshot() {
  assert.equal(typeof engine.getSnapshot, "function", "runtimeEngine.getSnapshot() is required");
  return engine.getSnapshot!();
}

function getProvenanceView(input?: unknown) {
  const candidates = [
    engine.getProvenanceView,
    engine.getProvenanceRecords,
    engine.getProvenanceLedger,
    engine.getMetadataEvents,
    engine.getProvenance
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, input);
  }
  const report = getCoreTrustReport({ includeProvenance: true });
  if (textIncludes(report, ["provenance"])) return report;
  throw new Error("Wave 8 provenance view API is not available");
}

function getTrace(input?: unknown) {
  const candidates = [
    engine.getCausalityTrace,
    engine.getCausalityTraceView,
    engine.getCausalityView,
    engine.getTrace
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, input);
  }
  throw new Error("Wave 7 causality trace API is not available");
}

function getCoreTrustReport(input?: unknown) {
  assert.equal(typeof engine.getCoreTrustReport, "function", "runtimeEngine.getCoreTrustReport() is required");
  return engine.getCoreTrustReport!(input);
}

function getQuarantineView() {
  const candidates = [
    engine.getQuarantineView,
    engine.getQuarantineRecords,
    engine.getQuarantine,
    engine.getQuarantinedEvents
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, 100);
  }
  throw new Error("Wave 5 quarantine API is not available");
}

function getPermissionLedgerView() {
  const candidates = [
    engine.getPermissionLedgerView,
    engine.getPermissionLedger,
    engine.getPermissionsLedgerView
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, 100);
  }
  throw new Error("Wave 5 permission ledger API is not available");
}

function getRecoveryPlan(input?: unknown) {
  const candidates = [
    engine.getRecoveryPlan,
    engine.getRecoveryPlannerView,
    engine.getRecoverySuggestions,
    engine.planRecovery
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, input);
  }
  throw new Error("Wave 5 recovery planner API is not available");
}

function canonicalJournal() {
  const candidates = [
    engine.getEvents,
    engine.getCanonicalJournal,
    engine.getJournalView
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, 100);
  }
  throw new Error("canonical event journal view is not available");
}

function commit(eventToCommit: Record<string, unknown>) {
  assert.equal(typeof engine.commitEventResult, "function", "runtimeEngine.commitEventResult(event, { log: false }) is required");
  return engine.commitEventResult!(eventToCommit, { log: false });
}

function commitAccepted(eventToCommit: Record<string, unknown>) {
  const result = commit(eventToCommit);
  assert.equal(result.ok, true, `expected event accepted: ${JSON.stringify(result)}`);
  assert.equal(result.status, "accepted", `expected status=accepted: ${JSON.stringify(result)}`);
  return result;
}

function evaluateAction(type: string, extra: Record<string, unknown> = {}) {
  const request = {
    type,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000,
    requestedBy: "wave8-scenario-audit",
    ...extra
  };
  if (typeof engine.evaluateAction === "function") return engine.evaluateAction(request);
  if (typeof engine.dispatchAction === "function") return engine.dispatchAction(request);
  throw new Error("ActionGate evaluation API is not available");
}

function placeOrderAction(extra: Record<string, unknown> = {}) {
  return evaluateAction(ACTION_TYPE.PLACE_ORDER, extra);
}

function cancelOrderAction(extra: Record<string, unknown> = {}) {
  return evaluateAction(ACTION_TYPE.CANCEL_ORDER, {
    orderId: "order-wave8-001",
    ...extra
  });
}

function reconcilePositionAction(extra: Record<string, unknown> = {}) {
  return evaluateAction(ACTION_TYPE.RECONCILE_POSITION, extra);
}

function decisionAllowed(decision: unknown) {
  const object = decision && typeof decision === "object" ? decision as Record<string, unknown> : {};
  if (typeof object.allowed === "boolean") return object.allowed;
  if (typeof object.decision === "string") return object.decision.toLowerCase() === "allow";
  return false;
}

function decisionDenied(decision: unknown) {
  const object = decision && typeof decision === "object" ? decision as Record<string, unknown> : {};
  if (typeof object.allowed === "boolean") return object.allowed === false;
  if (typeof object.decision === "string") return object.decision.toLowerCase() === "deny";
  return false;
}

function commitReadyState() {
  commitAccepted(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "wave8_bootstrap_loading", source: "wave8-scenario-audit" }, "wave8-bootstrap-loading-001", "core"));
  commitAccepted(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "wave8_bootstrap_replaying", source: "wave8-scenario-audit" }, "wave8-bootstrap-replaying-001", "core"));
  commitAccepted(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "wave8_bootstrap_awaiting_exchange_truth", source: "wave8-scenario-audit" }, "wave8-bootstrap-awaiting-exchange-truth-001", "core"));
  commitAccepted(bootstrapReconciled());
  commitAccepted(exchangeTruthFresh());
  commitAccepted(positionFlat());
  commitAccepted(marketTick());
  commitAccepted(healthHealthy());
}

function assertNoForbiddenDefaultWiring() {
  const root = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const scripts = JSON.stringify(pkg.scripts ?? {}).toLowerCase();
  const deps = JSON.stringify({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }).toLowerCase();
  const forbidden = ["v1", "genesis-v1", "live:trade", "live-trading", "execution:live", "ui:start", "next dev", "vite --host"];
  for (const token of forbidden) {
    assert.equal(scripts.includes(token), false, `forbidden script/default detected: ${token}`);
    assert.equal(deps.includes(token), false, `forbidden dependency/default detected: ${token}`);
  }
}

scenario("metadata event attaches ProvenanceRef", ["metadata_as_events", "provenance"], () => {
  commitAccepted(metadataProvenanceEvent());
  const provenance = getProvenanceView({ provenanceId: "prov-wave8-origin-001" });
  assert.ok(findRecord(provenance, ["prov-wave8-origin-001", "action-wave8-place-order-001"]), `ProvenanceRef not visible: ${JSON.stringify(provenance)}`);
});

scenario("duplicate metadata event is idempotent", ["idempotency", "metadata_as_events"], () => {
  const metadata = metadataProvenanceEvent();
  commitAccepted(metadata);
  const snapshotBefore = stable(getSnapshot());
  const revisionBefore = getRevision();
  const duplicate = commit(metadata);
  const snapshotAfter = stable(getSnapshot());
  const revisionAfter = getRevision();

  assert.equal(duplicate.ok, true, `duplicate metadata should be idempotent, got ${JSON.stringify(duplicate)}`);
  assert.equal(duplicate.status, "duplicate_ignored", `expected duplicate_ignored, got ${JSON.stringify(duplicate)}`);
  assert.equal(revisionAfter, revisionBefore, "duplicate metadata event must not bump revision");
  assert.deepEqual(snapshotAfter, snapshotBefore, "duplicate metadata event must not change snapshot");
  const provenance = getProvenanceView({ provenanceId: "prov-wave8-origin-001" });
  const matching = viewRecords(provenance).filter((record) => textIncludes(record, ["prov-wave8-origin-001"]));
  assert.equal(matching.length, 1, `duplicate provenance records detected: ${JSON.stringify(matching)}`);
});

scenario("action without provenance is denied", ["ActionGate", "provenance_required"], () => {
  commitReadyState();
  const decision = placeOrderAction();
  assert.ok(decisionDenied(decision), `risk-increasing action without provenance must be denied: ${JSON.stringify(decision)}`);
  assert.ok(textIncludes(decision, ["provenance"]) || textIncludes(getCoreTrustReport(), ["provenance"]), "denial must be explainable as provenance-related");
});

scenario("recovery action is not wrongly blocked", ["ActionGate", "recovery"], () => {
  const cancelDecision = cancelOrderAction({ provenanceRef: provenanceRef({ subjectId: "order-wave8-001" }) });
  const reconcileDecision = reconcilePositionAction();
  assert.equal(
    textIncludes(cancelDecision, ["provenance", "missing"]) && decisionDenied(cancelDecision),
    false,
    `cancel/recovery action must not be blocked solely by missing provenance: ${JSON.stringify(cancelDecision)}`
  );
  assert.equal(
    textIncludes(reconcileDecision, ["provenance", "missing"]) && decisionDenied(reconcileDecision),
    false,
    `reconcile/recovery action must not be blocked solely by missing provenance: ${JSON.stringify(reconcileDecision)}`
  );
});

scenario("missing provenance is not corruption", ["trust", "provenance"], () => {
  const report = getCoreTrustReport();
  const trustText = JSON.stringify(report);
  assert.equal(trustText.includes("COMPROMISED"), false, `missing/unknown provenance must not be COMPROMISED without proven mismatch: ${trustText}`);
  assert.ok(textIncludes(report, ["UNCERTAIN"]) || textIncludes(report, ["provenance"]) || textIncludes(report, ["blocking"]), `missing provenance should be visible as uncertain/blocking: ${trustText}`);
});

scenario("inconsistent provenance blocks risk", ["provenance", "ActionGate"], () => {
  commitReadyState();
  commitAccepted(inconsistentProvenanceEvent());
  const decision = placeOrderAction({ provenanceRef: provenanceRef() });
  assert.ok(decisionDenied(decision), `inconsistent provenance must block risk-increasing action: ${JSON.stringify(decision)}`);
  assert.ok(textIncludes(decision, ["provenance"]) || textIncludes(getCoreTrustReport(), ["provenance", "mismatch"]), "provenance mismatch reason must be visible");
});

scenario("provenance appears in causality trace", ["causality_trace", "provenance"], () => {
  const metadata = metadataProvenanceEvent();
  commitAccepted(metadata);
  const trace = getTrace({ eventId: metadata.eventId });
  assert.ok(findRecord(trace, ["prov-wave8-origin-001"]) || textIncludes(trace, ["provenance"]), `provenance chain missing in trace: ${JSON.stringify(trace)}`);
});

scenario("provenance appears in CoreTrustReport", ["CoreTrustReport", "provenance"], () => {
  commitAccepted(metadataProvenanceEvent());
  const report = getCoreTrustReport({ includeProvenance: true });
  assert.ok(textIncludes(report, ["provenanceStatus"]) || textIncludes(report, ["provenance"]), `CoreTrustReport must expose provenance status: ${JSON.stringify(report)}`);
});

scenario("replay preserves metadata state", ["replay", "metadata_as_events"], () => {
  commitAccepted(metadataProvenanceEvent());
  commitAccepted(marketTick("wave8-market-tick-replay-001", 65100));
  const snapshotBefore = stable(getSnapshot());
  const trustBefore = stable(getCoreTrustReport({ includeProvenance: true }));
  const verdictBefore = stable(placeOrderAction({ provenanceRef: provenanceRef() }));
  const replay = typeof engine.replayCheck === "function" ? engine.replayCheck() : engine.verifyReplay?.();
  assert.ok(textIncludes(replay, ["ok"]) || textIncludes(replay, ["passed"]) || textIncludes(replay, ["valid"]), `replay must report success: ${JSON.stringify(replay)}`);
  assert.deepEqual(stable(getSnapshot()), snapshotBefore, "replay check must not mutate snapshot");
  assert.deepEqual(stable(getCoreTrustReport({ includeProvenance: true })), trustBefore, "replay must preserve metadata/trust state");
  assert.deepEqual(stable(placeOrderAction({ provenanceRef: provenanceRef() })), verdictBefore, "replay must preserve metadata-related verdict");
});

scenario("fill/PnL provenance can be traced", ["pnl", "provenance", "trace"], () => {
  commitAccepted(metadataProvenanceEvent({
    provenanceId: "prov-wave8-fill-001",
    subjectType: "fill",
    subjectId: "fill-wave8-001",
    originEventId: "wave8-order-origin-001"
  }, "wave8-metadata-fill-001"));
  const fill = fillEvent();
  commitAccepted(fill);
  const trace = getTrace({ eventId: fill.eventId });
  assert.ok(textIncludes(trace, ["fill-wave8-001", "prov-wave8-fill-001"]) || textIncludes(getProvenanceView({ provenanceId: "prov-wave8-fill-001" }), ["fill-wave8-001"]), `fill/PnL provenance not traceable: ${JSON.stringify(trace)}`);
});

scenario("metadata does not grant permission", ["ActionGate", "metadata_as_events"], () => {
  commitAccepted(metadataProvenanceEvent());
  const decision = placeOrderAction({ provenanceRef: provenanceRef() });
  assert.ok(decisionDenied(decision), `metadata alone must not grant allow: ${JSON.stringify(decision)}`);
});

scenario("unknown provenance is not corruption", ["trust", "provenance"], () => {
  const unknown = metadataProvenanceEvent({
    provenanceId: "prov-wave8-unknown-001",
    sourceSystem: "unknown",
    evidenceHash: "unknown"
  }, "wave8-metadata-unknown-001");
  commitAccepted(unknown);
  const report = getCoreTrustReport({ includeProvenance: true });
  assert.equal(textIncludes(report, ["COMPROMISED"]), false, `unknown provenance must not be corruption: ${JSON.stringify(report)}`);
  assert.ok(textIncludes(report, ["unknown"]) || textIncludes(report, ["UNCERTAIN"]) || textIncludes(report, ["provenance"]), `unknown provenance must be observable: ${JSON.stringify(report)}`);
});

scenario("proven mismatch can compromise trust", ["trust", "integrity", "provenance"], () => {
  commitAccepted(inconsistentProvenanceEvent());
  const report = getCoreTrustReport({ includeProvenance: true });
  assert.ok(textIncludes(report, ["COMPROMISED"]) || textIncludes(report, ["mismatch", "provenance"]), `proven mismatch must compromise/block trust: ${JSON.stringify(report)}`);
  const recovery = getRecoveryPlan({ reason: "provenance_mismatch" });
  assert.ok(textIncludes(recovery, ["REPLAY"]) || textIncludes(recovery, ["REVIEW"]) || textIncludes(recovery, ["integrity"]) || textIncludes(recovery, ["provenance"]), `proven mismatch must suggest recovery: ${JSON.stringify(recovery)}`);
});

scenario("no V1 / no execution leak", ["canonical_boundary"], () => {
  assertNoForbiddenDefaultWiring();
  const journal = canonicalJournal();
  assert.equal(textIncludes(journal, ["live", "execution"]) && textIncludes(journal, ["v1"]), false, `journal must not contain V1/live execution leak: ${JSON.stringify(journal)}`);
});

const failed = results.filter((result) => !result.ok);
const summary = {
  name: "wave8_metadata_as_events_audit",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results
};

console.log(JSON.stringify(summary, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
