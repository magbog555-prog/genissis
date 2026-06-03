import { DomainEvent, EVENT_TYPE, makeEvent, MarketTickPayload, SignalPayload } from "../../contracts/src/events.js";
import { ActionRequest, ACTION_TYPE, GateDecision } from "../../contracts/src/actions.js";
import { initialSnapshot, RuntimeSnapshot } from "../../state/src/types.js";
import { reduceBootstrapState, reduceExchangeTruthState, reduceMarketInputState, reduceMarketState, reduceTradeState, reduceOrderState, reducePositionState, reduceRiskState, reduceSystemState, reduceProvenanceState } from "../../transitions/src/reducers.js";
import { validateDomainEvent, type DomainEventValidationRejected } from "../../events/validate-domain-event.js";
import { ActionGate } from "../../gates/src/action-gate.js";
import { FileRuntimePersistence } from "./persistence.js";
import { EventIdempotencyIndex, type IdempotencyDiagnostic } from "./idempotency.js";
import { calculateFreshness, DEFAULT_FRESHNESS_CONFIG } from "./freshness.js";
import { buildCoreTrustReport, type CoreTrustReport } from "../../kernel/core-trust-report.js";
import { QuarantineStore } from "../../quarantine/quarantine.js";
import { PermissionLedger } from "../../permissions/permission-ledger.js";
import { planRecovery, type RecoveryPlan } from "../../recovery/recovery-planner.js";
import { buildCausalityReport, buildIntegrityReport, buildMarketInputIntegrityReport, buildProvenanceHealthReport, MARKET_INPUT_BLOCKING_REASON, type CausalityReport, type IntegrityReport, type MarketInputIntegrityReport, type ProvenanceHealthReport } from "../../integrity/integrity-report.js";
import { buildCausalityTrace, type CausalityTrace } from "../../trace/causality-trace.js";
import { buildHashChainLink, buildHashStatusReport, verifyRevisionContinuity, type SnapshotHashChainLink } from "../../integrity/snapshot-hash-chain.js";

type StateDomain = "bootstrap" | "exchangeTruth" | "provenance" | "marketInput" | "market" | "trade" | "order" | "position" | "risk" | "system";

export interface TransitionTrace {
  transitionId: string;
  eventId: string;
  eventType: string;
  committedAt: string;
  snapshotRevisionBefore: number;
  snapshotRevisionAfter: number;
  changedDomains: StateDomain[];
  domains: Record<StateDomain, {
    changed: boolean;
    statusBefore?: string;
    statusAfter?: string;
    revisionBefore: number;
    revisionAfter: number;
    sourceEventIdAfter?: string;
  }>;
}

export interface InvariantCheck {
  name: string;
  ok: boolean;
  details: string;
}

export interface CommitEventAcceptedResult {
  ok: true;
  status: "accepted";
  eventId: string;
  eventType: string;
  snapshot: RuntimeSnapshot;
  diagnostic?: IdempotencyDiagnostic;
}

export interface CommitEventRejectedResult {
  ok: false;
  status: "rejected";
  diagnostic: DomainEventValidationRejected;
  snapshot: RuntimeSnapshot;
  snapshotRevision: number;
}

export interface CommitEventDuplicateResult {
  ok: true;
  status: "duplicate_ignored";
  eventId: string;
  eventType: string;
  snapshot: RuntimeSnapshot;
  snapshotRevision: number;
  diagnostic: IdempotencyDiagnostic;
}

export interface CommitEventConflictResult {
  ok: false;
  status: "duplicate_conflict";
  eventId: string;
  eventType: string;
  snapshot: RuntimeSnapshot;
  snapshotRevision: number;
  diagnostic: IdempotencyDiagnostic;
}

export type CommitEventResult =
  | CommitEventAcceptedResult
  | CommitEventRejectedResult
  | CommitEventDuplicateResult
  | CommitEventConflictResult;

export interface EventCommitResult {
  snapshot: RuntimeSnapshot;
  diagnostic: IdempotencyDiagnostic;
}

export type ConnectionTruthStatus = true | false | "unknown" | "stale";

export interface ConnectionTruth {
  status: ConnectionTruthStatus;
  observedAt?: string;
  sourceEventId?: string;
  reason?: string;
}

export interface HealthTruthSnapshot {
  [key: string]: unknown;
  systemState: RuntimeSnapshot["system"]["status"];
  wsConnected: ConnectionTruthStatus;
  connections: {
    websocket: ConnectionTruth;
  };
  healthTruthComplete: boolean;
  healthTruthDiagnostics: string[];
  reconcileFresh: boolean | "unknown";
  positionMatchesFills: boolean | "unknown";
  openOrders: number;
  unknownOrders: number;
  driftDetected: boolean;
  reconcileLatencyMs: number;
  wsReconnects: number | "unknown";
  timestamp: string;
}

const CONNECTION_STATUS_TTL_MS = Number(process.env.MBG_HEALTH_CONNECTION_STATUS_TTL_MS ?? 30000);

function connectionStatusFromHealthEvent(event: DomainEvent): ConnectionTruth | undefined {
  if (event.eventType !== EVENT_TYPE.SYSTEM_HEALTH_CHANGED) return undefined;

  const payload: any = event.payload ?? {};
  const target = String(payload.connection ?? payload.channel ?? payload.component ?? "").toLowerCase();
  const hasExplicitWsTruth = Object.prototype.hasOwnProperty.call(payload, "wsConnected")
    || Object.prototype.hasOwnProperty.call(payload, "connectionState")
    || Object.prototype.hasOwnProperty.call(payload, "connected");

  if (target && !["ws", "websocket", "exchange_ws", "exchange-websocket"].includes(target)) return undefined;
  if (!target && !hasExplicitWsTruth) return undefined;

  const rawStatus = String(payload.wsConnected ?? payload.connected ?? payload.connectionState ?? payload.status ?? payload.state ?? "").toLowerCase();
  let status: true | false | "unknown";
  if (payload.wsConnected === true || payload.connected === true || ["connected", "true", "up", "open", "healthy"].includes(rawStatus)) status = true;
  else if (payload.wsConnected === false || payload.connected === false || ["disconnected", "false", "down", "closed", "unhealthy"].includes(rawStatus)) status = false;
  else if (payload.wsConnected === "unknown" || ["unknown", "degraded", "partial"].includes(rawStatus)) status = "unknown";
  else return undefined;

  return {
    status,
    observedAt: event.timestamp,
    sourceEventId: event.eventId,
    reason: typeof payload.reason === "string" ? payload.reason : undefined
  };
}

function normalizeConnectionTruth(connection?: ConnectionTruth): ConnectionTruth {
  if (!connection) return { status: "unknown", reason: "ws_status_unknown" };

  if (connection.status === true || connection.status === false) {
    const observedMs = connection.observedAt ? Date.parse(connection.observedAt) : NaN;
    if (!Number.isFinite(observedMs)) {
      return { ...connection, status: "unknown", reason: connection.reason ?? "ws_status_unknown" };
    }

    if (Date.now() - observedMs > CONNECTION_STATUS_TTL_MS) {
      return { ...connection, status: "stale", reason: "connection_state_stale" };
    }
  }

  return connection;
}



export interface RuntimeMetrics {
  startedAt: string;
  uptimeMs: number;
  totalEvents: number;
  totalTransitions: number;
  totalDecisions: number;
  eventsPerSecond: number;
  lastCommitAt?: string;
  timeSinceLastCommitMs?: number;
  commitLatencyMs: { last: number; avg: number; max: number };
  backlogDepth: number;
  rejectRate: number;
  falseAllowCount: number;
  actionViolationCount: number;
  uncertaintyTransitionCount: number;
  gateTransitionCount: number;
  snapshotRevision: number;
  snapshotStalled: boolean;
  duplicateEventCount: number;
  idempotencyConflictCount: number;
  quarantineCount: number;
  permissionLedgerCount: number;
}

function domainTrace(domain: StateDomain, before: any, after: any) {
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  return {
    changed,
    statusBefore: before?.status,
    statusAfter: after?.status,
    revisionBefore: before?.meta?.revision ?? 0,
    revisionAfter: after?.meta?.revision ?? 0,
    sourceEventIdAfter: after?.meta?.sourceEventId
  };
}

export function reduceSnapshot(prev: RuntimeSnapshot, event: DomainEvent): RuntimeSnapshot {
  const nextBootstrap = reduceBootstrapState(prev.bootstrap, event);
  const nextMarketInput = reduceMarketInputState(prev.marketInput, event);
  const nextMarket = reduceMarketState(prev.market, event);
  const nextTrade = reduceTradeState(prev.trade, event);
  const temp1: RuntimeSnapshot = { ...prev, bootstrap: nextBootstrap, marketInput: nextMarketInput, market: nextMarket, trade: nextTrade };

  const nextOrder = reduceOrderState(prev.order, event);
  const nextPosition = reducePositionState(prev.position, event);
  const temp2: RuntimeSnapshot = { ...temp1, order: nextOrder, position: nextPosition };

  const nextExchangeTruth = reduceExchangeTruthState(prev.exchangeTruth, event, temp2);
  const tempExchange: RuntimeSnapshot = { ...temp2, exchangeTruth: nextExchangeTruth };

  const nextProvenance = reduceProvenanceState(prev.provenance, event);
  const tempProvenance: RuntimeSnapshot = { ...tempExchange, provenance: nextProvenance };

  const nextRisk = reduceRiskState(prev.risk, event, tempProvenance);
  const temp3: RuntimeSnapshot = { ...tempProvenance, risk: nextRisk };

  const nextSystem = reduceSystemState(prev.system, event, temp3);

  return {
    bootstrap: nextBootstrap,
    exchangeTruth: nextExchangeTruth,
    provenance: nextProvenance,
    marketInput: nextMarketInput,
    market: nextMarket,
    trade: nextTrade,
    order: nextOrder,
    position: nextPosition,
    risk: nextRisk,
    system: nextSystem,
    revision: prev.revision + 1,
    committedAt: event.timestamp
  };
}

export function replaySnapshotFromEvents(events: DomainEvent[]): RuntimeSnapshot {
  return events.reduce((snapshot, event) => reduceSnapshot(snapshot, event), initialSnapshot());
}

function makeTrace(cur: RuntimeSnapshot, next: RuntimeSnapshot, event: DomainEvent): TransitionTrace {
  const domains = {
    bootstrap: domainTrace("bootstrap", cur.bootstrap, next.bootstrap),
    exchangeTruth: domainTrace("exchangeTruth", cur.exchangeTruth, next.exchangeTruth),
    provenance: domainTrace("provenance", cur.provenance, next.provenance),
    marketInput: domainTrace("marketInput", cur.marketInput, next.marketInput),
    market: domainTrace("market", cur.market, next.market),
    trade: domainTrace("trade", cur.trade, next.trade),
    order: domainTrace("order", cur.order, next.order),
    position: domainTrace("position", cur.position, next.position),
    risk: domainTrace("risk", cur.risk, next.risk),
    system: domainTrace("system", cur.system, next.system)
  };
  const changedDomains = (Object.keys(domains) as StateDomain[]).filter((d) => domains[d].changed);

  return {
    transitionId: crypto.randomUUID(),
    eventId: event.eventId,
    eventType: event.eventType,
    committedAt: next.committedAt,
    snapshotRevisionBefore: cur.revision,
    snapshotRevisionAfter: next.revision,
    changedDomains,
    domains
  };
}

function normalizeMeta<T extends { meta?: { revision?: number; updatedAt?: string } }>(value: T): T {
  if (!value.meta || value.meta.revision !== 0) return value;
  return {
    ...value,
    meta: {
      ...value.meta,
      updatedAt: "<initial>"
    }
  };
}

function comparableSnapshot(snapshot: RuntimeSnapshot) {
  // Cold replay has a new initial timestamp. Ignore only non-event-derived initial timestamps.
  return {
    ...snapshot,
    bootstrap: normalizeMeta(snapshot.bootstrap),
    exchangeTruth: normalizeMeta(snapshot.exchangeTruth),
    provenance: normalizeMeta(snapshot.provenance),
    marketInput: normalizeMeta(snapshot.marketInput),
    market: normalizeMeta(snapshot.market),
    trade: normalizeMeta(snapshot.trade),
    order: normalizeMeta(snapshot.order),
    position: normalizeMeta(snapshot.position),
    risk: normalizeMeta(snapshot.risk),
    system: {
      ...normalizeMeta(snapshot.system),
      startedAt: "<ignored>"
    }
  };
}


function validateEventForCurrentSnapshot(event: DomainEvent, snapshot: RuntimeSnapshot): DomainEventValidationRejected | undefined {
  const rejectBootstrapTransition = (expected: string, actual: string): DomainEventValidationRejected => ({
    ok: false,
    eventId: event.eventId,
    eventType: event.eventType,
    issues: [{
      code: "payload_invalid",
      path: "bootstrap.status",
      message: `${event.eventType} requires bootstrap status ${expected}; current status is ${actual}`
    }]
  });

  switch (event.eventType) {
    case EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT:
      return snapshot.bootstrap.status === "cold"
        ? undefined
        : rejectBootstrapTransition("cold", snapshot.bootstrap.status);
    case EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL:
      return snapshot.bootstrap.status === "loading_snapshot"
        ? undefined
        : rejectBootstrapTransition("loading_snapshot", snapshot.bootstrap.status);
    case EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH:
      return snapshot.bootstrap.status === "replaying_tail"
        ? undefined
        : rejectBootstrapTransition("replaying_tail", snapshot.bootstrap.status);
    case EVENT_TYPE.BOOTSTRAP_RECONCILED:
      return snapshot.bootstrap.status === "awaiting_exchange_truth"
        ? undefined
        : rejectBootstrapTransition("awaiting_exchange_truth", snapshot.bootstrap.status);
    case EVENT_TYPE.BOOTSTRAP_RECOVERY_STARTED:
      return snapshot.bootstrap.status === "failed"
        ? undefined
        : rejectBootstrapTransition("failed", snapshot.bootstrap.status);
    default:
      return undefined;
  }
}

export class RuntimeEngine {
  private snapshot: RuntimeSnapshot = initialSnapshot();
  private events: DomainEvent[] = []; // recent event window only; full history lives in segmented persistence
  private totalEventCount = 0;
  private gate = new ActionGate();
  private transitions: TransitionTrace[] = [];
  private decisions: GateDecision[] = [];
  private startedAt = Date.now();
  private lastCommitAtMs?: number;
  private commitLatencySamples: number[] = [];
  private commitLatencyLastMs = 0;
  private commitLatencyMaxMs = 0;
  private rejectedEvents = 0;
  private idempotencyIndex = new EventIdempotencyIndex();
  private idempotencyDiagnostics: IdempotencyDiagnostic[] = [];
  private duplicateEventCount = 0;
  private idempotencyConflictCount = 0;
  private falseAllowCount = 0;
  private actionViolationCount = 0;
  private uncertaintyTransitionCount = 0;
  private gateTransitionCount = 0;
  private persistence = new FileRuntimePersistence();
  private websocketTruth?: ConnectionTruth;
  private quarantine = new QuarantineStore();
  private permissionLedger = new PermissionLedger();
  private causalityTraces: CausalityTrace[] = [];
  private snapshotHashChain: SnapshotHashChainLink[] = [];

  constructor() {
    this.recoverFromDisk();
  }

  getHealthSnapshot(): HealthTruthSnapshot {
    const metrics = this.getMetrics();
    const websocket = normalizeConnectionTruth(this.websocketTruth);
    const diagnostics = new Set<string>();

    if (websocket.status === "unknown") {
      diagnostics.add("connection_state_unknown");
      diagnostics.add("ws_status_unknown");
    }
    if (websocket.status === "stale") diagnostics.add("connection_state_stale");
    if (this.snapshot.exchangeTruth.status !== "fresh") diagnostics.add(this.snapshot.exchangeTruth.reason ?? `exchange_truth_${this.snapshot.exchangeTruth.status}`);

    const reconcileFresh: boolean | "unknown" =
      this.snapshot.exchangeTruth.status === "fresh"
        ? true
        : this.snapshot.exchangeTruth.status === "unknown"
          ? "unknown"
          : false;
    if (reconcileFresh === "unknown") diagnostics.add("health_truth_partial");

    const positionMatchesFills: boolean | "unknown" =
      this.snapshot.position.status === "unknown"
        ? "unknown"
        : this.snapshot.exchangeTruth.status === "conflicted"
          ? false
          : true;
    if (positionMatchesFills === "unknown") diagnostics.add("health_truth_partial");

    if (websocket.status === false) diagnostics.add("connection_state_disconnected");
    if (websocket.status === "unknown" || websocket.status === "stale" || websocket.status === false) diagnostics.add("health_truth_partial");

    const healthTruthComplete = diagnostics.size === 0;
    const systemState: RuntimeSnapshot["system"]["status"] =
      !healthTruthComplete || websocket.status !== true
        ? (this.snapshot.system.status === "halted" ? "halted" : "degraded")
        : this.snapshot.system.status;

    return {
      systemState,
      wsConnected: websocket.status,
      connections: { websocket },
      healthTruthComplete,
      healthTruthDiagnostics: Array.from(diagnostics).sort(),
      reconcileFresh,
      positionMatchesFills,
      openOrders: this.snapshot.order.status === "pending" ? 1 : 0,
      unknownOrders: this.snapshot.order.status === "uncertain" ? 1 : 0,
      driftDetected:
        this.snapshot.position.status === "unknown" ||
        this.snapshot.order.status === "uncertain" ||
        this.snapshot.exchangeTruth.status === "conflicted" ||
        this.snapshot.exchangeTruth.status === "unavailable" ||
        websocket.status === "unknown" ||
        websocket.status === "stale",
      reconcileLatencyMs: metrics.commitLatencyMs.last,
      wsReconnects: "unknown",
      timestamp: new Date().toISOString()
    };
  }

  private recordIdempotencyDiagnostic(diagnostic: IdempotencyDiagnostic) {
    this.idempotencyDiagnostics.push(diagnostic);
    if (this.idempotencyDiagnostics.length > 500) this.idempotencyDiagnostics.shift();

    if (diagnostic.decision === "duplicate_ignored") this.duplicateEventCount += 1;
    if (diagnostic.decision === "duplicate_conflict") this.idempotencyConflictCount += 1;
  }

  private recordCausalityTrace(trace: CausalityTrace): CausalityTrace {
    this.causalityTraces.push(trace);
    if (this.causalityTraces.length > 1000) this.causalityTraces.shift();
    return trace;
  }

  private buildCoreTrustReportForSnapshot(snapshot: RuntimeSnapshot, metadata: Record<string, unknown> = {}): CoreTrustReport {
    const current = this.snapshot;
    this.snapshot = snapshot;
    try {
      return this.getCoreTrustReport(metadata);
    } finally {
      this.snapshot = current;
    }
  }

  private applyAcceptedEvent(event: DomainEvent, options: { persist: boolean; log: boolean }) {
    const commitStarted = performance.now();

    if (options.persist) {
      try {
        this.persistence.appendEvent(event);
      } catch (err) {
        console.error("[CRITICAL] Failed to persist event:", event.eventId, err);
        throw err;
      }
    }

    this.idempotencyIndex.recordAccepted(event);

    const connectionTruth = connectionStatusFromHealthEvent(event);
    if (connectionTruth) this.websocketTruth = connectionTruth;

    this.events.push(event);
    if (this.events.length > 5000) {
      const removed = this.events.shift();
      if (options.log && removed) {
        console.log(`[runtime] purged event from buffer: ${removed.eventId} (buffer full)`);
      }
    }
    this.totalEventCount += 1;

    const cur = this.snapshot;
    const beforeReport = this.buildCoreTrustReportForSnapshot(cur, { causalityPhase: "before", eventId: event.eventId });
    const next = reduceSnapshot(cur, event);
    this.snapshot = next;
    const previousHash = this.snapshotHashChain.at(-1)?.snapshotHash ?? "genesis-snapshot-hash";
    const hashLink = buildHashChainLink({
      event,
      previousSnapshotHash: previousHash,
      snapshot: next,
      builtAt: next.committedAt
    });
    this.snapshotHashChain.push(hashLink);
    if (this.snapshotHashChain.length > 5000) this.snapshotHashChain.shift();
    const afterReport = this.buildCoreTrustReportForSnapshot(next, { causalityPhase: "after", eventId: event.eventId, hashChainLinkId: hashLink.transitionHash });

    if (next.order.status === "uncertain" || next.position.status === "unknown") {
      this.uncertaintyTransitionCount += 1;
    }

    const trace = makeTrace(cur, next, event);
    this.transitions.push(trace);
    if (this.transitions.length > 500) this.transitions.shift();

    this.recordCausalityTrace(buildCausalityTrace({
      event,
      beforeSnapshot: cur,
      afterSnapshot: next,
      beforeReport,
      afterReport,
      reducerName: "reduceSnapshot",
      transitionStatus: "accepted",
      hashChainLinkId: hashLink.transitionHash,
      generatedAt: next.committedAt
    }));

    if (options.persist) {
      this.persistence.appendTransition(trace);
      this.persistence.saveSnapshot(this.snapshot);
    }

    const latency = performance.now() - commitStarted;
    this.commitLatencyLastMs = Number(latency.toFixed(3));
    this.commitLatencyMaxMs = Math.max(this.commitLatencyMaxMs, this.commitLatencyLastMs);
    this.commitLatencySamples.push(this.commitLatencyLastMs);
    if (this.commitLatencySamples.length > 1000) this.commitLatencySamples.shift();
    this.lastCommitAtMs = Date.now();

    if (options.log) {
      console.log(
        `[runtime] event=${event.eventType} eventId=${event.eventId} snapshot=${cur.revision}->${this.snapshot.revision} changed=${trace.changedDomains.join(",") || "none"}`
      );
    }

    return this.snapshot;
  }

  commitEventResult(event: DomainEvent, options: { log?: boolean } = {}): CommitEventResult {
    const validation = validateDomainEvent(event);
    if (!validation.ok) {
      this.rejectedEvents += 1;
      const quarantineRecord = this.quarantine.recordValidation({
        event,
        diagnostic: validation,
        detectedBy: "RuntimeEngine.commitEventResult"
      });
      const report = this.getCoreTrustReport({ causalityPhase: "rejected", eventId: String((event as any)?.eventId ?? "missing") });
      this.recordCausalityTrace(buildCausalityTrace({
        event: event as any,
        eventId: String((event as any)?.eventId ?? "missing"),
        eventType: String((event as any)?.eventType ?? "unknown"),
        beforeSnapshot: this.snapshot,
        afterSnapshot: this.snapshot,
        beforeReport: report,
        afterReport: report,
        reducerName: "none",
        transitionStatus: "rejected",
        quarantineRecord,
        generatedAt: new Date().toISOString()
      }));
      if (options.log !== false) {
        console.warn(
          `[runtime] rejected event=${String((event as any)?.eventType ?? "unknown")} eventId=${String((event as any)?.eventId ?? "missing")} issues=${validation.issues.map((i) => i.code).join(",")}`
        );
      }
      return {
        ok: false,
        status: "rejected",
        diagnostic: validation,
        snapshot: this.snapshot,
        snapshotRevision: this.snapshot.revision
      };
    }

    const stateValidation = validateEventForCurrentSnapshot(event, this.snapshot);
    if (stateValidation) {
      this.rejectedEvents += 1;
      const quarantineRecord = this.quarantine.recordValidation({
        event,
        diagnostic: stateValidation,
        detectedBy: "RuntimeEngine.state_validation"
      });
      const report = this.getCoreTrustReport({ causalityPhase: "rejected", eventId: event.eventId });
      this.recordCausalityTrace(buildCausalityTrace({
        event,
        beforeSnapshot: this.snapshot,
        afterSnapshot: this.snapshot,
        beforeReport: report,
        afterReport: report,
        reducerName: "none",
        transitionStatus: "rejected",
        quarantineRecord,
        generatedAt: new Date().toISOString()
      }));
      if (options.log !== false) {
        console.warn(
          `[runtime] rejected event=${event.eventType} eventId=${event.eventId} issues=${stateValidation.issues.map((i) => i.code).join(",")}`
        );
      }
      return {
        ok: false,
        status: "rejected",
        diagnostic: stateValidation,
        snapshot: this.snapshot,
        snapshotRevision: this.snapshot.revision
      };
    }

    const idempotency = this.idempotencyIndex.evaluate(event);
    if (idempotency.decision !== "accepted") {
      this.recordIdempotencyDiagnostic(idempotency);
      if (options.log !== false) {
        console.warn(
          `[runtime] idempotency=${idempotency.decision} scope=${idempotency.scope} key=${idempotency.key} eventId=${event.eventId}`
        );
      }

      const base = {
        eventId: event.eventId,
        eventType: event.eventType,
        snapshot: this.snapshot,
        snapshotRevision: this.snapshot.revision,
        diagnostic: idempotency
      };

      if (idempotency.decision === "duplicate_ignored") {
        return { ok: true, status: "duplicate_ignored", ...base };
      }

      const quarantineRecord = this.quarantine.recordIdempotencyConflict({
        event,
        diagnostic: idempotency,
        detectedBy: "RuntimeEngine.idempotency"
      });
      const report = this.getCoreTrustReport({ causalityPhase: "duplicate_conflict", eventId: event.eventId });
      this.recordCausalityTrace(buildCausalityTrace({
        event,
        beforeSnapshot: this.snapshot,
        afterSnapshot: this.snapshot,
        beforeReport: report,
        afterReport: report,
        reducerName: "none",
        transitionStatus: "duplicate_conflict",
        quarantineRecord,
        generatedAt: new Date().toISOString()
      }));
      return { ok: false, status: "duplicate_conflict", ...base };
    }

    this.recordIdempotencyDiagnostic(idempotency);
    const snapshot = this.applyAcceptedEvent(event, { persist: true, log: options.log !== false });
    return {
      ok: true,
      status: "accepted",
      eventId: event.eventId,
      eventType: event.eventType,
      snapshot,
      diagnostic: idempotency
    };
  }

  commitEventWithDiagnostic(event: DomainEvent): EventCommitResult {
    const result = this.commitEventResult(event, { log: true });
    if (result.status === "rejected") {
      return {
        snapshot: result.snapshot,
        diagnostic: {
          decision: "duplicate_conflict",
          scope: "eventId",
          key: String((event as any)?.eventId ?? "missing"),
          eventId: String((event as any)?.eventId ?? "missing"),
          eventType: String((event as any)?.eventType ?? "unknown"),
          reason: result.diagnostic.issues.map((issue) => issue.code).join(","),
          canonicalEvent: false
        }
      };
    }
    return { snapshot: result.snapshot, diagnostic: result.diagnostic as IdempotencyDiagnostic };
  }

  commitEvent(event: DomainEvent): RuntimeSnapshot {
    return this.commitEventResult(event, { log: true }).snapshot;
  }

  commitEventSilent(event: DomainEvent): RuntimeSnapshot {
    return this.commitEventResult(event, { log: false }).snapshot;
  }

  beginPersistenceBatch() {
    this.persistence.beginBatch();
  }

  flushPersistenceBatch() {
    this.persistence.flushBatch();
  }

  endPersistenceBatch() {
    this.persistence.endBatch();
  }

  recoverFromDisk() {
    const persistedSnapshot = this.persistence.loadSnapshot();

    this.snapshot = persistedSnapshot ?? initialSnapshot();
    this.events = [];
    this.totalEventCount = 0;
    this.transitions = [];
    this.decisions = [];
    this.uncertaintyTransitionCount = 0;
    this.gateTransitionCount = 0;
    this.idempotencyIndex.clear();
    this.idempotencyDiagnostics = [];
    this.duplicateEventCount = 0;
    this.idempotencyConflictCount = 0;
    this.totalEventCount = this.snapshot.revision;

    // Snapshot-first recovery: rebuild idempotency from accepted persisted journal, then
    // replay only the tail after the persisted snapshot revision. Duplicate tail events
    // are never reduced into the snapshot a second time.
    const snapshotRevision = this.snapshot.revision;
    this.persistence.forEachEvent((event, index) => {
      if (index < snapshotRevision) {
        this.idempotencyIndex.recordAccepted(event);
        return;
      }

      const diagnostic = this.idempotencyIndex.evaluate(event);
      if (diagnostic.decision !== "accepted") {
        this.recordIdempotencyDiagnostic(diagnostic);
        return;
      }

      this.recordIdempotencyDiagnostic(diagnostic);
      this.applyAcceptedEvent(event, { persist: false, log: false });
    });

    if (this.totalEventCount > 0) {
      console.log(`[persistence] recovered mode=segmented-streaming events=${this.totalEventCount} snapshotRevision=${this.snapshot.revision} recentWindow=${this.events.length}`);
    }

    return {
      recoveredEvents: this.totalEventCount,
      snapshotRevision: this.snapshot.revision,
      lastEventId: this.events.at(-1)?.eventId
    };
  }

  replayCheck() {
    const persistedSnapshot = this.persistence.loadSnapshot();

    let replayed = persistedSnapshot ?? initialSnapshot();
    let eventCount = replayed.revision;
    let lastEventId: string | undefined;
    let duplicateCount = 0;
    let conflictCount = 0;
    const replayIdempotency = new EventIdempotencyIndex();
    const snapshotRevision = replayed.revision;

    this.persistence.forEachEvent((event, index) => {
      if (index < snapshotRevision) {
        replayIdempotency.recordAccepted(event);
        lastEventId = event.eventId;
        return;
      }

      const diagnostic = replayIdempotency.evaluate(event);
      if (diagnostic.decision === "accepted") {
        replayIdempotency.recordAccepted(event);
        replayed = reduceSnapshot(replayed, event);
        eventCount += 1;
        lastEventId = event.eventId;
        return;
      }

      duplicateCount += 1;
      if (diagnostic.decision === "duplicate_conflict") conflictCount += 1;
    });

    const currentComparable = comparableSnapshot(this.snapshot);
    const replayComparable = comparableSnapshot(replayed);
    const matches = JSON.stringify(currentComparable) === JSON.stringify(replayComparable);

    return {
      ok: matches && replayed.revision === eventCount && eventCount === this.totalEventCount && conflictCount === 0,
      eventCount,
      currentRevision: this.snapshot.revision,
      replayRevision: replayed.revision,
      currentCommittedAt: this.snapshot.committedAt,
      replayCommittedAt: replayed.committedAt,
      lastEventId: lastEventId ?? this.events.at(-1)?.eventId,
      mode: "snapshot-first-streaming-tail-idempotent",
      idempotency: {
        duplicateCount,
        conflictCount
      },
      mismatch: matches ? undefined : {
        current: currentComparable,
        replayed: replayComparable
      }
    };
  }

  clearPersistenceAndReset() {
    this.persistence.clear();
    this.snapshot = initialSnapshot();
    this.events = [];
    this.totalEventCount = 0;
    this.transitions = [];
    this.decisions = [];
    this.lastCommitAtMs = undefined;
    this.commitLatencySamples = [];
    this.commitLatencyLastMs = 0;
    this.commitLatencyMaxMs = 0;
    this.falseAllowCount = 0;
    this.actionViolationCount = 0;
    this.uncertaintyTransitionCount = 0;
    this.gateTransitionCount = 0;
    this.rejectedEvents = 0;
    this.idempotencyIndex.clear();
    this.idempotencyDiagnostics = [];
    this.duplicateEventCount = 0;
    this.idempotencyConflictCount = 0;
    this.websocketTruth = undefined;
    this.quarantine.clear();
    this.permissionLedger.clear();
    this.causalityTraces = [];
    this.snapshotHashChain = [];
    return this.getRuntimeView();
  }

  ingestMarketTick(payload: MarketTickPayload) {
    return this.commitEvent(makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, payload));
  }

  ingestSignal(payload: SignalPayload) {
    return this.commitEvent(makeEvent(EVENT_TYPE.SIGNAL_RECEIVED, payload));
  }

  dispatchAction(action: ActionRequest) {
    const now = new Date();
    const integrity = this.getIntegrityReport(now);
    const causality = this.getCausalityReport(undefined, undefined, undefined);
    const provenance = this.getProvenanceHealthReport(now);
    const marketInput = this.getMarketInputIntegrityReport(now);
    const decision = this.gate.evaluate(action, this.snapshot, { enforceFreshness: true, now, freshness: this.getFreshness(now), freshnessConfig: DEFAULT_FRESHNESS_CONFIG, integrity, causality, provenance, marketInput });
    this.recordPermissionDecision(decision, "RuntimeEngine.dispatchAction");
    this.gateTransitionCount += 1;
    this.decisions.push(decision);
    if (this.decisions.length > 500) this.decisions.shift();

    console.log(`[gate] action=${action.type} decision=${decision.decision} reason=${decision.reason ?? "none"} snapshot=${decision.snapshotRevision}`);

    if (decision.decision === "deny") {
      return { decision, snapshot: this.snapshot };
    }

    if (action.type === ACTION_TYPE.PLACE_ORDER && this.snapshot.risk.status === "blocked") {
      this.falseAllowCount += 1;
      this.actionViolationCount += 1;
    }

    if (action.type === ACTION_TYPE.PLACE_ORDER) {
      this.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
        symbol: action.symbol ?? this.snapshot.market.symbol,
        side: action.side ?? this.snapshot.trade.side,
        quantity: action.quantity ?? this.snapshot.trade.quantity ?? 0.01,
        price: action.price ?? this.snapshot.market.lastPrice
      }));
    }

    return { decision, snapshot: this.snapshot };
  }

  getSnapshot() { return this.snapshot; }
  getEvents(limit = 100) { return this.events.slice(-limit); }
  getTransitions(limit = 100) { return this.transitions.slice(-limit); }

  getMarketInputIntegrityView(input?: any) {
    return this.getMarketInputIntegrityReport(input?.now ?? new Date());
  }

  getMarketInputView(input?: any) {
    const marketInput = this.snapshot.marketInput;
    const observations = Object.values(marketInput.observationsById ?? {}).filter((observation: any) => {
      if (input?.observationId && observation.observationId !== input.observationId) return false;
      if (input?.symbol && observation.symbol !== input.symbol) return false;
      return true;
    });
    return {
      status: marketInput.status,
      lastObservationId: marketInput.lastObservationId,
      lastValidObservationId: marketInput.lastValidObservationId,
      symbol: marketInput.symbol,
      channel: marketInput.channel,
      sourceName: marketInput.sourceName,
      lastSequence: marketInput.lastSequence,
      lastValidSequence: marketInput.lastValidSequence,
      observations,
      rejectedObservationIds: marketInput.rejectedObservationIds,
      gapObservationIds: marketInput.gapObservationIds,
      duplicateObservationIds: marketInput.duplicateObservationIds,
      staleObservationIds: marketInput.staleObservationIds,
      checksumMismatchObservationIds: marketInput.checksumMismatchObservationIds,
      issues: marketInput.issues
    };
  }

  getMarketInputStatus(input?: any) { return this.getMarketInputView(input); }
  getMarketObservationView(input?: any) { return this.getMarketInputView(input); }
  getMarketObservations(input?: any) { return this.getMarketInputView(input).observations; }
  getMarketDataIntegrityView(input?: any) { return this.getMarketInputIntegrityView(input); }
  verifyMarketInputIntegrity(input?: any) { return this.getMarketInputIntegrityView(input); }

  getCausalityTraceView(limit = 100) { return this.causalityTraces.slice(-limit); }
  getTraceView(limit = 100) { return this.getCausalityTraceView(limit); }

  getHashChainView(limit = 100) { return this.snapshotHashChain.slice(-limit); }
  getSnapshotHashChainView(limit = 100) { return this.getHashChainView(limit); }
  getSnapshotHashChain(limit = 100) { return this.getHashChainView(limit); }
  getHashChain(limit = 100) { return this.getHashChainView(limit); }
  getIntegrityView(input?: unknown) { return this.verifyHashChain(input); }

  verifyHashChain(input?: any) {
    const chain = Array.isArray(input?.chain) ? input.chain as any[] : this.snapshotHashChain;
    const reasons: string[] = [];
    if (chain.length === 0) {
      return { ok: true, status: "unknown", integrityStatus: "unknown", reasons: ["hash_chain_empty"], chainLength: 0 };
    }
    for (let i = 0; i < chain.length; i += 1) {
      const current = chain[i] as any;
      const previous = i > 0 ? chain[i - 1] as any : undefined;
      const continuity = verifyRevisionContinuity(previous, current);
      if (!continuity.ok) reasons.push(...continuity.reasons);
      const previousHash = previous?.snapshotHash ?? previous?.afterSnapshotHash ?? previous?.afterHash;
      const currentPreviousHash = current.previousSnapshotHash ?? current.previousHash ?? current.beforeHash ?? current.beforeSnapshotHash;
      if (previous && previousHash && currentPreviousHash && previousHash !== currentPreviousHash) {
        reasons.push("hash_mismatch");
        reasons.push("previous_snapshot_hash_mismatch");
      }
      if (previous && previousHash && currentPreviousHash === undefined) {
        reasons.push("previous_snapshot_hash_missing");
      }
      if (previous && current.revision !== undefined && previous.revision !== undefined && current.revision !== previous.revision + 1) {
        reasons.push("revision_gap");
      }
    }
    const uniqueReasons = Array.from(new Set(reasons));
    const ok = uniqueReasons.length === 0;
    return {
      ok,
      valid: ok,
      verified: ok,
      passed: ok,
      status: ok ? "valid" : "broken",
      integrityStatus: ok ? "valid" : "broken",
      reasons: uniqueReasons,
      blockingReasons: ok ? [] : ["integrity_hash_chain_broken"],
      domain: "integrity",
      chainLength: chain.length,
      chain
    };
  }

  verifySnapshotHashChain(input?: unknown) { return this.verifyHashChain(input); }
  verifyIntegrity(input?: unknown) { return this.verifyHashChain(input); }

  getCausalityTrace(input?: any) {
    const traces = this.getCausalityTraceView(typeof input === "number" ? input : 100);
    if (!input || typeof input !== "object") return traces;
    return traces.filter((trace) => {
      if (input.eventId && trace.eventId !== input.eventId) return false;
      if (input.actionType && !String(trace.eventType).includes(String(input.actionType))) return false;
      if (input.includeRejected && trace.transitionStatus !== "rejected") return false;
      if (input.includeActions && trace.transitionStatus !== "permission_evaluated") return false;
      return true;
    });
  }
  getCausalityView(input?: unknown) { return this.getCausalityTrace(input); }

  getDecisions(limit = 100) { return this.decisions.slice(-limit); }

  getIdempotencyView() {
    return {
      size: this.idempotencyIndex.size,
      diagnostics: this.idempotencyDiagnostics.slice(-50),
      duplicateEventCount: this.duplicateEventCount,
      conflictCount: this.idempotencyConflictCount
    };
  }

  getQuarantineView(limit = 100) {
    return this.quarantine.getView(limit);
  }

  getQuarantineRecords(limit = 100) {
    return this.quarantine.getRecords(limit);
  }

  getQuarantine(limit = 100) {
    return this.getQuarantineView(limit);
  }

  getQuarantinedEvents(limit = 100) {
    return this.getQuarantineRecords(limit);
  }

  getPermissionLedgerView(limit = 100) {
    return {
      count: this.permissionLedger.count(),
      records: this.permissionLedger.last(limit)
    };
  }

  getPermissionLedger(limit = 100) {
    return this.getPermissionLedgerView(limit);
  }

  getPermissionsLedgerView(limit = 100) {
    return this.getPermissionLedgerView(limit);
  }

  private recordPermissionDecision(decision: GateDecision, requestedBy = "RuntimeEngine") {
    const record = this.permissionLedger.record(decision, { requestedBy });
    const report = this.getCoreTrustReport({ causalityPhase: "permission_evaluated", actionId: decision.actionId });
    this.recordCausalityTrace(buildCausalityTrace({
      eventId: decision.actionId,
      eventType: `action.${decision.actionType}`,
      source: `PermissionLedger:${requestedBy}`,
      beforeSnapshot: this.snapshot,
      afterSnapshot: this.snapshot,
      beforeReport: report,
      afterReport: report,
      reducerName: "ActionGate.evaluate",
      transitionStatus: "permission_evaluated",
      gateVerdictAfter: decision,
      permissionRecord: record,
      generatedAt: record.decidedAt
    }));
    return record;
  }

  getPersistenceView() {
    return {
      status: this.persistence.getStatus(),
      replayCheck: this.replayCheck()
    };
  }


  resetPerformanceWindow() {
    this.lastCommitAtMs = undefined;
    this.commitLatencySamples = [];
    this.commitLatencyLastMs = 0;
    this.commitLatencyMaxMs = 0;
    return this.getMetrics();
  }


  getFreshness(now: string | Date = new Date()) {
    const health = this.getHealthSnapshot();
    return calculateFreshness({
      lastMarketEventAt: this.snapshot.market.lastTickAt,
      lastBookTickerAt: this.snapshot.market.bid !== undefined && this.snapshot.market.ask !== undefined ? this.snapshot.market.lastTickAt : undefined,
      lastExchangeReconcileAt: this.snapshot.exchangeTruth.lastPositionReconcileAt ?? this.snapshot.exchangeTruth.lastAccountReconcileAt ?? this.snapshot.exchangeTruth.lastOrderReconcileAt ?? this.snapshot.exchangeTruth.lastFillSyncAt,
      exchangeTruthStatus: this.snapshot.exchangeTruth.status,
      lastConnectionHeartbeatAt: health.connections.websocket.observedAt ?? this.snapshot.system.lastConnectionHeartbeatAt,
      connectionStatus: health.connections.websocket.status,
      maxMarketAgeMs: DEFAULT_FRESHNESS_CONFIG.maxMarketAgeMs,
      maxExchangeAgeMs: DEFAULT_FRESHNESS_CONFIG.maxExchangeAgeMs,
      maxConnectionAgeMs: DEFAULT_FRESHNESS_CONFIG.maxConnectionAgeMs
    }, {
      now,
      config: DEFAULT_FRESHNESS_CONFIG
    });
  }

  getPermissions() {
    const now = new Date();
    const freshness = this.getFreshness(now);
    const integrity = this.getIntegrityReport(now);
    const causality = this.getCausalityReport(undefined, undefined, undefined);
    const provenance = this.getProvenanceHealthReport(now);
    const marketInput = this.getMarketInputIntegrityReport(now);
    const actions = this.gate.evaluateAll(this.snapshot, { enforceFreshness: true, now, freshness, freshnessConfig: DEFAULT_FRESHNESS_CONFIG, integrity, causality, provenance, marketInput });
    const permissions = { snapshotRevision: this.snapshot.revision, tradingAllowed: actions.place_order.decision === "allow", freshness, actions };
    for (const decision of Object.values(permissions.actions)) {
      this.recordPermissionDecision(decision, "RuntimeEngine.getPermissions");
    }
    this.gateTransitionCount += Object.values(permissions.actions).length;
    this.decisions.push(...Object.values(permissions.actions));
    if (this.decisions.length > 500) this.decisions = this.decisions.slice(-500);
    return permissions;
  }

  getIntegrityReport(now: string | Date = new Date()): IntegrityReport {
    return buildIntegrityReport({
      snapshot: this.snapshot,
      lastEvent: this.events.at(-1),
      lastTransition: this.transitions.at(-1),
      checkedAt: now,
      provenance: this.getProvenanceHealthReport(now),
      marketInput: this.getMarketInputIntegrityReport(now)
    });
  }

  getProvenanceHealthReport(now: string | Date = new Date()): ProvenanceHealthReport {
    const provenance = this.snapshot.provenance;
    const records = Object.values(provenance?.records ?? {});
    const latest = records.at(-1);
    if (records.length > 0) {
      return buildProvenanceHealthReport({
        status: "complete",
        traceId: latest?.provenanceId,
        sourceEventId: latest?.originEventId,
        checkedAt: now,
        evidence: {
          source: "metadata-provenance-event",
          rule: "event_sourced_provenance_observed",
          recordCount: records.length
        }
      });
    }
    const lastTrace = this.getCausalityReport(undefined, undefined, undefined);
    return buildProvenanceHealthReport({
      status: "missing",
      traceId: lastTrace.lastTraceId,
      sourceEventId: lastTrace.lastEventId,
      checkedAt: now,
      evidence: {
        source: "runtime-no-provenance-events-yet",
        rule: "unknown_provenance_is_not_corruption_but_blocks_risk_increasing_actions"
      }
    });
  }

  getMarketInputIntegrityReport(now: string | Date = new Date()): MarketInputIntegrityReport {
    const marketInput = this.snapshot.marketInput;
    const observation = marketInput.lastObservationId
      ? marketInput.observationsById[marketInput.lastObservationId]
      : undefined;

    const mapStatus = (status: string): MarketInputIntegrityReport["status"] => {
      if (status === "validated" || status === "observed") return "valid";
      if (status === "stale_detected") return "stale";
      if (status === "gap_detected") return "gap_detected";
      if (status === "duplicate_detected") return "duplicate";
      if (status === "checksum_mismatch_detected") return "checksum_mismatch";
      if (status === "rejected") return "invalid";
      return "unknown";
    };

    const status = mapStatus(marketInput.status);
    const blockingReasons =
      observation && !observation.provenanceId
        ? [MARKET_INPUT_BLOCKING_REASON.MISSING_PROVENANCE]
        : undefined;

    return buildMarketInputIntegrityReport({
      status,
      blockingReasons,
      eventId: marketInput.lastObservationId,
      source: observation?.sourceType,
      provider: observation?.sourceName,
      sequence: observation?.sequence,
      observedAt: observation?.receivedTimestampFromEvent ?? observation?.exchangeTimestamp,
      provenanceId: observation?.provenanceId,
      checksum: observation?.checksum ?? observation?.bookChecksum,
      checkedAt: now,
      evidence: {
        source: "runtime-market-input-state",
        rule: observation ? "event_sourced_market_input_observed" : "market_input_not_observed",
        marketInputStatus: marketInput.status,
        issueCount: marketInput.issues.length,
        lastPayloadHash: marketInput.lastPayloadHash
      }
    });
  }

  getCausalityReport(
    trustStateBefore?: import("../../contracts/src/actions.js").KernelTrustState,
    trustStateAfter?: import("../../contracts/src/actions.js").KernelTrustState,
    gateVerdict?: GateDecision
  ): CausalityReport {
    return buildCausalityReport({
      lastEvent: this.events.at(-1),
      lastTransition: this.transitions.at(-1),
      trustStateBefore,
      trustStateAfter,
      gateVerdict
    });
  }

  evaluateAction(action: ActionRequest) {
    const now = new Date();
    const integrity = this.getIntegrityReport(now);
    const causality = this.getCausalityReport(undefined, undefined, undefined);
    const provenance = this.getProvenanceHealthReport(now);
    const marketInput = this.getMarketInputIntegrityReport(now);
    const decision = this.gate.evaluate(action, this.snapshot, { enforceFreshness: true, now, freshness: this.getFreshness(now), freshnessConfig: DEFAULT_FRESHNESS_CONFIG, integrity, causality, provenance, marketInput });
    return decision;
  }


  getCoreTrustReport(metadata: Record<string, unknown> = {}): CoreTrustReport {
    const now = new Date();
    const freshness = this.getFreshness(now);
    const integrity = this.getIntegrityReport(now);
    const causalitySeed = this.getCausalityReport(undefined, undefined, undefined);
    const provenance = this.getProvenanceHealthReport(now);
    const marketInput = this.getMarketInputIntegrityReport(now);
    const actions = this.gate.evaluateAll(this.snapshot, {
      enforceFreshness: true,
      now,
      freshness,
      freshnessConfig: DEFAULT_FRESHNESS_CONFIG,
      integrity,
      causality: causalitySeed,
      provenance,
      marketInput
    });
    const causality = this.getCausalityReport(undefined, undefined, actions.place_order);
    const healthTruth = this.getHealthSnapshot();
    const replay = this.replayCheck();
    const invariants = this.getInvariants();

    return buildCoreTrustReport({
      snapshot: this.snapshot,
      permissions: {
        tradingAllowed: actions.place_order.decision === "allow",
        actions
      },
      freshness,
      healthTruth,
      replay,
      invariants,
      lastEvent: this.events.at(-1),
      lastTransition: this.transitions.at(-1),
      integrity,
      causality,
      provenance,
      marketInput,
      metadata: {
        runtime: this.getRuntimeView(),
        idempotency: this.getIdempotencyView(),
        quarantine: this.getQuarantineView(20),
        permissionLedger: this.getPermissionLedgerView(20),
        ...metadata
      }
    });
  }



  getProvenanceView(input: Record<string, unknown> = {}) {
    const provenanceId = typeof input?.provenanceId === "string" ? input.provenanceId : undefined;
    const records = Object.values(this.snapshot.provenance.records ?? {})
      .filter((record) => !provenanceId || record.provenanceId === provenanceId);
    const metadata = Object.values(this.snapshot.provenance.metadataById ?? {})
      .filter((record) => !provenanceId || record.provenanceId === provenanceId);
    return {
      status: this.snapshot.provenance.status,
      records,
      metadata,
      count: records.length,
      metadataCount: metadata.length
    };
  }

  getProvenanceRecords(input: Record<string, unknown> = {}) {
    return this.getProvenanceView(input);
  }

  getMetadataEvents(input: Record<string, unknown> = {}) {
    return this.getProvenanceView(input);
  }

  getProvenance(input: Record<string, unknown> = {}) {
    return this.getProvenanceView(input);
  }

  getRecoveryPlan(input: Record<string, unknown> = {}): RecoveryPlan {
    const lastActionGateVerdict = this.decisions.at(-1);
    const plan = planRecovery({
      coreTrustReport: this.getCoreTrustReport({ recoveryInput: input }),
      quarantineSummary: { ...this.quarantine.getSummary() },
      lastActionGateVerdict
    });

    const integrity = input.integrity as { ok?: boolean; status?: string; reasons?: string[] } | undefined;
    if (integrity && integrity.ok === false) {
      return {
        ...plan,
        required: true,
        mode: plan.mode === "none" ? "forensic_review" : plan.mode,
        reasons: Array.from(new Set([...plan.reasons, "integrity_broken", ...(integrity.reasons ?? [])])),
        nextActions: Array.from(new Set([...plan.nextActions, "RUN_REPLAY_CHECK", "MANUAL_REVIEW"] as any)),
        priority: plan.priority === "critical" ? "critical" : "high",
        manualReviewRequired: true
      };
    }

    return plan;
  }

  getRecoveryPlannerView(input: Record<string, unknown> = {}) {
    return this.getRecoveryPlan(input);
  }

  getRecoverySuggestions(input: Record<string, unknown> = {}) {
    return this.getRecoveryPlan(input).nextActions;
  }

  planRecovery(input: Record<string, unknown> = {}) {
    return this.getRecoveryPlan(input);
  }

  getMetrics(): RuntimeMetrics {
    const now = Date.now();
    const uptimeMs = now - this.startedAt;
    const avgLatency =
      this.commitLatencySamples.length === 0
        ? 0
        : this.commitLatencySamples.reduce((sum, value) => sum + value, 0) / this.commitLatencySamples.length;

    const timeSinceLastCommitMs = this.lastCommitAtMs ? now - this.lastCommitAtMs : undefined;
    const totalActions = this.decisions.length + this.actionViolationCount;
    const rejectRate = totalActions === 0 ? 0 : this.decisions.filter((d) => d.decision === "deny").length / totalActions;

    return {
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeMs,
      totalEvents: this.totalEventCount,
      totalTransitions: this.snapshot.revision,
      totalDecisions: this.decisions.length,
      eventsPerSecond: uptimeMs > 0 ? Number((this.totalEventCount / (uptimeMs / 1000)).toFixed(3)) : 0,
      lastCommitAt: this.lastCommitAtMs ? new Date(this.lastCommitAtMs).toISOString() : undefined,
      timeSinceLastCommitMs,
      commitLatencyMs: {
        last: this.commitLatencyLastMs,
        avg: Number(avgLatency.toFixed(3)),
        max: this.commitLatencyMaxMs
      },
      backlogDepth: Math.max(0, this.totalEventCount - this.snapshot.revision),
      rejectRate: Number(rejectRate.toFixed(4)),
      falseAllowCount: this.falseAllowCount,
      actionViolationCount: this.actionViolationCount,
      uncertaintyTransitionCount: this.uncertaintyTransitionCount,
      gateTransitionCount: this.gateTransitionCount,
      snapshotRevision: this.snapshot.revision,
      snapshotStalled: Boolean(timeSinceLastCommitMs !== undefined && timeSinceLastCommitMs > 5000),
      duplicateEventCount: this.duplicateEventCount,
      idempotencyConflictCount: this.idempotencyConflictCount,
      quarantineCount: this.quarantine.count,
      permissionLedgerCount: this.permissionLedger.count()
    };
  }

  getRuntimeView() {
    return {
      engine: "genesis-v1",
      mode: "live-paper-readonly+persistent",
      flow: ["Bootstrap", "Market", "Signal", "Trade", "Gate", "Order", "Position", "Risk", "System", "API/UI"],
      snapshotRevision: this.snapshot.revision,
      committedAt: this.snapshot.committedAt,
      eventCount: this.totalEventCount,
      transitionCount: this.transitions.length,
      decisionCount: this.decisions.length,
      stateDomains: {
        bootstrap: this.snapshot.bootstrap.status,
        exchangeTruth: this.snapshot.exchangeTruth.status,
        market: this.snapshot.market.status,
        trade: this.snapshot.trade.status,
        order: this.snapshot.order.status,
        position: this.snapshot.position.status,
        risk: this.snapshot.risk.status,
        system: this.snapshot.system.status
      },
      metrics: this.getMetrics(),
      quarantine: this.quarantine.getSummary(),
      permissionLedger: { count: this.permissionLedger.count() },
      persistence: this.persistence.getStatus()
    };
  }

  getEntitiesView() {
    return {
      currentState: this.snapshot,
      stateDomains: {
        BootstrapState: this.snapshot.bootstrap,
        ExchangeTruthState: this.snapshot.exchangeTruth,
        MarketState: this.snapshot.market,
        TradeState: this.snapshot.trade,
        OrderState: this.snapshot.order,
        PositionState: this.snapshot.position,
        RiskState: this.snapshot.risk,
        SystemState: this.snapshot.system
      },
      journal: {
        description: "append-only domain events; this is history, not current state",
        lastEvents: this.getEvents(20)
      },
      transitions: {
        description: "deterministic state changes produced by reducers",
        lastTransitions: this.getTransitions(20)
      },
      permissions: this.getPermissions(),
      quarantine: this.getQuarantineView(20),
      permissionLedger: this.getPermissionLedgerView(20),
      recovery: this.getRecoveryPlan({ source: "entities_view" }),
      persistence: this.getPersistenceView()
    };
  }

  getInvariants(): InvariantCheck[] {
    const s = this.snapshot;
    const lastEvent = this.events.at(-1);
    const lastTransition = this.transitions.at(-1);
    const replay = this.replayCheck();

    return [
      {
        name: "snapshot_revision_matches_event_count",
        ok: s.revision === this.totalEventCount,
        details: `snapshot.revision=${s.revision}, eventCount=${this.totalEventCount}`
      },
      {
        name: "last_transition_points_to_last_event",
        ok: !lastEvent || lastTransition?.eventId === lastEvent.eventId,
        details: `lastEvent=${lastEvent?.eventId ?? "none"}, lastTransition=${lastTransition?.eventId ?? "none"}`
      },
      {
        name: "market_source_event_exists_when_open",
        ok: s.market.status !== "open" || Boolean(s.market.meta.sourceEventId),
        details: `market.status=${s.market.status}, sourceEventId=${s.market.meta.sourceEventId ?? "none"}`
      },
      {
        name: "permissions_use_current_snapshot",
        ok: this.gate.evaluateAll(s).place_order.snapshotRevision === s.revision,
        details: `snapshot.revision=${s.revision}`
      },
      {
        name: "bootstrap_blocks_place_order_until_reconciled",
        ok: s.bootstrap.status === "reconciled" || this.gate.evaluateAll(s).place_order.decision === "deny",
        details: `bootstrap.status=${s.bootstrap.status}, place_order=${this.gate.evaluateAll(s).place_order.decision}`
      },
      {
        name: "bootstrap_failed_is_not_reconciled",
        ok: s.bootstrap.status !== "failed" || this.gate.evaluateAll(s).place_order.reason === "bootstrap_failed",
        details: `bootstrap.status=${s.bootstrap.status}, place_order_reason=${this.gate.evaluateAll(s).place_order.reason ?? "none"}`
      },
      {
        name: "exchange_truth_blocks_place_order_until_fresh",
        ok: s.exchangeTruth.status === "fresh" || this.gate.evaluateAll(s).place_order.decision === "deny",
        details: `exchangeTruth.status=${s.exchangeTruth.status}, place_order=${this.gate.evaluateAll(s).place_order.decision}`
      },
      {
        name: "risk_blocks_non_fresh_exchange_truth",
        ok: s.exchangeTruth.status === "fresh" || s.risk.status === "blocked",
        details: `exchangeTruth.status=${s.exchangeTruth.status}, risk.status=${s.risk.status}`
      },
      {
        name: "risk_blocks_unknown_position",
        ok: s.position.status !== "unknown" || s.risk.status === "blocked",
        details: `position.status=${s.position.status}, risk.status=${s.risk.status}`
      },
      {
        name: "risk_blocks_uncertain_order",
        ok: s.order.status !== "uncertain" || s.risk.status === "blocked",
        details: `order.status=${s.order.status}, risk.status=${s.risk.status}`
      },
      {
        name: "system_reflects_risk_block",
        ok: s.risk.status !== "blocked" || s.system.status === "bootstrapping" || s.system.status === "degraded" || s.system.status === "halted",
        details: `risk.status=${s.risk.status}, system.status=${s.system.status}`
      },
      {
        name: "no_runtime_backlog",
        ok: this.getMetrics().backlogDepth === 0,
        details: `backlogDepth=${this.getMetrics().backlogDepth}`
      },
      {
        name: "no_false_allow",
        ok: this.falseAllowCount === 0,
        details: `falseAllowCount=${this.falseAllowCount}`
      },
      {
        name: "commit_latency_bounded",
        ok: this.getMetrics().commitLatencyMs.max < 500,
        details: `maxCommitLatencyMs=${this.getMetrics().commitLatencyMs.max}`
      },
      {
        name: "no_idempotency_conflicts",
        ok: this.idempotencyConflictCount === 0,
        details: `idempotencyConflictCount=${this.idempotencyConflictCount}`
      },
      {
        name: "replay_matches_current_snapshot",
        ok: replay.ok,
        details: `currentRevision=${replay.currentRevision}, replayRevision=${replay.replayRevision}, eventCount=${replay.eventCount}`
      }
    ];
  }
}

export const runtimeEngine = new RuntimeEngine();
