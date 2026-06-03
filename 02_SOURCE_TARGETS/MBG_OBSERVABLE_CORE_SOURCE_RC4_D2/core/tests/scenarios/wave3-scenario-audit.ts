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

type CommitEventResult = {
  ok: boolean;
  status?: string;
  eventId?: string;
  eventType?: string;
  reason?: string;
  error?: string;
  diagnostic?: unknown;
  snapshot?: RuntimeSnapshot;
  snapshotRevision?: number;
};

type RuntimeEngineWave3 = typeof runtimeEngine & {
  commitEventResult?: (event: DomainEvent, options?: { log?: boolean }) => CommitEventResult;
  getHealthSnapshot?: () => Record<string, unknown>;
};

const engine = runtimeEngine as RuntimeEngineWave3;
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

function stableSnapshot(snapshot: RuntimeSnapshot) {
  return JSON.stringify(snapshot);
}

function fixedEvent<TPayload>(
  eventType: string,
  payload: TPayload,
  eventId: string,
  source = "wave3-scenario-audit",
  timestamp = isoNow()
): DomainEvent<TPayload> {
  return {
    eventId,
    eventType: eventType as any,
    timestamp,
    source,
    schemaVersion: 1,
    payload
  } as any;
}

function bootstrapEvent(eventType: string, eventId: string, extra: Record<string, unknown> = {}) {
  return fixedEvent(eventType, {
    source: "wave3-scenario-audit",
    provider: "wave3-scenario-audit",
    reason: eventType.replace("bootstrap.", "wave3_"),
    ...extra
  }, eventId, "core");
}

function validProvenanceRecorded(eventId: string, timestamp = isoNow()) {
  return fixedEvent(EVENT_TYPE.METADATA_PROVENANCE_RECORDED, {
    provenanceId: `${eventId}:provenance`,
    originType: "observation",
    originEventId: eventId,
    targetId: "action:place_order",
    parentProvenanceIds: [],
    source: "wave3-scenario-audit",
    confidence: 1,
    createdAtFromEvent: timestamp
  }, eventId, "core", timestamp);
}

function validMarketTick(eventId: string, price = 65000, timestamp = isoNow(), extra: Record<string, unknown> = {}) {
  return fixedEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price,
    bid: price - 1,
    ask: price + 1,
    volume: 1,
    provider: "wave3-scenario-audit",
    source: "market-data",
    receivedAt: timestamp,
    asOf: timestamp,
    ...extra
  }, eventId, "market-data", timestamp);
}

function validMarketInputObservation(eventId: string, timestamp = isoNow(), sequence = 1) {
  return fixedEvent(EVENT_TYPE.MARKET_INPUT_OBSERVED, {
    observation: {
      observationId: `${eventId}:observation`,
      sourceType: "simulated",
      sourceName: "wave3-scenario-audit",
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
    reconcileId: `${eventId}:position-reconcile`,
    symbol: "BTCUSDT",
    asset: "BTC",
    quoteAsset: "USDT",
    free: quantity,
    locked: 0,
    quantity,
    markPrice: 65000,
    exposure: Math.abs(quantity * 65000),
    provider: "wave3-scenario-audit",
    source: "exchange",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp
  }, eventId, "exchange", timestamp);
}

function validOrderReconciled(eventId: string, timestamp = isoNow()) {
  return fixedEvent(EVENT_TYPE.ORDER_RECONCILED, {
    reconcileId: `${eventId}:order-reconcile`,
    orderId: "wave3-order-reconcile-1",
    clientOrderId: "wave3-client-reconcile-1",
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.1,
    filledQuantity: 0,
    executedQty: 0,
    exchangeStatus: "NEW",
    provider: "wave3-scenario-audit",
    source: "exchange",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp
  }, eventId, "exchange", timestamp);
}

function exchangeTruthReconcileSucceeded(eventId: string, extra: Record<string, unknown> = {}, timestamp = isoNow()) {
  const quantity = typeof extra.exchangeQuantity === "number" ? extra.exchangeQuantity : 0;
  return fixedEvent("exchange_truth.reconcile_succeeded", {
    reconcileId: `${eventId}:exchange-truth-reconcile`,
    truthId: `${eventId}:exchange-truth`,
    symbol: "BTCUSDT",
    status: "fresh",
    provider: "wave3-scenario-audit",
    source: "exchange",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp,
    connectionState: "connected",
    wsConnected: true,
    position: {
      symbol: "BTCUSDT",
      asset: "BTC",
      quoteAsset: "USDT",
      status: Math.abs(quantity) > 0 ? "open" : "flat",
      quantity,
      free: quantity,
      locked: 0,
      exposure: Math.abs(quantity * 65000),
      markPrice: 65000,
      source: "exchange",
      asOf: timestamp
    },
    orders: [],
    freshness: {
      status: "fresh",
      maxAgeMs: 15000,
      ageMs: 0,
      asOf: timestamp
    },
    ...extra
  }, eventId, "exchange", timestamp);
}

function exchangeTruthStaleDetected(eventId: string, extra: Record<string, unknown> = {}, timestamp = isoPast(60000)) {
  return fixedEvent("exchange_truth.stale_detected", {
    detectionId: `${eventId}:exchange-truth-stale`,
    truthId: `${eventId}:exchange-truth`,
    symbol: "BTCUSDT",
    status: "stale",
    provider: "wave3-scenario-audit",
    source: "exchange",
    reason: "exchange_truth_stale",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: isoNow(),
    maxAgeMs: 15000,
    ageMs: 60000,
    freshness: {
      status: "stale",
      maxAgeMs: 15000,
      ageMs: 60000,
      asOf: timestamp
    },
    ...extra
  }, eventId, "exchange", timestamp);
}

function exchangeTruthConflictDetected(eventId: string, extra: Record<string, unknown> = {}, timestamp = isoNow()) {
  const exchangeQuantity = typeof extra.exchangeQuantity === "number" ? extra.exchangeQuantity : 1;
  return fixedEvent("exchange_truth.conflict_detected", {
    detectionId: `${eventId}:exchange-truth-conflict`,
    truthId: `${eventId}:exchange-truth`,
    symbol: "BTCUSDT",
    status: "conflicted",
    provider: "wave3-scenario-audit",
    source: "exchange",
    reason: "local_position_conflicts_with_exchange_truth",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp,
    local: {
      positionStatus: "flat",
      quantity: 0
    },
    exchange: {
      positionStatus: Math.abs(exchangeQuantity) > 0 ? "open" : "flat",
      quantity: exchangeQuantity
    },
    conflict: {
      reason: "local_position_conflicts_with_exchange_truth",
      localQuantity: 0,
      exchangeQuantity
    },
    ...extra
  }, eventId, "exchange", timestamp);
}

function exchangeTruthUnavailableDetected(eventId: string, extra: Record<string, unknown> = {}, timestamp = isoNow()) {
  return fixedEvent("exchange_truth.unavailable_detected", {
    detectionId: `${eventId}:exchange-truth-unavailable`,
    truthId: `${eventId}:exchange-truth`,
    symbol: "BTCUSDT",
    status: "unavailable",
    provider: "wave3-scenario-audit",
    source: "exchange",
    reason: "exchange_truth_unavailable",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp,
    connectionState: "disconnected",
    wsConnected: false,
    ...extra
  }, eventId, "exchange", timestamp);
}

function systemHealthChanged(
  eventId: string,
  health: {
    status?: "healthy" | "degraded" | "unhealthy" | "unknown";
    connectionState?: "connected" | "disconnected" | "unknown";
    wsConnected?: boolean | "unknown";
    reason?: string;
  },
  timestamp = isoNow()
) {
  return fixedEvent("system.health.changed", {
    healthId: `${eventId}:health`,
    provider: "wave3-scenario-audit",
    source: "system",
    status: health.status ?? "degraded",
    healthy: health.status === "healthy",
    connectionState: health.connectionState ?? "unknown",
    wsConnected: health.wsConnected ?? "unknown",
    reason: health.reason ?? "wave3_health_truth_cleanup",
    asOf: timestamp,
    reportedAt: timestamp,
    receivedAt: timestamp
  }, eventId, "system", timestamp);
}

function commitResult(event: DomainEvent, message: string) {
  assert.equal(typeof engine.commitEventResult, "function", "runtimeEngine.commitEventResult(event, { log: false }) is required");
  const result = engine.commitEventResult!(event, { log: false });
  assert.notEqual(result.status, "duplicate_conflict", `${message}: unexpected idempotency conflict ${JSON.stringify(result)}`);
  return result;
}

function commitOk(event: DomainEvent, message: string) {
  const result = commitResult(event, message);
  assert.equal(result.ok, true, `${message}: expected accepted event, got ${JSON.stringify(result)}`);
  assert.equal(result.status === "accepted" || result.status === "duplicate_ignored", true, `${message}: unexpected status ${String(result.status)}`);
  return result;
}

function completeBootstrapReconciled(prefix = "w3-bootstrap") {
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT, `${prefix}-loading`), "bootstrap.loading_snapshot");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL, `${prefix}-replaying`), "bootstrap.replaying_tail");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH, `${prefix}-awaiting-exchange-truth`), "bootstrap.awaiting_exchange_truth");
  commitOk(bootstrapEvent(EVENT_TYPE.BOOTSTRAP_RECONCILED, `${prefix}-reconciled`), "bootstrap.reconciled");
}

function prepareLocallyValidState(options: {
  market?: "fresh" | "stale";
  positionQuantity?: number;
  bootstrap?: boolean;
  idPrefix?: string;
} = {}) {
  const market = options.market ?? "fresh";
  const ts = market === "fresh" ? isoNow() : isoPast(60000);
  const prefix = options.idPrefix ?? crypto.randomUUID();

  commitOk(validMarketTick(`w3-market-${market}-${prefix}`, 65000, ts, {
    freshness: {
      status: market,
      maxAgeMs: 15000,
      ageMs: market === "stale" ? 60000 : 0,
      asOf: ts
    }
  }), `${market} market tick`);

  commitOk(validPositionReconciled(`w3-position-${prefix}`, options.positionQuantity ?? 0), "position.reconciled");
  commitOk(validOrderReconciled(`w3-order-${prefix}`), "order.reconciled");

  if (options.bootstrap !== false) {
    completeBootstrapReconciled(`w3-bootstrap-${prefix}`);
  }
  commitOk(validProvenanceRecorded(`w3-provenance-${prefix}`, isoNow()), "metadata.provenance.recorded");
  commitOk(validMarketInputObservation(`w3-market-input-${prefix}`, ts), "market.input.observed");
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
  assert.equal(decision.decision, "deny", `${message}: PLACE_ORDER must be denied, got ${JSON.stringify(decision)}`);
}

function assertPlaceOrderAllowedOnlyThroughGate(message: string) {
  const decision = placeOrderDecision();
  assert.equal(decision.decision, "allow", `${message}: ActionGate must be the only authority to allow PLACE_ORDER; got ${JSON.stringify(decision)}`);
}

function snapshotRecord() {
  return runtimeEngine.getSnapshot() as RuntimeSnapshot & Record<string, unknown>;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function exchangeTruthRecord(snapshot = snapshotRecord()) {
  return objectRecord(snapshot.exchangeTruth)
    ?? objectRecord(snapshot.exchange_truth)
    ?? objectRecord(snapshot.exchange)
    ?? objectRecord(snapshot.truth);
}

function exchangeTruthStatus(snapshot = snapshotRecord()) {
  const truth = exchangeTruthRecord(snapshot);
  return typeof truth?.status === "string" ? truth.status : undefined;
}

function assertExchangeTruthStatus(expected: string, message: string) {
  const status = exchangeTruthStatus();
  assert.equal(status, expected, `${message}: expected exchangeTruth.status=${expected}, got ${String(status)} in ${stableSnapshot(snapshotRecord())}`);
}

function assertHealthNotHealthy(message: string) {
  assert.equal(typeof engine.getHealthSnapshot, "function", "runtimeEngine.getHealthSnapshot() is required for Health Truth Cleanup audit");
  const health = engine.getHealthSnapshot!() as Record<string, unknown>;

  const explicitHealthy = health.healthy === true || health.status === "healthy" || health.status === "ok";
  const systemHealthy = health.systemState === "healthy" || health.system === "healthy";
  assert.equal(explicitHealthy || systemHealthy, false, `${message}: health must not report healthy/ok, got ${JSON.stringify(health)}`);
}

function assertWsConnectedIsNotTrue(message: string) {
  assert.equal(typeof engine.getHealthSnapshot, "function", "runtimeEngine.getHealthSnapshot() is required for wsConnected audit");
  const health = engine.getHealthSnapshot!() as Record<string, unknown>;
  assert.notEqual(health.wsConnected, true, `${message}: wsConnected unknown/unverified must not be true; got ${JSON.stringify(health)}`);
}

scenario(
  "cold start -> exchangeTruth unknown -> PLACE_ORDER denied",
  ["ExchangeTruth Domain", "Freshness Guard", "Health Truth Cleanup", "Combined safety"],
  () => {
    assert.equal(snapshotRecord().bootstrap.status, "cold");
    assertExchangeTruthStatus("unknown", "cold start");
    assertPlaceOrderDenied("cold start with exchangeTruth unknown");
  }
);

scenario(
  "bootstrap reconciled but exchangeTruth unknown -> denied",
  ["ExchangeTruth Domain", "Combined safety"],
  () => {
    prepareLocallyValidState({ market: "fresh", positionQuantity: 0, bootstrap: true, idPrefix: "bootstrap-reconciled-unknown-truth" });
    assert.equal(snapshotRecord().bootstrap.status, "reconciled");
    assertExchangeTruthStatus("unknown", "bootstrap reconciled without exchange truth");
    assertPlaceOrderDenied("bootstrap reconciled but exchangeTruth unknown");
  }
);

scenario(
  "exchangeTruth stale -> denied",
  ["ExchangeTruth Domain", "Freshness Guard", "Combined safety"],
  () => {
    prepareLocallyValidState({ market: "fresh", positionQuantity: 0, bootstrap: true, idPrefix: "truth-stale" });
    commitOk(exchangeTruthStaleDetected("w3-exchange-truth-stale"), "exchange_truth.stale_detected");
    assertExchangeTruthStatus("stale", "exchangeTruth stale");
    assertPlaceOrderDenied("exchangeTruth stale");
  }
);

scenario(
  "exchangeTruth conflicted -> denied",
  ["ExchangeTruth Domain", "Combined safety"],
  () => {
    prepareLocallyValidState({ market: "fresh", positionQuantity: 0, bootstrap: true, idPrefix: "truth-conflict" });
    commitOk(exchangeTruthConflictDetected("w3-exchange-truth-conflict", { exchangeQuantity: 1 }), "exchange_truth.conflict_detected");
    assertExchangeTruthStatus("conflicted", "exchangeTruth conflicted");
    assertPlaceOrderDenied("exchangeTruth conflicted");
  }
);

scenario(
  "exchangeTruth unavailable -> denied",
  ["ExchangeTruth Domain", "Health Truth Cleanup", "Combined safety"],
  () => {
    prepareLocallyValidState({ market: "fresh", positionQuantity: 0, bootstrap: true, idPrefix: "truth-unavailable" });
    commitOk(exchangeTruthUnavailableDetected("w3-exchange-truth-unavailable"), "exchange_truth.unavailable_detected");
    assertExchangeTruthStatus("unavailable", "exchangeTruth unavailable");
    assertPlaceOrderDenied("exchangeTruth unavailable");
    assertHealthNotHealthy("exchangeTruth unavailable");
  }
);

scenario(
  "market data stale -> denied",
  ["Freshness Guard", "Combined safety"],
  () => {
    prepareLocallyValidState({ market: "stale", positionQuantity: 0, bootstrap: true, idPrefix: "market-stale" });
    commitOk(exchangeTruthReconcileSucceeded("w3-exchange-truth-fresh-with-stale-market"), "exchange_truth.reconcile_succeeded");
    assertExchangeTruthStatus("fresh", "exchangeTruth fresh");
    assertPlaceOrderDenied("market data stale");
  }
);

scenario(
  "connection state unknown -> not healthy and denied where applicable",
  ["Health Truth Cleanup", "ExchangeTruth Domain", "Combined safety"],
  () => {
    prepareLocallyValidState({ market: "fresh", positionQuantity: 0, bootstrap: true, idPrefix: "connection-unknown" });
    commitOk(exchangeTruthReconcileSucceeded("w3-exchange-truth-fresh-before-unknown-connection"), "exchange_truth.reconcile_succeeded");
    commitOk(systemHealthChanged("w3-system-health-connection-unknown", {
      status: "degraded",
      connectionState: "unknown",
      wsConnected: "unknown",
      reason: "connection_state_unknown"
    }), "system.health.changed");
    assertHealthNotHealthy("connection state unknown");
    assertWsConnectedIsNotTrue("connection state unknown");
    assertPlaceOrderDenied("connection state unknown");
  }
);

scenario(
  "wsConnected unknown is not true",
  ["Health Truth Cleanup"],
  () => {
    commitOk(systemHealthChanged("w3-system-health-ws-unknown", {
      status: "degraded",
      connectionState: "unknown",
      wsConnected: "unknown",
      reason: "ws_connected_unknown"
    }), "system.health.changed ws unknown");
    assertWsConnectedIsNotTrue("wsConnected unknown");
  }
);

scenario(
  "bootstrap reconciled + exchangeTruth fresh + market fresh + valid position -> allow only if ActionGate allows",
  ["ExchangeTruth Domain", "Freshness Guard", "Combined safety", "ActionGate"],
  () => {
    prepareLocallyValidState({ market: "fresh", positionQuantity: 0, bootstrap: true, idPrefix: "fully-valid" });
    commitOk(exchangeTruthReconcileSucceeded("w3-exchange-truth-fresh-valid"), "exchange_truth.reconcile_succeeded");
    commitOk(systemHealthChanged("w3-system-health-healthy-valid", {
      status: "healthy",
      connectionState: "connected",
      wsConnected: true,
      reason: "all_wave3_inputs_fresh"
    }), "system.health.changed healthy");
    assertExchangeTruthStatus("fresh", "exchangeTruth fresh and valid state");
    assertPlaceOrderAllowedOnlyThroughGate("fresh exchangeTruth + fresh market + reconciled bootstrap + valid position");
  }
);

scenario(
  "local flat position + exchange conflict -> denied",
  ["ExchangeTruth Domain", "Combined safety"],
  () => {
    prepareLocallyValidState({ market: "fresh", positionQuantity: 0, bootstrap: true, idPrefix: "local-flat-exchange-conflict" });
    assert.equal(snapshotRecord().position.status, "flat");
    commitOk(exchangeTruthConflictDetected("w3-local-flat-exchange-conflict", {
      exchangeQuantity: 1,
      conflict: {
        reason: "local_flat_but_exchange_open",
        localQuantity: 0,
        exchangeQuantity: 1
      }
    }), "exchange_truth.conflict_detected against local flat position");
    assertPlaceOrderDenied("local flat position conflicts with exchange truth");
  }
);

const failed = results.filter((result) => !result.ok);

console.log(JSON.stringify({
  name: "wave3_scenario_audit",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results
}, null, 2));

if (failed.length > 0) {
  throw new Error(`wave3 scenario audit failed: ${failed.map((r) => `${r.name}: ${r.detail}`).join("; ")}`);
}
