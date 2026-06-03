import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `mbg-core-wave5-scenario-audit-${process.pid}-${Date.now()}`);
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
  getQuarantineView?: () => unknown;
  getQuarantineRecords?: () => unknown;
  getQuarantine?: () => unknown;
  getQuarantinedEvents?: () => unknown;
  getPermissionLedgerView?: () => unknown;
  getPermissionLedger?: () => unknown;
  getPermissionsLedgerView?: () => unknown;
  getRecoveryPlan?: (input?: unknown) => unknown;
  getRecoveryPlannerView?: (input?: unknown) => unknown;
  getRecoverySuggestions?: (input?: unknown) => unknown;
  planRecovery?: (input?: unknown) => unknown;
};

const engine = runtimeEngine as RuntimeLike;
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

function event(
  eventType: string,
  payload: Record<string, unknown>,
  eventId: string,
  timestamp = isoNow(),
  source = "wave5-scenario-audit"
) {
  return {
    eventId,
    eventType,
    timestamp,
    source,
    schemaVersion: "1",
    payload
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalizeSnapshot(value: unknown): unknown {
  const snapshot = clone(value);
  return snapshot;
}

function commitResult(eventToCommit: Record<string, unknown>) {
  assert.equal(typeof engine.commitEventResult, "function", "runtimeEngine.commitEventResult(event, { log: false }) is required");
  return engine.commitEventResult!(eventToCommit, { log: false });
}

function commitOk(eventToCommit: Record<string, unknown>, message: string) {
  const result = commitResult(eventToCommit);
  assert.equal(result.ok, true, `${message}: expected accepted event, got ${JSON.stringify(result)}`);
  assert.ok(
    result.status === "accepted" || result.status === "duplicate_ignored",
    `${message}: unexpected status ${String(result.status)}`
  );
  return result;
}

function invalidMarketTick(eventId: string) {
  return event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: -1,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "wave5-scenario-audit"
  }, eventId, isoNow(), "market-data");
}

function validMarketTick(eventId: string, timestamp = isoNow()) {
  return event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65000,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "wave5-scenario-audit"
  }, eventId, timestamp, "market-data");
}

function conflictingMarketTick(eventId: string) {
  return event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: 65050,
    bid: 65049,
    ask: 65051,
    volume: 2,
    provider: "wave5-scenario-audit"
  }, eventId, isoNow(), "market-data");
}

function bootstrapEvent(eventType: string, eventId: string) {
  return event(eventType, {
    reason: eventType.replace(".", "_"),
    provider: "wave5-scenario-audit",
    source: "wave5-scenario-audit"
  }, eventId, isoNow(), "core");
}

function positionReconciled(eventId: string) {
  return event(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: 0,
    locked: 0,
    quantity: 0,
    markPrice: 65000,
    exposure: 0,
    source: "exchange",
    provider: "wave5-scenario-audit"
  }, eventId, isoNow(), "exchange");
}

function exchangeTruthFresh(eventId: string, timestamp = isoNow()) {
  return event(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    provider: "wave5-scenario-audit",
    lastAccountReconcileAt: timestamp,
    lastPositionReconcileAt: timestamp,
    lastOrderReconcileAt: timestamp,
    lastFillSyncAt: timestamp,
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }, eventId, timestamp, "exchange");
}

function healthConnected(eventId: string, timestamp = isoNow()) {
  return event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    source: "wave5-scenario-audit"
  }, eventId, timestamp, "core");
}

function healthUnknown(eventId: string) {
  return event(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "unknown",
    reason: "wave5_health_unknown",
    source: "wave5-scenario-audit"
  }, eventId, isoNow(), "core");
}

function completeBootstrap(prefix: string) {
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, `${prefix}-bootstrap-loading`), "bootstrap.loading_snapshot");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, `${prefix}-bootstrap-replaying`), "bootstrap.replaying_tail");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, `${prefix}-bootstrap-awaiting-exchange-truth`), "bootstrap.awaiting_exchange_truth");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, `${prefix}-bootstrap-reconciled`), "bootstrap.reconciled");
}

function prepareReadyState(prefix: string, marketTimestamp = isoNow()) {
  commitOk(validMarketTick(`${prefix}-market`, marketTimestamp), "market.tick.received");
  commitOk(positionReconciled(`${prefix}-position`), "position.reconciled");
  completeBootstrap(prefix);
  commitOk(exchangeTruthFresh(`${prefix}-exchange-truth`), "exchange_truth.reconcile_succeeded");
  commitOk(healthConnected(`${prefix}-health`), "system.health.changed");
}

function getCanonicalEventIds() {
  return new Set(runtimeEngine.getEvents(5000).map((entry: { eventId: string }) => entry.eventId));
}

function flattenUnknown(value: unknown): unknown[] {
  const items: unknown[] = [];
  const seen = new Set<unknown>();

  function visit(current: unknown) {
    if (current === null || current === undefined) return;
    if (typeof current !== "object") {
      items.push(current);
      return;
    }
    if (seen.has(current)) return;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }

    items.push(current);
    for (const nested of Object.values(current as Record<string, unknown>)) {
      visit(nested);
    }
  }

  visit(value);
  return items;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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
    object.rejected,
    object.quarantined,
    object.diagnostics,
    object.decisions
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return flattenUnknown(view).filter((item) => item && typeof item === "object");
}

function getQuarantineViewStrict() {
  const candidates = [
    engine.getQuarantineView,
    engine.getQuarantineRecords,
    engine.getQuarantine,
    engine.getQuarantinedEvents
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") {
      return candidate.call(engine);
    }
  }

  throw new Error("Wave 5 quarantine API is not available");
}

function getPermissionLedgerViewStrict() {
  const candidates = [
    engine.getPermissionLedgerView,
    engine.getPermissionLedger,
    engine.getPermissionsLedgerView
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") {
      return candidate.call(engine);
    }
  }

  throw new Error("Wave 5 Permission Ledger API is not available");
}

function getRecoveryPlanStrict(input?: unknown) {
  const candidates = [
    engine.getRecoveryPlan,
    engine.getRecoveryPlannerView,
    engine.getRecoverySuggestions,
    engine.planRecovery
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") {
      return candidate.call(engine, input);
    }
  }

  throw new Error("Wave 5 Recovery Planner API is not available");
}

function assertViewContains(view: unknown, fragments: string[], message: string) {
  const lower = fragments.map((fragment) => fragment.toLowerCase());
  const records = viewRecords(view);
  assert.ok(records.length > 0, `${message}: view has no records. View=${JSON.stringify(view)}`);
  assert.ok(
    records.some((record) => {
      const text = asText(record).toLowerCase();
      return lower.every((fragment) => text.includes(fragment));
    }),
    `${message}: expected fragments ${fragments.join(", ")}. View=${JSON.stringify(view)}`
  );
}

function assertSuggestion(plan: unknown, expectedCodes: string[], message: string) {
  const text = asText(plan).toUpperCase();
  assert.ok(
    expectedCodes.some((code) => text.includes(code.toUpperCase())),
    `${message}: expected one of ${expectedCodes.join(", ")}. Plan=${JSON.stringify(plan)}`
  );
}

function evaluatePlaceOrder() {
  return runtimeEngine.dispatchAction({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  }).decision;
}

function evaluateDiagnosticAction() {
  return runtimeEngine.dispatchAction({
    type: ACTION_TYPE.RECONCILE_POSITION,
    symbol: "BTCUSDT"
  }).decision;
}

scenario(
  "invalid event -> quarantine record created",
  ["Quarantine", "Event Validation"],
  () => {
    const badEvent = invalidMarketTick("wave5-invalid-quarantine-created");
    const result = commitResult(badEvent);

    assert.equal(result.ok, false, `invalid event must be rejected. Result=${JSON.stringify(result)}`);
    const quarantine = getQuarantineViewStrict();
    assertViewContains(quarantine, [badEvent.eventId, "rejected"], "invalid event must create quarantine record");
  }
);

scenario(
  "invalid event -> not in canonical journal",
  ["Quarantine", "Canonical Journal Safety"],
  () => {
    const badEvent = invalidMarketTick("wave5-invalid-not-canonical");
    const result = commitResult(badEvent);

    assert.equal(result.ok, false, `invalid event must be rejected. Result=${JSON.stringify(result)}`);
    assert.ok(!getCanonicalEventIds().has(badEvent.eventId), "invalid event must not enter canonical journal");
  }
);

scenario(
  "invalid event -> snapshot revision unchanged",
  ["Quarantine", "Snapshot Safety"],
  () => {
    const badEvent = invalidMarketTick("wave5-invalid-revision-unchanged");
    const beforeRevision = runtimeEngine.getSnapshot().revision;
    const beforeSnapshot = canonicalizeSnapshot(runtimeEngine.getSnapshot());
    const result = commitResult(badEvent);

    assert.equal(result.ok, false, `invalid event must be rejected. Result=${JSON.stringify(result)}`);
    assert.equal(runtimeEngine.getSnapshot().revision, beforeRevision, "invalid event must not bump snapshot revision");
    assert.deepEqual(canonicalizeSnapshot(runtimeEngine.getSnapshot()), beforeSnapshot, "invalid event must not mutate snapshot");
  }
);

scenario(
  "idempotency conflict -> quarantine or diagnostic record",
  ["Quarantine", "Event Idempotency"],
  () => {
    const first = validMarketTick("wave5-idempotency-conflict");
    commitOk(first, "first event before idempotency conflict");

    const beforeRevision = runtimeEngine.getSnapshot().revision;
    const beforeSnapshot = canonicalizeSnapshot(runtimeEngine.getSnapshot());
    const conflict = conflictingMarketTick("wave5-idempotency-conflict");
    const result = commitResult(conflict);

    assert.equal(result.ok, false, `idempotency conflict must not be accepted. Result=${JSON.stringify(result)}`);
    assert.equal(result.status, "duplicate_conflict", `expected duplicate_conflict. Result=${JSON.stringify(result)}`);
    assert.equal(runtimeEngine.getSnapshot().revision, beforeRevision, "idempotency conflict must not bump revision");
    assert.deepEqual(canonicalizeSnapshot(runtimeEngine.getSnapshot()), beforeSnapshot, "idempotency conflict must not mutate snapshot");
    assert.ok(!getCanonicalEventIds().has(conflict.eventId) || runtimeEngine.getEvents(5000).filter((entry: { eventId: string }) => entry.eventId === conflict.eventId).length === 1, "conflicting duplicate must not be appended as a new canonical event");

    let diagnosticSeen = asText(runtimeEngine.getIdempotencyView()).includes("duplicate_conflict");
    try {
      const quarantine = getQuarantineViewStrict();
      diagnosticSeen = diagnosticSeen || asText(quarantine).includes("duplicate_conflict") || asText(quarantine).includes(conflict.eventId);
    } catch {
      // Scenario allows quarantine OR diagnostic record.
    }

    assert.ok(diagnosticSeen, `idempotency conflict must create quarantine or diagnostic record. Result=${JSON.stringify(result)}`);
  }
);

scenario(
  "denied PLACE_ORDER -> Permission Ledger record exists",
  ["Permission Ledger", "ActionGate Verdict v2"],
  () => {
    const beforeRevision = runtimeEngine.getSnapshot().revision;
    const verdict = evaluatePlaceOrder();

    assert.equal(verdict.allowed, false, `cold-start PLACE_ORDER must be denied. Verdict=${JSON.stringify(verdict)}`);
    assert.equal(runtimeEngine.getSnapshot().revision, beforeRevision, "permission evaluation must not mutate snapshot");
    const ledger = getPermissionLedgerViewStrict();
    assertViewContains(ledger, [ACTION_TYPE.PLACE_ORDER, "deny"], "denied PLACE_ORDER must be written to Permission Ledger");
  }
);

scenario(
  "allowed diagnostic action -> Permission Ledger record exists",
  ["Permission Ledger", "ActionGate Verdict v2"],
  () => {
    const verdict = evaluateDiagnosticAction();

    assert.equal(verdict.allowed, true, `RECONCILE_POSITION diagnostic/recovery action should be allowed. Verdict=${JSON.stringify(verdict)}`);
    const ledger = getPermissionLedgerViewStrict();
    assertViewContains(ledger, [ACTION_TYPE.RECONCILE_POSITION, "allow"], "allowed diagnostic action must be written to Permission Ledger");
  }
);

scenario(
  "cold start -> Recovery Planner suggests RECONCILE_POSITION / RECONCILE_ORDERS",
  ["Recovery Planner", "Cold Start"],
  () => {
    const beforeSnapshot = canonicalizeSnapshot(runtimeEngine.getSnapshot());
    const plan = getRecoveryPlanStrict({ reason: "cold_start" });
    const afterSnapshot = canonicalizeSnapshot(runtimeEngine.getSnapshot());

    assert.deepEqual(afterSnapshot, beforeSnapshot, "Recovery Planner must not mutate snapshot");
    assertSuggestion(plan, ["RECONCILE_POSITION", ACTION_TYPE.RECONCILE_POSITION], "cold start plan must suggest position reconciliation");
    assertSuggestion(plan, ["RECONCILE_ORDERS", "RECONCILE_ORDER", ACTION_TYPE.RECONCILE_ORDER], "cold start plan must suggest order reconciliation");
  }
);

scenario(
  "market stale -> Recovery Planner suggests REFRESH_MARKET_DATA",
  ["Recovery Planner", "Freshness Guard"],
  () => {
    prepareReadyState("wave5-market-stale", isoPast(120_000));
    const plan = getRecoveryPlanStrict({ reason: "market_stale" });

    assertSuggestion(plan, ["REFRESH_MARKET_DATA", "MARKET_DATA"], "market stale plan must suggest refreshing market data");
  }
);

scenario(
  "health unknown -> Recovery Planner suggests CHECK_HEALTH",
  ["Recovery Planner", "Health Truth"],
  () => {
    commitOk(validMarketTick("wave5-health-unknown-market"), "market.tick.received");
    commitOk(positionReconciled("wave5-health-unknown-position"), "position.reconciled");
    completeBootstrap("wave5-health-unknown");
    commitOk(exchangeTruthFresh("wave5-health-unknown-exchange-truth"), "exchange_truth.reconcile_succeeded");
    commitOk(healthUnknown("wave5-health-unknown-health"), "system.health.changed");

    const plan = getRecoveryPlanStrict({ reason: "health_unknown" });

    assertSuggestion(plan, ["CHECK_HEALTH", "HEALTH"], "health unknown plan must suggest CHECK_HEALTH");
  }
);

scenario(
  "Recovery Planner does not mutate snapshot",
  ["Recovery Planner", "Snapshot Safety"],
  () => {
    commitOk(validMarketTick("wave5-planner-no-mutation-market"), "market.tick.received");
    const beforeRevision = runtimeEngine.getSnapshot().revision;
    const beforeSnapshot = canonicalizeSnapshot(runtimeEngine.getSnapshot());

    getRecoveryPlanStrict({ reason: "no_mutation_probe" });

    assert.equal(runtimeEngine.getSnapshot().revision, beforeRevision, "Recovery Planner must not bump snapshot revision");
    assert.deepEqual(canonicalizeSnapshot(runtimeEngine.getSnapshot()), beforeSnapshot, "Recovery Planner must not mutate snapshot");
  }
);

const failed = results.filter((result) => !result.ok);
const summary = {
  name: "wave5_scenario_audit",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results
};

console.log(JSON.stringify(summary, null, 2));

try {
  fs.rmSync(dataDir, { recursive: true, force: true });
} catch {
  // Best-effort cleanup only.
}

if (failed.length > 0) {
  process.exitCode = 1;
}
