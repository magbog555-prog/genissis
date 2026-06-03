import assert from "node:assert/strict";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { DomainEvent, EVENT_TYPE } from "../../core/contracts/src/events.js";
import { RuntimeSnapshot } from "../../core/state/src/types.js";

type ScenarioResult = {
  name: string;
  covers: string[];
  ok: boolean;
  detail?: string;
};

type IdempotencyDiagnosticCode = "duplicate_ignored" | "duplicate_conflict";

type CommitEventResult = {
  ok: boolean;
  eventId?: string;
  eventType?: string;
  reason?: string;
  error?: string;
  code?: string;
  status?: string;
  diagnostic?: unknown;
  idempotency?: string | {
    diagnostic?: string;
    code?: string;
    status?: string;
    reason?: string;
  };
  duplicate?: boolean;
  idempotent?: boolean;
  appended?: boolean;
  canonicalAppended?: boolean;
  snapshot?: RuntimeSnapshot;
};

type RuntimeEngineWave2 = typeof runtimeEngine & {
  commitEventResult?: (event: DomainEvent, options?: { log?: boolean }) => CommitEventResult;
  getPnlSnapshot?: () => unknown;
};

const engine = runtimeEngine as RuntimeEngineWave2;
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

function stableSnapshot(snapshot: RuntimeSnapshot) {
  return JSON.stringify(snapshot);
}

function expectNoSnapshotChange(before: RuntimeSnapshot, after: RuntimeSnapshot, message: string) {
  assert.equal(after.revision, before.revision, `${message}: revision changed ${before.revision}->${after.revision}`);
  assert.equal(stableSnapshot(after), stableSnapshot(before), `${message}: snapshot changed`);
}

function fixedEvent<TPayload>(
  eventType: string,
  payload: TPayload,
  eventId: string,
  source = "wave2-scenario-audit"
): DomainEvent<TPayload> {
  return {
    eventId,
    eventType: eventType as any,
    timestamp: new Date().toISOString(),
    source,
    eventVersion: 1,
    schemaVersion: 1,
    payload
  } as any;
}

function bootstrapEvent(eventType: string, eventId: string, extra: Record<string, unknown> = {}) {
  return fixedEvent(eventType, {
    source: "wave2-scenario-audit",
    phase: eventType.replace("bootstrap.", ""),
    ...extra
  }, eventId, "core");
}

function validMarketTick(eventId = "evt-market-valid-1", price = 65000) {
  return fixedEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price,
    bid: price - 1,
    ask: price + 1,
    volume: 1,
    provider: "wave2-scenario-audit",
    source: "market-data"
  }, eventId, "market-data");
}

function validMarketInputObservation(eventId = "evt-market-input-wave9-valid-1", sequence = 1) {
  return fixedEvent(EVENT_TYPE.MARKET_INPUT_OBSERVED, {
    observation: {
      observationId: `wave2-market-input-${sequence}`,
      sourceType: "simulated",
      sourceName: "wave2-scenario-audit",
      symbol: "BTCUSDT",
      channel: "ticker",
      sequence,
      previousSequence: sequence > 1 ? sequence - 1 : undefined,
      exchangeTimestamp: "2025-01-01T00:00:00.000Z",
      receivedTimestampFromEvent: "2025-01-01T00:00:00.000Z",
      payloadHash: `sha256:wave2-market-input-${sequence}`,
      provenanceId: `prov-wave2-market-input-${sequence}`,
      freshnessHint: { maxAgeMs: 15000, observedAgeMs: 0, stale: false },
      schemaVersion: "1"
    }
  }, eventId, "market-input");
}

function validPositionReconciled(eventId = "evt-position-reconciled-flat-1", quantity = 0) {
  return fixedEvent(EVENT_TYPE.POSITION_RECONCILED, {
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: quantity,
    locked: 0,
    quantity,
    markPrice: 65000,
    exposure: Math.abs(quantity * 65000),
    provider: "wave2-scenario-audit",
    source: "exchange"
  }, eventId, "exchange");
}

function validExchangeTruthSucceeded(eventId = "evt-exchange-truth-fresh-1") {
  return fixedEvent(EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED, {
    source: "exchange",
    provider: "wave2-scenario-audit",
    lastAccountReconcileAt: new Date().toISOString(),
    lastPositionReconcileAt: new Date().toISOString(),
    lastOrderReconcileAt: new Date().toISOString(),
    lastFillSyncAt: new Date().toISOString(),
    localPositionStatus: "flat",
    exchangePositionStatus: "flat",
    exchangePositionQuantity: 0,
    drift: {},
    conflicts: []
  }, eventId, "exchange");
}

function validSystemHealthConnected(eventId = "evt-system-health-connected-1") {
  return fixedEvent(EVENT_TYPE.SYSTEM_HEALTH_CHANGED, {
    connection: "websocket",
    status: "connected",
    source: "wave2-scenario-audit"
  }, eventId, "core");
}

function validProvenanceRecorded(eventId = "evt-provenance-valid-1") {
  return fixedEvent(EVENT_TYPE.METADATA_PROVENANCE_RECORDED, {
    provenanceId: "prov-wave2-valid-1",
    originType: "observation",
    originEventId: "evt-system-health-for-bootstrap-reconciled",
    targetId: "action:place_order",
    parentProvenanceIds: [],
    source: "wave2-scenario-audit",
    confidence: 1,
    createdAtFromEvent: "2025-01-01T00:00:00.000Z"
  }, eventId, "core");
}


function validOrderReconciled(eventId = "evt-order-reconciled-1") {
  return fixedEvent(EVENT_TYPE.ORDER_RECONCILED, {
    orderId: "order-reconcile-1",
    clientOrderId: "client-reconcile-1",
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.1,
    filledQuantity: 0,
    executedQty: 0,
    exchangeStatus: "NEW",
    provider: "wave2-scenario-audit",
    source: "exchange"
  }, eventId, "exchange");
}

function validFill(eventId = "evt-fill-1", executionId = "exec-1", fillId = "fill-1") {
  return fixedEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
    orderId: "order-1",
    clientOrderId: "client-1",
    executionId,
    fillId,
    tradeId: fillId,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.1,
    filledQuantity: 0.1,
    filledQuantityDelta: 0.1,
    fillPrice: 65000,
    price: 65000,
    exchangeStatus: "FILLED",
    commission: 0,
    commissionAsset: "USDT",
    provider: "wave2-scenario-audit",
    source: "exchange",
    reportedAt: new Date().toISOString()
  }, eventId, "exchange");
}

function eventJournal() {
  return runtimeEngine.getEvents(10000) as DomainEvent[];
}

function eventCount(eventId: string) {
  return eventJournal().filter((event) => event.eventId === eventId).length;
}

function assertEventNotAppended(eventId: string, beforeJournalLength: number, message: string) {
  const journal = eventJournal();
  assert.equal(journal.length, beforeJournalLength, `${message}: journal length changed ${beforeJournalLength}->${journal.length}`);
  assert.equal(eventCount(eventId), 0, `${message}: rejected event ${eventId} appeared in canonical journal`);
}

function assertDuplicateNotAppended(eventId: string, beforeJournalLength: number, message: string) {
  const journal = eventJournal();
  assert.equal(journal.length, beforeJournalLength, `${message}: duplicate changed canonical journal length ${beforeJournalLength}->${journal.length}`);
  assert.equal(eventCount(eventId), 1, `${message}: duplicate eventId ${eventId} must have exactly one canonical journal entry`);
}

function commitResult(event: DomainEvent, message: string) {
  assert.equal(typeof engine.commitEventResult, "function", "runtimeEngine.commitEventResult(event, { log: false }) is required after Wave 2 Roles 5/6 merge");
  return engine.commitEventResult!(event, { log: false });
}

function commitOk(event: DomainEvent, message: string) {
  const result = commitResult(event, message);
  assert.equal(result.ok, true, `${message}: expected accepted event, got ${JSON.stringify(result)}`);
  return result;
}

function diagnosticTokens(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      record.code,
      record.status,
      record.reason,
      record.diagnostic,
      record.idempotency,
      ...(typeof record.idempotency === "object" ? diagnosticTokens(record.idempotency) : [])
    ].flatMap(diagnosticTokens);
  }
  return [];
}

function resultDiagnostics(result: CommitEventResult): string[] {
  return [
    result.code,
    result.status,
    result.reason,
    result.error,
    result.diagnostic,
    result.idempotency
  ].flatMap(diagnosticTokens);
}

function assertDiagnostic(result: CommitEventResult, expected: IdempotencyDiagnosticCode, message: string) {
  const diagnostics = resultDiagnostics(result);
  assert.ok(
    diagnostics.includes(expected),
    `${message}: expected idempotency diagnostic ${expected}, got ${JSON.stringify(result)}`
  );
}

function commitInvalidRejectedNoStateChange(event: DomainEvent, message: string) {
  const before = runtimeEngine.getSnapshot();
  const beforeJournalLength = eventJournal().length;

  const result = commitResult(event, message);

  assert.equal(result.ok, false, `${message}: invalid event must return result.ok === false`);
  const after = runtimeEngine.getSnapshot();
  expectNoSnapshotChange(before, after, message);
  assertEventNotAppended(event.eventId, beforeJournalLength, message);
  return result;
}

function commitDuplicateIgnoredNoStateChange(event: DomainEvent, message: string) {
  const before = runtimeEngine.getSnapshot();
  const beforeJournalLength = eventJournal().length;

  const result = commitResult(event, message);

  assertDiagnostic(result, "duplicate_ignored", message);
  const after = runtimeEngine.getSnapshot();
  expectNoSnapshotChange(before, after, message);
  assertDuplicateNotAppended(event.eventId, beforeJournalLength, message);
  return result;
}

function commitDuplicateConflictNoStateChange(event: DomainEvent, message: string) {
  const before = runtimeEngine.getSnapshot();
  const beforeJournalLength = eventJournal().length;

  const result = commitResult(event, message);

  assertDiagnostic(result, "duplicate_conflict", message);
  assert.equal(result.ok, false, `${message}: duplicate conflict must not be accepted`);
  const after = runtimeEngine.getSnapshot();
  expectNoSnapshotChange(before, after, message);
  assertDuplicateNotAppended(event.eventId, beforeJournalLength, message);
  return result;
}

function placeOrderDecision() {
  return runtimeEngine.evaluateAction({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  });
}

function assertPlaceOrderDenied(message: string) {
  const decision = placeOrderDecision();
  assert.equal(decision.decision, "deny", `${message}: PLACE_ORDER must be denied`);
}

function assertPlaceOrderAllowedOnlyThroughGate(message: string) {
  const decision = placeOrderDecision();
  assert.equal(decision.decision, "allow", `${message}: ActionGate denied PLACE_ORDER: ${decision.reason ?? "no reason"}`);
}

function captureAccounting() {
  const snapshot = runtimeEngine.getSnapshot();
  return {
    positionQuantity: snapshot.position.quantity,
    positionExposure: snapshot.position.exposure,
    orderFilledQuantity: snapshot.order.filledQuantity ?? 0,
    pnl: typeof engine.getPnlSnapshot === "function" ? engine.getPnlSnapshot() : undefined
  };
}

function assertAccountingUnchanged(before: ReturnType<typeof captureAccounting>, after: ReturnType<typeof captureAccounting>, message: string) {
  assert.deepEqual(after, before, `${message}: duplicate fill changed position/order/PnL accounting`);
}

function completeBootstrapToAwaitingExchangeTruth() {
  commitOk(bootstrapEvent("bootstrap.loading_snapshot", "evt-bootstrap-loading-snapshot"), "bootstrap.loading_snapshot");
  commitOk(bootstrapEvent("bootstrap.replaying_tail", "evt-bootstrap-replaying-tail"), "bootstrap.replaying_tail");
  commitOk(bootstrapEvent("bootstrap.awaiting_exchange_truth", "evt-bootstrap-awaiting-exchange-truth"), "bootstrap.awaiting_exchange_truth");
}

function completeBootstrapReconciled() {
  completeBootstrapToAwaitingExchangeTruth();
  commitOk(validMarketTick("evt-market-for-bootstrap-reconciled"), "valid market tick before bootstrap.reconciled");
  commitOk(validPositionReconciled("evt-position-for-bootstrap-reconciled"), "valid position reconcile before bootstrap.reconciled");
  commitOk(bootstrapEvent("bootstrap.reconciled", "evt-bootstrap-reconciled", { status: "reconciled" }), "bootstrap.reconciled");
  commitOk(validExchangeTruthSucceeded("evt-exchange-truth-for-bootstrap-reconciled"), "exchange truth before final allow");
  commitOk(validSystemHealthConnected("evt-system-health-for-bootstrap-reconciled"), "health truth before final allow");
  commitOk(validProvenanceRecorded("evt-provenance-for-bootstrap-reconciled"), "provenance before final allow");
  commitOk(validMarketInputObservation("evt-market-input-for-bootstrap-reconciled"), "market input before final allow");
}

scenario(
  "bootstrap not reconciled -> PLACE_ORDER denied",
  ["Bootstrap FSM", "Combined safety", "ActionGate"],
  () => {
    const snapshot = runtimeEngine.getSnapshot();
    assert.equal(snapshot.position.status, "unknown");
    assert.equal(snapshot.risk.status, "blocked");
    assertPlaceOrderDenied("cold start");
  }
);

scenario(
  "failed bootstrap cannot transition to reconciled directly",
  ["Bootstrap FSM", "Combined safety", "ActionGate"],
  () => {
    commitOk(bootstrapEvent("bootstrap.loading_snapshot", "evt-bootstrap-failed-loading"), "bootstrap.loading_snapshot before failure");
    commitOk(bootstrapEvent("bootstrap.failed", "evt-bootstrap-failed", { reason: "scenario_bootstrap_failure" }), "bootstrap.failed");

    commitInvalidRejectedNoStateChange(
      bootstrapEvent("bootstrap.reconciled", "evt-bootstrap-reconciled-after-failure", { status: "reconciled" }),
      "bootstrap.reconciled directly after bootstrap.failed"
    );

    assertPlaceOrderDenied("failed bootstrap");
  }
);

scenario(
  "invalid market tick rejected and no state change",
  ["Event Validation", "Combined safety"],
  () => {
    const invalidMarketTick = fixedEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
      symbol: "",
      price: -1,
      bid: -1,
      ask: 0,
      provider: "wave2-invalid",
      source: "market-data"
    }, "evt-invalid-market-tick-1", "market-data");

    commitInvalidRejectedNoStateChange(invalidMarketTick, "invalid market tick");
  }
);

scenario(
  "duplicate market event is ignored without revision bump or canonical append",
  ["Event Idempotency", "Scenario Audit"],
  () => {
    const event = validMarketTick("evt-duplicate-market-1");
    commitOk(event, "first market tick");

    commitDuplicateIgnoredNoStateChange(event, "duplicate market event");
  }
);

scenario(
  "duplicate eventId conflict is rejected without state or journal mutation",
  ["Event Idempotency", "Scenario Audit"],
  () => {
    const first = validMarketTick("evt-duplicate-conflict-1", 65000);
    const conflict = validMarketTick("evt-duplicate-conflict-1", 66000);
    commitOk(first, "first market tick before duplicate conflict");

    commitDuplicateConflictNoStateChange(conflict, "duplicate market eventId conflict");
  }
);

scenario(
  "duplicate fill is ignored and does not double PnL",
  ["Event Idempotency", "Combined safety"],
  () => {
    commitOk(validMarketTick("evt-market-before-fill"), "market before fill");
    commitOk(validPositionReconciled("evt-position-before-fill"), "position before fill");

    const fill = validFill("evt-duplicate-fill-1", "exec-duplicate-fill-1", "fill-duplicate-fill-1");
    commitOk(fill, "first fill");
    const afterFirstFill = captureAccounting();

    commitDuplicateIgnoredNoStateChange(fill, "duplicate fill event");

    const afterDuplicateFill = captureAccounting();
    assertAccountingUnchanged(afterFirstFill, afterDuplicateFill, "duplicate fill");
  }
);

scenario(
  "duplicate reconcile is ignored without state or journal mutation",
  ["Event Idempotency", "Bootstrap FSM", "Combined safety"],
  () => {
    const reconcile = validPositionReconciled("evt-duplicate-position-reconcile-1");
    commitOk(validMarketTick("evt-market-before-duplicate-reconcile"), "market before duplicate reconcile");
    commitOk(reconcile, "first position reconcile");

    commitDuplicateIgnoredNoStateChange(reconcile, "duplicate position reconcile");
  }
);

scenario(
  "market tick alone does not allow trading",
  ["Bootstrap FSM", "Combined safety", "ActionGate"],
  () => {
    commitOk(validMarketTick("evt-market-alone"), "market tick alone");
    const snapshot = runtimeEngine.getSnapshot();
    assert.equal(snapshot.market.status, "open");
    assert.equal(snapshot.position.status, "unknown");
    assert.equal(snapshot.risk.status, "blocked");
    assertPlaceOrderDenied("market tick alone");
  }
);

scenario(
  "position reconciled but bootstrap not reconciled -> still denied",
  ["Bootstrap FSM", "Combined safety", "ActionGate"],
  () => {
    completeBootstrapToAwaitingExchangeTruth();
    commitOk(validMarketTick("evt-market-before-position-only"), "market before position-only scenario");
    commitOk(validPositionReconciled("evt-position-only-no-bootstrap"), "position reconciled without bootstrap.reconciled");

    const snapshot = runtimeEngine.getSnapshot();
    assert.equal(snapshot.market.status, "open");
    assert.equal(snapshot.position.status, "flat");

    assertPlaceOrderDenied("position reconciled but bootstrap not reconciled");
  }
);

scenario(
  "bootstrap reconciled + valid state -> allow only if ActionGate allows",
  ["Bootstrap FSM", "Combined safety", "ActionGate"],
  () => {
    completeBootstrapReconciled();
    assertPlaceOrderAllowedOnlyThroughGate("bootstrap reconciled + valid state");
  }
);

const failed = results.filter((result) => !result.ok);

console.log(JSON.stringify({
  name: "wave2_scenario_audit",
  target: "mbg-core-v0.1-alpha2 after Roles 4/5/6 merge",
  ok: failed.length === 0,
  summary: {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length
  },
  results
}, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
