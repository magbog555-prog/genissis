import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `mbg-core-wave9-market-input-integrity-audit-${process.pid}`);
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
  reason?: string;
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
  replayCheck?: (input?: unknown) => unknown;
  verifyReplay?: (input?: unknown) => unknown;
  getCausalityTrace?: (input?: unknown) => unknown;
  getCausalityTraceView?: (input?: unknown) => unknown;
  getCausalityView?: (input?: unknown) => unknown;
  getTrace?: (input?: unknown) => unknown;
  getQuarantineView?: (limit?: number) => unknown;
  getQuarantineRecords?: (limit?: number) => unknown;
  getQuarantine?: (limit?: number) => unknown;
  getQuarantinedEvents?: (limit?: number) => unknown;
  getRecoveryPlan?: (input?: unknown) => unknown;
  getRecoveryPlannerView?: (input?: unknown) => unknown;
  getRecoverySuggestions?: (input?: unknown) => unknown;
  planRecovery?: (input?: unknown) => unknown;
  getMarketInputIntegrityView?: (input?: unknown) => unknown;
  getMarketInputView?: (input?: unknown) => unknown;
  getMarketInputStatus?: (input?: unknown) => unknown;
  getMarketObservationView?: (input?: unknown) => unknown;
  getMarketObservations?: (input?: unknown) => unknown;
  getMarketDataIntegrityView?: (input?: unknown) => unknown;
  verifyMarketInputIntegrity?: (input?: unknown) => unknown;
};

const engine = runtimeEngine as RuntimeLike;
const results: ScenarioResult[] = [];
const FIXED_TIMESTAMP = "2025-01-01T00:00:00.000Z";
const STALE_TIMESTAMP = "2024-12-31T23:00:00.000Z";
let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `wave9-${prefix}-${String(sequence).padStart(4, "0")}`;
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

function eventType(name: string, fallback: string) {
  return (EVENT_TYPE as Record<string, string>)[name] ?? fallback;
}

function marketInputEventType() {
  return eventType("MARKET_INPUT_OBSERVATION_RECEIVED", "market_input.observation_received");
}

function sequenceGapEventType() {
  return eventType("MARKET_INPUT_SEQUENCE_GAP_DETECTED", "market_input.sequence_gap_detected");
}

function checksumMismatchEventType() {
  return eventType("MARKET_INPUT_CHECKSUM_MISMATCH_DETECTED", "market_input.checksum_mismatch_detected");
}

function unknownMarketInputEventType() {
  return eventType("MARKET_INPUT_UNKNOWN_OBSERVED", "market_input.unknown_observed");
}

function event(
  type: string,
  payload: Record<string, unknown>,
  eventId = nextId(type.replace(/[^a-z0-9]+/gi, "-")),
  source = "wave9-market-input-audit"
) {
  return {
    eventId,
    eventType: type,
    timestamp: FIXED_TIMESTAMP,
    source,
    schemaVersion: "1",
    payload
  };
}

function sha256(value: unknown) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function provenanceRef(overrides: Record<string, unknown> = {}) {
  return {
    provenanceId: "prov-wave9-market-origin-001",
    originType: "observation",
    originEventId: "origin-wave9-market-001",
    targetId: "market-observation-wave9-001",
    parentProvenanceIds: [],
    source: "wave9-market-input-audit",
    confidence: 1,
    createdAtFromEvent: FIXED_TIMESTAMP,
    ...overrides
  };
}

function observationCore(overrides: Record<string, unknown> = {}) {
  const provenance = provenanceRef();
  const core = {
    observationId: "market-observation-wave9-001",
    sourceType: "simulated",
    sourceName: "wave9-market-input-audit",
    symbol: "BTCUSDT",
    channel: "ticker",
    sequence: 1,
    previousSequence: 0,
    bid: 65000,
    ask: 65001,
    mid: 65000.5,
    price: 65000.5,
    volume: 1,
    exchangeTimestamp: FIXED_TIMESTAMP,
    receivedTimestampFromEvent: FIXED_TIMESTAMP,
    provenanceId: provenance.provenanceId,
    provenanceRef: provenance,
    schemaVersion: "1",
    freshnessHint: {
      maxAgeMs: 15000,
      observedAgeMs: 0,
      stale: false
    },
    ...overrides
  } as Record<string, unknown>;
  if (core.sourceSequence !== undefined && core.sequence === undefined) core.sequence = core.sourceSequence;
  if (core.observedAt !== undefined && core.exchangeTimestamp === undefined) core.exchangeTimestamp = core.observedAt;
  if (core.sourceTimestamp !== undefined) core.exchangeTimestamp = core.sourceTimestamp;
  if (core.receivedAtFromEvent !== undefined) core.receivedTimestampFromEvent = core.receivedAtFromEvent;
  const prov = core.provenanceRef as Record<string, unknown> | undefined;
  if (prov?.provenanceId && core.provenanceId === undefined) core.provenanceId = prov.provenanceId;
  return core;
}

function marketInputPayload(overrides: Record<string, unknown> = {}) {
  const core = observationCore(overrides);
  const payloadHash = sha256(core);
  return {
    ...core,
    payloadHash,
    checksum: payloadHash
  };
}

function validMarketInput(eventId = "wave9-market-input-valid-001", overrides: Record<string, unknown> = {}) {
  return event(marketInputEventType(), marketInputPayload(overrides), eventId, "market-input");
}

function invalidMarketInput(eventId = "wave9-market-input-invalid-001") {
  return event(marketInputEventType(), marketInputPayload({
    observationId: "market-observation-wave9-invalid-001",
    price: -1,
    bid: -2,
    ask: -1,
    provenanceRef: provenanceRef({ targetId: "market-observation-wave9-invalid-001" })
  }), eventId, "market-input");
}

function staleMarketInput(eventId = "wave9-market-input-stale-001") {
  return validMarketInput(eventId, {
    observationId: "market-observation-wave9-stale-001",
    exchangeTimestamp: STALE_TIMESTAMP,
    receivedTimestampFromEvent: FIXED_TIMESTAMP,
    freshnessHint: {
      maxAgeMs: 15000,
      observedAgeMs: 3600000,
      stale: true,
      reason: "stale fixture"
    },
    sequence: 2,
    sourceSequence: 2,
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave9-market-stale-001",
      targetId: "market-observation-wave9-stale-001",
      originEventId: "origin-wave9-market-stale-001"
    })
  });
}

function missingProvenanceInput(eventId = "wave9-market-input-missing-provenance-001") {
  const payload = marketInputPayload({
    observationId: "market-observation-wave9-missing-provenance-001",
    sequence: 3,
    sourceSequence: 3
  }) as Record<string, unknown>;
  delete payload.provenanceRef;
  payload.payloadHash = sha256({ ...payload, payloadHash: undefined, checksum: undefined });
  payload.checksum = payload.payloadHash;
  return event(marketInputEventType(), payload, eventId, "market-input");
}

function missingPayloadHashInput(eventId = "wave9-market-input-missing-hash-001") {
  const payload = marketInputPayload({
    observationId: "market-observation-wave9-missing-hash-001",
    sequence: 4,
    sourceSequence: 4,
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave9-missing-hash-001",
      targetId: "market-observation-wave9-missing-hash-001",
      originEventId: "origin-wave9-missing-hash-001"
    })
  }) as Record<string, unknown>;
  delete payload.payloadHash;
  return event(marketInputEventType(), payload, eventId, "market-input");
}

function checksumMismatchInput(eventId = "wave9-market-input-checksum-mismatch-001") {
  const payload = marketInputPayload({
    observationId: "market-observation-wave9-checksum-mismatch-001",
    sequence: 5,
    sourceSequence: 5,
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave9-checksum-mismatch-001",
      targetId: "market-observation-wave9-checksum-mismatch-001",
      originEventId: "origin-wave9-checksum-mismatch-001"
    })
  }) as Record<string, unknown>;
  payload.checksum = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  return event(marketInputEventType(), payload, eventId, "market-input");
}

function sequenceGapEvent() {
  return event(sequenceGapEventType(), {
    symbol: "BTCUSDT",
    provider: "wave9-market-input-audit",
    source: "wave9-market-input-audit",
    previousSequence: 1,
    observedSequence: 3,
    gap: 1,
    reason: "market_input_sequence_gap",
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave9-sequence-gap-001",
      targetId: "market-sequence-gap-wave9-001",
      originEventId: "origin-wave9-sequence-gap-001"
    })
  }, "wave9-market-sequence-gap-001", "market-input");
}

function checksumMismatchDetectedEvent() {
  return event(checksumMismatchEventType(), {
    symbol: "BTCUSDT",
    observationId: "market-observation-wave9-checksum-mismatch-001",
    expectedHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    actualHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    reason: "market_input_checksum_mismatch",
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave9-proven-mismatch-001",
      targetId: "market-observation-wave9-checksum-mismatch-001",
      originEventId: "origin-wave9-proven-mismatch-001"
    })
  }, "wave9-market-checksum-mismatch-detected-001", "market-input");
}

function unknownMarketInputEvent() {
  return event(unknownMarketInputEventType(), {
    symbol: "BTCUSDT",
    status: "unknown",
    reason: "unknown_market_input_source",
    provider: "unknown",
    source: "wave9-market-input-audit",
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave9-unknown-input-001",
      targetId: "market-observation-wave9-unknown-001",
      originEventId: "origin-wave9-unknown-input-001",
      confidence: 0
    })
  }, "wave9-market-input-unknown-001", "market-input");
}

function bootstrapReconciled(eventId = "wave9-bootstrap-reconciled-001") {
  return event(EVENT_TYPE.BOOTSTRAP_RECONCILED, {
    reason: "wave9_bootstrap_reconciled",
    provider: "wave9-market-input-audit",
    source: "wave9-market-input-audit"
  }, eventId, "core");
}

function positionFlat(eventId = "wave9-position-flat-001") {
  return event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    quantity: 0,
    exposure: 0,
    status: "flat",
    source: "wave9-market-input-audit",
    provider: "wave9-market-input-audit"
  }, eventId, "exchange");
}

function exchangeTruthFresh(eventId = "wave9-exchange-truth-fresh-001") {
  return event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    reason: "wave9_exchange_truth_fresh",
    source: "wave9-market-input-audit",
    provider: "wave9-market-input-audit",
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

function healthHealthy(eventId = "wave9-health-healthy-001") {
  return event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    wsConnected: true,
    status: "healthy",
    observedAt: FIXED_TIMESTAMP,
    source: "wave9-market-input-audit",
    provider: "wave9-market-input-audit"
  }, eventId, "system");
}

function metadataProvenance(eventId = "wave9-action-provenance-001") {
  const provenance = provenanceRef({
    provenanceId: "prov-wave9-action-001",
    originType: "action",
    originEventId: "origin-wave9-action-001",
    targetId: "action-wave9-place-order-001"
  });
  return event(EVENT_TYPE.METADATA_PROVENANCE_ATTACHED, {
    provenanceRef: provenance,
    target: {
      type: "action",
      id: "action-wave9-place-order-001"
    },
    deterministic: true,
    provider: "wave9-market-input-audit",
    source: "wave9-market-input-audit"
  }, eventId, "metadata");
}

function stable(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, val) => {
    if (["timestamp", "observedAt", "sourceTimestamp", "receivedAtFromEvent", "generatedAt", "committedAt", "checkedAt", "createdAt", "updatedAt", "detectedAt", "decidedAt", "evaluatedAt", "asOf"].includes(key)) {
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
    object.observations,
    object.marketInputs,
    object.marketObservations,
    object.trace,
    object.traces,
    object.quarantine,
    object.journal,
    object.decisions
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return flatten(view).filter((item) => item && typeof item === "object");
}

function findRecord(view: unknown, fragments: string[]) {
  return viewRecords(view).find((record) => textIncludes(record, fragments));
}

function getSnapshot() {
  assert.equal(typeof engine.getSnapshot, "function", "runtimeEngine.getSnapshot() is required");
  return engine.getSnapshot!();
}

function getRevision() {
  const snapshot = getSnapshot() as unknown as Record<string, unknown>;
  assert.equal(typeof snapshot.revision, "number", "snapshot.revision must be available");
  return snapshot.revision as number;
}

function getCoreTrustReport(input?: unknown) {
  assert.equal(typeof engine.getCoreTrustReport, "function", "runtimeEngine.getCoreTrustReport() is required");
  return engine.getCoreTrustReport!(input);
}

function getMarketInputView(input?: unknown) {
  const candidates = [
    engine.getMarketInputIntegrityView,
    engine.getMarketInputView,
    engine.getMarketInputStatus,
    engine.getMarketObservationView,
    engine.getMarketObservations,
    engine.getMarketDataIntegrityView,
    engine.verifyMarketInputIntegrity
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, input);
  }
  const report = getCoreTrustReport({ includeMarketInput: true });
  if (textIncludes(report, ["market"])) return report;
  throw new Error("Wave 9 market input integrity view API is not available");
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

function replayCheck() {
  const candidates = [
    engine.replayCheck,
    engine.verifyReplay
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, { includeMarketInput: true });
  }
  throw new Error("Replay verification API is not available");
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

function commitRejectedOrQuarantined(eventToCommit: Record<string, unknown>) {
  const result = commit(eventToCommit);
  const status = String(result.status ?? "");
  assert.ok(
    result.ok === false || ["rejected", "quarantined", "invalid", "duplicate_conflict"].includes(status),
    `expected event rejected/quarantined before mutation: ${JSON.stringify(result)}`
  );
  return result;
}

function evaluateAction(type: string, extra: Record<string, unknown> = {}) {
  const request = {
    type,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000,
    requestedBy: "wave9-market-input-audit",
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave9-action-request-001",
      originType: "action",
      originEventId: "origin-wave9-action-request-001",
      targetId: "action-wave9-place-order-001"
    }),
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
    orderId: "order-wave9-001",
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

function trustState(report: unknown) {
  const object = report && typeof report === "object" ? report as Record<string, unknown> : {};
  return String(object.trustState ?? object.state ?? object.status ?? "");
}

function commitReadyWithoutMarket() {
  commitAccepted(event(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, { reason: "wave9_bootstrap_loading", source: "wave9-market-input-audit" }, "wave9-bootstrap-loading-001", "core"));
  commitAccepted(event(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, { reason: "wave9_bootstrap_replaying", source: "wave9-market-input-audit" }, "wave9-bootstrap-replaying-001", "core"));
  commitAccepted(event(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, { reason: "wave9_bootstrap_awaiting_exchange_truth", source: "wave9-market-input-audit" }, "wave9-bootstrap-awaiting-exchange-truth-001", "core"));
  commitAccepted(bootstrapReconciled());
  commitAccepted(exchangeTruthFresh());
  commitAccepted(positionFlat());
  commitAccepted(healthHealthy());
  commitAccepted(metadataProvenance());
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
  const forbidden = [
    "v1",
    "genesis-v1",
    "live:trade",
    "live-trading",
    "execution:live",
    "exchange:websocket",
    "websocket:live",
    "place:order:live",
    "ui:start",
    "next dev",
    "vite --host"
  ];
  for (const token of forbidden) {
    assert.equal(scripts.includes(token), false, `forbidden script/default detected: ${token}`);
    assert.equal(deps.includes(token), false, `forbidden dependency/default detected: ${token}`);
  }
}

scenario("valid market input accepted after validation", ["market_input_validation", "provenance"], () => {
  const input = validMarketInput();
  commitAccepted(input);
  const view = getMarketInputView({ observationId: "market-observation-wave9-001" });
  assert.ok(findRecord(view, ["market-observation-wave9-001", "payloadHash"]) || textIncludes(view, ["market", "valid"]), `valid market input not visible as accepted/validated: ${JSON.stringify(view)}`);
});

scenario("invalid market input rejected before mutation", ["market_input_validation", "no_state_mutation"], () => {
  const beforeSnapshot = stable(getSnapshot());
  const beforeRevision = getRevision();
  const result = commitRejectedOrQuarantined(invalidMarketInput());
  const afterSnapshot = stable(getSnapshot());
  const afterRevision = getRevision();

  assert.equal(afterRevision, beforeRevision, `invalid market input must not bump revision: ${JSON.stringify(result)}`);
  assert.deepEqual(afterSnapshot, beforeSnapshot, "invalid market input must not mutate snapshot");
  const quarantine = getQuarantineView();
  assert.ok(findRecord(quarantine, ["wave9-market-input-invalid-001"]) || textIncludes(result, ["quarantine", "invalid"]), `invalid market input not quarantined/diagnosed: ${JSON.stringify({ result, quarantine })}`);
});

scenario("duplicate market input is idempotent", ["idempotency", "market_input"], () => {
  const input = validMarketInput();
  commitAccepted(input);
  const duplicate = commit(input);
  assert.equal(duplicate.ok, true, `duplicate market input should be idempotent, got ${JSON.stringify(duplicate)}`);
  assert.equal(duplicate.status, "duplicate_ignored", `expected duplicate_ignored, got ${JSON.stringify(duplicate)}`);
  const view = getMarketInputView({ observationId: "market-observation-wave9-001" });
  const matches = viewRecords(view).filter((record) => textIncludes(record, ["market-observation-wave9-001"]));
  assert.ok(matches.length <= 1, `duplicate market observation records detected: ${JSON.stringify(matches)}`);
});

scenario("duplicate market input does not bump revision", ["idempotency", "revision_law"], () => {
  const input = validMarketInput();
  commitAccepted(input);
  const revisionBefore = getRevision();
  const snapshotBefore = stable(getSnapshot());
  const duplicate = commit(input);
  const revisionAfter = getRevision();
  const snapshotAfter = stable(getSnapshot());

  assert.equal(duplicate.status, "duplicate_ignored", `expected duplicate_ignored: ${JSON.stringify(duplicate)}`);
  assert.equal(revisionAfter, revisionBefore, "duplicate market input must not bump revision");
  assert.deepEqual(snapshotAfter, snapshotBefore, "duplicate market input must not change snapshot");
});

scenario("sequence gap detected", ["sequence_integrity", "gap_detection"], () => {
  commitAccepted(validMarketInput("wave9-market-input-seq-1", { observationId: "market-observation-wave9-seq-1", sequence: 1, sourceSequence: 1 }));
  const gapResult = commit(sequenceGapEvent());
  const view = getMarketInputView({ symbol: "BTCUSDT" });
  assert.ok(
    textIncludes(gapResult, ["gap"]) || textIncludes(view, ["gap", "sequence"]),
    `sequence gap must be detected: ${JSON.stringify({ gapResult, view })}`
  );
});

scenario("gap blocks risk-increasing action", ["ActionGate", "sequence_integrity"], () => {
  commitReadyWithoutMarket();
  commitAccepted(validMarketInput("wave9-market-input-gap-ready-1", { observationId: "market-observation-wave9-gap-ready-1", sequence: 1, sourceSequence: 1 }));
  commit(sequenceGapEvent());
  const decision = placeOrderAction();
  assert.ok(decisionDenied(decision), `risk-increasing action must be denied after sequence gap: ${JSON.stringify(decision)}`);
  assert.ok(textIncludes(decision, ["gap"]) || textIncludes(decision, ["sequence"]) || textIncludes(getCoreTrustReport(), ["gap", "market"]), "denial must reference market sequence/gap integrity");
});

scenario("stale input detected from event-provided timestamps", ["freshness", "deterministic_time"], () => {
  const result = commit(staleMarketInput());
  const view = getMarketInputView({ observationId: "market-observation-wave9-stale-001" });
  assert.ok(
    textIncludes(result, ["stale"]) || textIncludes(view, ["stale"]) || textIncludes(getCoreTrustReport(), ["market", "stale"]),
    `stale market input must be detected from event-provided timestamps: ${JSON.stringify({ result, view })}`
  );
});

scenario("stale input blocks risk-increasing action", ["ActionGate", "freshness"], () => {
  commitReadyWithoutMarket();
  commit(staleMarketInput());
  const decision = placeOrderAction();
  assert.ok(decisionDenied(decision), `risk-increasing action must be denied with stale market input: ${JSON.stringify(decision)}`);
  assert.ok(textIncludes(decision, ["stale"]) || textIncludes(getCoreTrustReport(), ["market", "stale"]), "denial must reference stale market input");
});

scenario("missing provenance rejected or blocks risk", ["provenance", "ActionGate"], () => {
  commitReadyWithoutMarket();
  const result = commit(missingProvenanceInput());
  const decision = placeOrderAction();
  assert.ok(
    result.ok === false || decisionDenied(decision) || textIncludes(getCoreTrustReport(), ["provenance", "market"]),
    `missing market provenance must reject input or block risk: ${JSON.stringify({ result, decision, report: getCoreTrustReport() })}`
  );
  assert.equal(trustState(getCoreTrustReport()).includes("COMPROMISED"), false, "missing provenance alone must not be corruption");
});

scenario("market input without payloadHash rejected", ["payload_hash", "validation"], () => {
  const beforeRevision = getRevision();
  const result = commitRejectedOrQuarantined(missingPayloadHashInput());
  const afterRevision = getRevision();
  assert.equal(afterRevision, beforeRevision, `missing payloadHash must not bump revision: ${JSON.stringify(result)}`);
  assert.ok(textIncludes(result, ["payload"]) || textIncludes(getQuarantineView(), ["payload", "hash"]), "missing payloadHash must be diagnosed/quarantined");
});

scenario("checksum mismatch blocks trust", ["checksum", "trust"], () => {
  const result = commit(checksumMismatchInput());
  if (result.ok === true && result.status === "accepted") {
    commit(checksumMismatchDetectedEvent());
  }
  const report = getCoreTrustReport();
  const decision = placeOrderAction();
  assert.ok(
    trustState(report) !== "TRUSTED" || decisionDenied(decision),
    `checksum mismatch must block trust/risk: ${JSON.stringify({ report, decision })}`
  );
  assert.ok(textIncludes(report, ["checksum"]) || textIncludes(report, ["mismatch"]) || textIncludes(decision, ["checksum"]) || textIncludes(decision, ["mismatch"]), "checksum mismatch blocking reason must be visible");
});

scenario("unknown market input != corruption", ["trust", "unknown_not_corruption"], () => {
  commit(unknownMarketInputEvent());
  const report = getCoreTrustReport();
  assert.equal(trustState(report).includes("COMPROMISED"), false, `unknown market input must not be corruption by default: ${JSON.stringify(report)}`);
});

scenario("valid market input alone does not grant permission", ["ActionGate", "market_input_not_permission"], () => {
  commitAccepted(validMarketInput());
  const decision = placeOrderAction();
  assert.ok(decisionDenied(decision), `valid market input alone must not allow trading: ${JSON.stringify(decision)}`);
});

scenario("recovery/cancel/reduce-only remain available", ["recovery", "ActionGate"], () => {
  commit(staleMarketInput());
  const cancelDecision = cancelOrderAction();
  const reconcileDecision = reconcilePositionAction();
  assert.equal(
    textIncludes(cancelDecision, ["market", "stale"]) && decisionDenied(cancelDecision),
    false,
    `cancel/recovery action must not be blocked solely by stale market input: ${JSON.stringify(cancelDecision)}`
  );
  assert.equal(
    textIncludes(reconcileDecision, ["market", "stale"]) && decisionDenied(reconcileDecision),
    false,
    `reconcile/recovery action must not be blocked solely by stale market input: ${JSON.stringify(reconcileDecision)}`
  );
});

scenario("market input visible in CausalityTrace", ["causality_trace", "observability"], () => {
  commitAccepted(validMarketInput());
  const trace = getTrace({ eventId: "wave9-market-input-valid-001" });
  assert.ok(textIncludes(trace, ["market-observation-wave9-001"]) || textIncludes(trace, ["payloadHash"]) || textIncludes(trace, ["prov-wave9-market-origin-001"]), `market input not visible in trace: ${JSON.stringify(trace)}`);
});

scenario("marketInputStatus visible in CoreTrustReport", ["CoreTrustReport", "market_input_status"], () => {
  commitAccepted(validMarketInput());
  const report = getCoreTrustReport({ includeMarketInput: true });
  assert.ok(
    textIncludes(report, ["marketInputStatus"]) || textIncludes(report, ["market", "input"]) || textIncludes(report, ["market", "integrity"]),
    `CoreTrustReport must expose marketInputStatus/market input integrity: ${JSON.stringify(report)}`
  );
});

scenario("replay preserves market input state", ["replay", "determinism"], () => {
  commitAccepted(validMarketInput("wave9-market-input-replay-001", { observationId: "market-observation-wave9-replay-001", sequence: 1, sourceSequence: 1 }));
  commitAccepted(validMarketInput("wave9-market-input-replay-002", {
    observationId: "market-observation-wave9-replay-002",
    sequence: 2,
    sourceSequence: 2,
    price: 65010.5,
    bid: 65010,
    ask: 65011,
    mid: 65010.5,
    provenanceRef: provenanceRef({
      provenanceId: "prov-wave9-market-replay-002",
      targetId: "market-observation-wave9-replay-002",
      originEventId: "origin-wave9-market-replay-002"
    })
  }));
  const beforeMarket = stable(getMarketInputView({ symbol: "BTCUSDT" }));
  const beforeReport = stable(getCoreTrustReport({ includeMarketInput: true }));
  const replay1 = stable(replayCheck());
  const replay2 = stable(replayCheck());
  const afterMarket = stable(getMarketInputView({ symbol: "BTCUSDT" }));
  const afterReport = stable(getCoreTrustReport({ includeMarketInput: true }));

  assert.deepEqual(afterMarket, beforeMarket, "replay verification must not mutate market input state");
  assert.deepEqual(afterReport, beforeReport, "replay verification must not mutate trust report");
  assert.deepEqual(replay2, replay1, `replay verification must be deterministic: ${JSON.stringify({ replay1, replay2 })}`);
  assert.ok(textIncludes(replay1, ["ok"]) || textIncludes(replay1, ["passed"]) || textIncludes(replay1, ["valid"]), `replay must report success/validity: ${JSON.stringify(replay1)}`);
});

scenario("no V1 / no websocket / no execution leak", ["scope_guard", "no_live"], () => {
  assertNoForbiddenDefaultWiring();
  const journal = canonicalJournal();
  assert.equal(textIncludes(journal, ["v1", "live"]), false, "canonical journal must not contain V1/live default events from Wave 9 audit");
});

const failed = results.filter((result) => !result.ok);
const summary = {
  name: "wave9_market_input_integrity_audit",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results
};

console.log(JSON.stringify(summary, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
