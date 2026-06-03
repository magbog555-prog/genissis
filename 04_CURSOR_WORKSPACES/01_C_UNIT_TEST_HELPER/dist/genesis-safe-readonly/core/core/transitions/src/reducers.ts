import { DomainEvent, EVENT_TYPE, ExchangeTruthPayload, MarketTickPayload, SignalPayload, MetadataAttachedPayload, ProvenanceRecordedPayload, ProvenanceRef, MarketInputPayload } from "../../contracts/src/events.js";
import { validateMarketInputObservation } from "../../market-input/market-input-validation.js";
import { RuntimeSnapshot, BootstrapState, ExchangeTruthState, MarketState, TradeState, OrderState, PositionState, RiskState, SystemState, ProvenanceState, MetadataAttachment, MarketInputState, MarketInputObservation, MarketInputIssue } from "../../state/src/types.js";

function meta(prevRev: number, event: DomainEvent) {
  return { revision: prevRev + 1, updatedAt: event.timestamp, sourceEventId: event.eventId };
}


function bootstrapReason(status: BootstrapState["status"]) {
  if (status === "failed") return "bootstrap_failed";
  if (status === "awaiting_exchange_truth") return "bootstrap_awaiting_exchange_truth";
  if (status === "reconciled") return undefined;
  return "bootstrap_not_reconciled";
}

export function reduceBootstrapState(prev: BootstrapState, event: DomainEvent): BootstrapState {
  const t = event.timestamp;
  const p: any = event.payload ?? {};
  const reason = String(p.reason ?? bootstrapReason(prev.status) ?? "bootstrap_not_reconciled");
  const quarantineRequired = Boolean(p.quarantineRequired ?? prev.quarantineRequired);

  if (event.eventType === EVENT_TYPE.BOOTSTRAP_FAILED) {
    return {
      status: "failed",
      quarantineRequired: Boolean(p.quarantineRequired ?? true),
      reasons: [String(p.reason ?? "bootstrap_failed")],
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.BOOTSTRAP_RECOVERY_STARTED) {
    if (prev.status !== "failed") return prev;
    return {
      status: "loading_snapshot",
      quarantineRequired: false,
      reasons: ["bootstrap_not_reconciled"],
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT) {
    if (prev.status !== "cold") return prev;
    return {
      status: "loading_snapshot",
      quarantineRequired,
      reasons: ["bootstrap_not_reconciled"],
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL) {
    if (prev.status !== "loading_snapshot") return prev;
    return {
      status: "replaying_tail",
      quarantineRequired,
      reasons: ["bootstrap_not_reconciled"],
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH) {
    if (prev.status !== "replaying_tail") return prev;
    return {
      status: "awaiting_exchange_truth",
      quarantineRequired,
      reasons: ["bootstrap_awaiting_exchange_truth"],
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.BOOTSTRAP_RECONCILED) {
    if (prev.status !== "awaiting_exchange_truth") return prev;
    return {
      status: "reconciled",
      quarantineRequired: false,
      reasons: [],
      meta: meta(prev.meta.revision, event)
    };
  }

  return prev;
}


function exchangeTruthBlockReason(status: ExchangeTruthState["status"]) {
  if (status === "fresh") return undefined;
  if (status === "stale") return "exchange_truth_stale";
  if (status === "conflicted") return "exchange_truth_conflicted";
  if (status === "unavailable") return "exchange_truth_unavailable";
  return "exchange_truth_unknown";
}

function toIso(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function payloadConflicts(payload: ExchangeTruthPayload | any) {
  return Array.isArray(payload.conflicts) ? payload.conflicts : [];
}

function payloadDrift(payload: ExchangeTruthPayload | any) {
  return payload.drift && typeof payload.drift === "object" && !Array.isArray(payload.drift) ? payload.drift : {};
}

function positionConflictFromPayload(ctx: RuntimeSnapshot, payload: ExchangeTruthPayload | any) {
  const exchangeStatus = payload.exchangePositionStatus;
  const localStatus = payload.localPositionStatus ?? ctx.position.status;
  const exchangeQuantity = Number(payload.exchangePositionQuantity ?? 0);
  const exchangeOpen = exchangeStatus === "open" || Math.abs(exchangeQuantity) > 0;
  const localFlat = localStatus === "flat" || (ctx.position.status === "flat" && Math.abs(Number(ctx.position.quantity ?? 0)) === 0);

  if (localFlat && exchangeOpen) {
    return {
      code: "local_flat_exchange_open",
      local: "flat",
      exchange: "open",
      details: "local position is flat while exchange reports an open position"
    };
  }

  return undefined;
}

export function reduceExchangeTruthState(prev: ExchangeTruthState, event: DomainEvent, ctx: RuntimeSnapshot): ExchangeTruthState {
  const p = (event.payload ?? {}) as ExchangeTruthPayload | any;
  const t = event.timestamp;
  const base = {
    lastAccountReconcileAt: prev.lastAccountReconcileAt,
    lastPositionReconcileAt: prev.lastPositionReconcileAt,
    lastOrderReconcileAt: prev.lastOrderReconcileAt,
    lastFillSyncAt: prev.lastFillSyncAt,
    source: p.source ?? event.source ?? prev.source,
    drift: payloadDrift(p),
    conflicts: payloadConflicts(p),
    reason: p.reason ?? prev.reason,
    meta: meta(prev.meta.revision, event)
  };

  if (event.eventType === EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_STARTED) {
    return {
      ...prev,
      source: p.source ?? event.source ?? prev.source,
      reason: p.reason ?? "exchange_truth_reconcile_started",
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED) {
    const derivedConflict = positionConflictFromPayload(ctx, p);
    const conflicts = derivedConflict ? [...payloadConflicts(p), derivedConflict] : payloadConflicts(p);
    const status = conflicts.length > 0 ? "conflicted" : "fresh";
    return {
      status,
      lastAccountReconcileAt: toIso(p.lastAccountReconcileAt, t),
      lastPositionReconcileAt: toIso(p.lastPositionReconcileAt, t),
      lastOrderReconcileAt: toIso(p.lastOrderReconcileAt, t),
      lastFillSyncAt: toIso(p.lastFillSyncAt, t),
      source: p.source ?? event.source ?? "exchange_reconcile",
      drift: payloadDrift(p),
      conflicts,
      reason: status === "conflicted" ? "exchange_truth_conflicted" : undefined,
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_FAILED) {
    return {
      ...base,
      status: "unavailable",
      reason: p.reason ?? "exchange_truth_reconcile_failed"
    };
  }

  if (event.eventType === EVENT_TYPE.EXCHANGE_TRUTH_STALE_DETECTED) {
    return {
      ...base,
      status: "stale",
      reason: p.reason ?? "exchange_truth_stale"
    };
  }

  if (event.eventType === EVENT_TYPE.EXCHANGE_TRUTH_CONFLICT_DETECTED) {
    const derivedConflict = positionConflictFromPayload(ctx, p);
    const conflicts = derivedConflict ? [...payloadConflicts(p), derivedConflict] : payloadConflicts(p);
    return {
      ...base,
      status: "conflicted",
      conflicts: conflicts.length ? conflicts : [{ code: "exchange_truth_conflict", details: p.reason ?? "exchange truth conflict detected" }],
      reason: p.reason ?? "exchange_truth_conflicted"
    };
  }

  if (event.eventType === EVENT_TYPE.EXCHANGE_TRUTH_UNAVAILABLE_DETECTED) {
    return {
      ...base,
      status: "unavailable",
      reason: p.reason ?? "exchange_truth_unavailable"
    };
  }

  return prev;
}

export { exchangeTruthBlockReason };


const METADATA_EVENT_TYPES = new Set<string>([
  EVENT_TYPE.METADATA_ATTACHED,
  EVENT_TYPE.PROVENANCE_RECORDED,
  EVENT_TYPE.ACTION_PROVENANCE_RECORDED,
  EVENT_TYPE.TRADE_PROVENANCE_RECORDED,
  EVENT_TYPE.FILL_PROVENANCE_RECORDED,
  EVENT_TYPE.PNL_PROVENANCE_RECORDED,
  EVENT_TYPE.METADATA_PROVENANCE_ATTACHED,
  EVENT_TYPE.METADATA_PROVENANCE_RECORDED,
  EVENT_TYPE.METADATA_PROVENANCE_ACTION_RECORDED,
  EVENT_TYPE.METADATA_PROVENANCE_TRADE_RECORDED,
  EVENT_TYPE.METADATA_PROVENANCE_FILL_RECORDED,
  EVENT_TYPE.METADATA_PROVENANCE_PNL_RECORDED,
  EVENT_TYPE.METADATA_PROVENANCE_MISMATCH_DETECTED
]);

function isMetadataEvent(event: DomainEvent): boolean {
  return METADATA_EVENT_TYPES.has(event.eventType);
}

function provenanceFromPayload(event: DomainEvent): ProvenanceRef | undefined {
  const p: any = event.payload ?? {};
  const candidate: any =
    p.provenance && typeof p.provenance === "object"
      ? p.provenance
      : p.provenanceRef && typeof p.provenanceRef === "object"
        ? p.provenanceRef
        : p;
  if (!candidate || typeof candidate !== "object") return undefined;

  const targetId = candidate.targetId ?? candidate.subjectId ?? p.target?.id;
  const originType = candidate.originType ?? candidate.subjectType ?? p.target?.type ?? "unknown";

  return {
    provenanceId: String(candidate.provenanceId),
    originType,
    originEventId: String(candidate.originEventId ?? event.eventId),
    targetId: String(targetId),
    parentProvenanceIds: Array.isArray(candidate.parentProvenanceIds)
      ? candidate.parentProvenanceIds.map(String)
      : [],
    source: String(candidate.source ?? candidate.sourceSystem ?? p.source ?? event.source ?? "unknown"),
    confidence: Number(candidate.confidence ?? 1),
    createdAtFromEvent: String(candidate.createdAtFromEvent ?? candidate.createdAt ?? event.timestamp)
  };
}

function sameRecord(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function reduceProvenanceState(prev: ProvenanceState, event: DomainEvent): ProvenanceState {
  if (!isMetadataEvent(event)) return prev;
  if (prev.appliedEventIds[event.eventId]) return prev;

  const provenance = provenanceFromPayload(event);
  if (!provenance || !provenance.provenanceId || !provenance.targetId) return prev;

  const existing = prev.records[provenance.provenanceId];
  const nextRecords = existing
    ? prev.records
    : { ...prev.records, [provenance.provenanceId]: provenance };

  const p: any = event.payload ?? {};
  let nextMetadataById = prev.metadataById;
  let nextMetadataByTarget = prev.metadataByTarget;
  let changed = !existing;

  if (event.eventType === EVENT_TYPE.METADATA_ATTACHED || event.eventType === EVENT_TYPE.METADATA_PROVENANCE_ATTACHED) {
    const payload = p as MetadataAttachedPayload;
    const metadataId = String((payload as any).metadataId ?? event.eventId);
    const existingMetadata = prev.metadataById[metadataId];
    const metadata: MetadataAttachment = {
      metadataId,
      targetId: String((payload as any).targetId ?? (payload as any).target?.id ?? provenance.targetId),
      key: String((payload as any).key ?? "provenanceRef"),
      value: (payload as any).value ?? (payload as any).provenanceRef ?? provenance,
      provenanceId: provenance.provenanceId,
      createdAtFromEvent: String((payload as any).createdAtFromEvent ?? provenance.createdAtFromEvent),
      sourceEventId: event.eventId
    };

    if (!existingMetadata) {
      nextMetadataById = { ...nextMetadataById, [metadataId]: metadata };
      const targetIds = nextMetadataByTarget[metadata.targetId] ?? [];
      nextMetadataByTarget = {
        ...nextMetadataByTarget,
        [metadata.targetId]: targetIds.includes(metadataId) ? targetIds : [...targetIds, metadataId]
      };
      changed = true;
    } else if (!sameRecord(existingMetadata, metadata)) {
      // Conflicting metadata with the same metadataId is intentionally ignored here.
      // Conflict classification belongs to validation/idempotency/quarantine, not reducer mutation.
      changed = changed || false;
    }
  }

  if (!changed) {
    return {
      ...prev,
      appliedEventIds: { ...prev.appliedEventIds, [event.eventId]: true },
      meta: meta(prev.meta.revision, event)
    };
  }

  return {
    status: "recorded",
    records: nextRecords,
    metadataById: nextMetadataById,
    metadataByTarget: nextMetadataByTarget,
    appliedEventIds: { ...prev.appliedEventIds, [event.eventId]: true },
    meta: meta(prev.meta.revision, event)
  };
}



const MARKET_INPUT_EVENT_TYPES = new Set<string>([
  EVENT_TYPE.MARKET_INPUT_OBSERVED,
  EVENT_TYPE.MARKET_INPUT_VALIDATED,
  EVENT_TYPE.MARKET_INPUT_REJECTED,
  EVENT_TYPE.MARKET_INPUT_GAP_DETECTED,
  EVENT_TYPE.MARKET_INPUT_DUPLICATE_DETECTED,
  EVENT_TYPE.MARKET_INPUT_STALE_DETECTED,
  EVENT_TYPE.MARKET_INPUT_CHECKSUM_MISMATCH_DETECTED
]);

function isMarketInputEvent(event: DomainEvent): boolean {
  return MARKET_INPUT_EVENT_TYPES.has(event.eventType);
}

function marketInputObservation(event: DomainEvent): MarketInputObservation | undefined {
  const p: any = event.payload ?? {};
  const observation = p.observation && typeof p.observation === "object" ? p.observation : p;
  if (!observation || typeof observation !== "object") return undefined;
  return observation as MarketInputObservation;
}

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function marketInputStatusFromEvent(event: DomainEvent, validationStatus: string): MarketInputState["status"] {
  if (event.eventType === EVENT_TYPE.MARKET_INPUT_VALIDATED) return "validated";
  if (event.eventType === EVENT_TYPE.MARKET_INPUT_REJECTED) return "rejected";
  if (event.eventType === EVENT_TYPE.MARKET_INPUT_GAP_DETECTED) return "gap_detected";
  if (event.eventType === EVENT_TYPE.MARKET_INPUT_DUPLICATE_DETECTED) return "duplicate_detected";
  if (event.eventType === EVENT_TYPE.MARKET_INPUT_STALE_DETECTED) return "stale_detected";
  if (event.eventType === EVENT_TYPE.MARKET_INPUT_CHECKSUM_MISMATCH_DETECTED) return "checksum_mismatch_detected";
  if (validationStatus === "valid") return "validated";
  if (validationStatus === "gap_detected") return "gap_detected";
  if (validationStatus === "duplicate_detected") return "duplicate_detected";
  if (validationStatus === "stale_detected") return "stale_detected";
  if (validationStatus === "checksum_mismatch_detected") return "checksum_mismatch_detected";
  if (validationStatus === "rejected") return "rejected";
  return "observed";
}

export function reduceMarketInputState(prev: MarketInputState, event: DomainEvent): MarketInputState {
  if (!isMarketInputEvent(event)) return prev;

  const observation = marketInputObservation(event);
  if (!observation || !observation.observationId) return prev;

  if (prev.observationsById[observation.observationId]) {
    return prev;
  }

  const explicitIssues = Array.isArray((event.payload as any)?.issues)
    ? ((event.payload as any).issues as MarketInputIssue[])
    : [];
  const validation = validateMarketInputObservation(observation, {
    lastSequence: prev.lastSequence,
    lastObservationId: prev.lastObservationId
  });
  const issues = explicitIssues.length > 0 ? explicitIssues : validation.issues;
  const explicitStatus = String((event.payload as any)?.validationStatus ?? "");
  const derivedStatus = marketInputStatusFromEvent(event, explicitStatus || validation.status);
  const status: MarketInputState["status"] =
    validation.status === "gap_detected" || derivedStatus === "gap_detected"
      ? "gap_detected"
      : validation.status === "duplicate_detected" || derivedStatus === "duplicate_detected"
        ? "duplicate_detected"
        : validation.status === "stale_detected" || derivedStatus === "stale_detected"
          ? "stale_detected"
          : validation.status === "checksum_mismatch_detected" || derivedStatus === "checksum_mismatch_detected"
            ? "checksum_mismatch_detected"
            : validation.status === "rejected" || derivedStatus === "rejected"
              ? "rejected"
              : derivedStatus;

  const nextObservations = { ...prev.observationsById, [observation.observationId]: observation };
  const isTrustedInput = status === "validated" || status === "observed";

  return {
    status,
    lastObservationId: observation.observationId,
    lastValidObservationId: isTrustedInput ? observation.observationId : prev.lastValidObservationId,
    symbol: observation.symbol ?? prev.symbol,
    channel: observation.channel ?? prev.channel,
    sourceName: observation.sourceName ?? prev.sourceName,
    lastSequence: isTrustedInput ? observation.sequence : prev.lastSequence,
    lastValidSequence: isTrustedInput ? observation.sequence : prev.lastValidSequence,
    lastExchangeTimestamp: observation.exchangeTimestamp ?? prev.lastExchangeTimestamp,
    lastReceivedTimestampFromEvent: observation.receivedTimestampFromEvent ?? prev.lastReceivedTimestampFromEvent,
    lastPayloadHash: observation.payloadHash ?? prev.lastPayloadHash,
    lastProvenanceId: observation.provenanceId ?? prev.lastProvenanceId,
    observationsById: nextObservations,
    rejectedObservationIds: status === "rejected" ? appendUnique(prev.rejectedObservationIds, observation.observationId) : prev.rejectedObservationIds,
    gapObservationIds: status === "gap_detected" ? appendUnique(prev.gapObservationIds, observation.observationId) : prev.gapObservationIds,
    duplicateObservationIds: status === "duplicate_detected" ? appendUnique(prev.duplicateObservationIds, observation.observationId) : prev.duplicateObservationIds,
    staleObservationIds: status === "stale_detected" ? appendUnique(prev.staleObservationIds, observation.observationId) : prev.staleObservationIds,
    checksumMismatchObservationIds: status === "checksum_mismatch_detected" ? appendUnique(prev.checksumMismatchObservationIds, observation.observationId) : prev.checksumMismatchObservationIds,
    issues: issues.map((issue) => ({ code: issue.code, path: issue.path, message: issue.message })),
    meta: meta(prev.meta.revision, event)
  };
}

export function reduceMarketState(prev: MarketState, event: DomainEvent): MarketState {
  if (event.eventType !== EVENT_TYPE.MARKET_TICK_RECEIVED) return prev;
  const p = event.payload as MarketTickPayload;
  const lastTick = new Date(event.timestamp).getTime();
  return {
    status: "open",
    symbol: p.symbol,
    lastPrice: p.price,
    bid: p.bid,
    ask: p.ask,
    volume: p.volume,
    lastTickAt: event.timestamp,
    freshnessMs: 0,
    provider: p.provider ?? "unknown",
    meta: meta(prev.meta.revision, event)
  };
}

export function reduceTradeState(prev: TradeState, event: DomainEvent): TradeState {
  if (event.eventType !== EVENT_TYPE.SIGNAL_RECEIVED) return prev;
  const p = event.payload as SignalPayload;
  return {
    status: p.confidence >= 0.5 ? "signal_ready" : "blocked",
    tradeId: event.eventId,
    symbol: p.symbol,
    side: p.side,
    quantity: p.quantity,
    confidence: p.confidence,
    reason: p.reason,
    meta: meta(prev.meta.revision, event)
  };
}

export function reduceOrderState(prev: OrderState, event: DomainEvent): OrderState {
  if (event.eventType === EVENT_TYPE.ORDER_UNCERTAIN) {
    return { ...prev, status: "uncertain", meta: meta(prev.meta.revision, event) };
  }

  if (event.eventType === EVENT_TYPE.ORDER_EXECUTION_REPORTED) {
    const p: any = event.payload;
    const exchangeStatus = String(p.exchangeStatus ?? "").toUpperCase();
    const quantity = Number(p.quantity ?? prev.quantity ?? 0);
    const filledQuantity = Number(p.filledQuantity ?? prev.filledQuantity ?? 0);
    const mappedStatus = exchangeStatus === "FILLED" || (quantity > 0 && filledQuantity >= quantity)
      ? "filled"
      : filledQuantity > 0
        ? "partially_filled"
        : prev.status;
    return {
      ...prev,
      status: mappedStatus as any,
      orderId: String(p.orderId ?? prev.orderId ?? ""),
      clientOrderId: p.clientOrderId ?? prev.clientOrderId,
      symbol: p.symbol ?? prev.symbol,
      side: (p.side ? String(p.side).toLowerCase() : prev.side) as any,
      quantity,
      filledQuantity,
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.ORDER_CANCELED) {
    const p: any = event.payload;
    return {
      ...prev,
      status: "settling", // 🧠 POST-CANCEL: ждём late fills
      orderId: String(p.orderId ?? prev.orderId ?? ""),
      clientOrderId: p.clientOrderId ?? prev.clientOrderId,
      symbol: p.symbol ?? prev.symbol,
      side: (p.side ? String(p.side).toLowerCase() : prev.side) as any,
      quantity: Number(p.quantity ?? prev.quantity ?? 0),
      filledQuantity: Number(p.filledQuantity ?? prev.filledQuantity ?? 0),
      meta: meta(prev.meta.revision, event)
    };
  }
  if (event.eventType === EVENT_TYPE.ORDER_RECONCILED) {
    const p: any = event.payload;
    const status = String(p.exchangeStatus ?? "").toUpperCase();
    const mappedStatus = status === "CANCELED" ? "canceled"
      : status === "FILLED" ? "filled"
      : status === "PARTIALLY_FILLED" ? "partially_filled"
      : status === "NEW" ? "pending"
      : prev.status;
    return {
      ...prev,
      status: mappedStatus as any,
      orderId: String(p.orderId ?? prev.orderId ?? ""),
      clientOrderId: p.clientOrderId ?? prev.clientOrderId,
      symbol: p.symbol ?? prev.symbol,
      side: (p.side ? String(p.side).toLowerCase() : prev.side) as any,
      quantity: Number(p.quantity ?? p.origQty ?? prev.quantity ?? 0),
      filledQuantity: Number(p.filledQuantity ?? p.executedQty ?? prev.filledQuantity ?? 0),
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.ORDER_REQUESTED) {
    const p: any = event.payload;
    return {
      status: "pending",
      orderId: p.orderId ?? `paper_${event.eventId}`,
      clientOrderId: p.clientOrderId ?? event.eventId,
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      filledQuantity: 0,
      meta: meta(prev.meta.revision, event)
    };
  }
  return prev;
}

export function reducePositionState(prev: PositionState, event: DomainEvent): PositionState {
  if (event.eventType === EVENT_TYPE.POSITION_UNKNOWN) {
    return { ...prev, status: "unknown", meta: meta(prev.meta.revision, event) };
  }

  if (event.eventType === EVENT_TYPE.ORDER_EXECUTION_REPORTED) {
    const p: any = event.payload;
    const fillDelta = Number(p.filledQuantityDelta ?? 0);
    if (!Number.isFinite(fillDelta) || fillDelta <= 0) return prev;

    const side = String(p.side ?? "").toLowerCase();
    const direction = side === "sell" ? -1 : 1;
    const markPrice = Number(p.fillPrice ?? p.markPrice ?? prev.markPrice ?? 0);
    const quantity = Number((Number(prev.quantity ?? 0) + direction * fillDelta).toFixed(12));
    const exposure = Number(Math.abs(quantity * markPrice).toFixed(8));
    const free = Number((Number(prev.free ?? prev.quantity ?? 0) + direction * fillDelta).toFixed(12));

    return {
      status: Math.abs(quantity) > 0 ? "open" : "flat",
      symbol: p.symbol ?? prev.symbol,
      asset: prev.asset ?? String(p.symbol ?? "").replace(/USDT$/, ""),
      quoteAsset: prev.quoteAsset ?? "USDT",
      quantity,
      free,
      locked: prev.locked ?? 0,
      exposure,
      markPrice,
      source: "runtime",
      lastReconciledAt: prev.lastReconciledAt,
      meta: meta(prev.meta.revision, event)
    };
  }

  if (event.eventType === EVENT_TYPE.POSITION_RECONCILED) {
    const p: any = event.payload;
    const quantity = Number(p.quantity ?? 0);
    const free = Number(p.free ?? quantity);
    const locked = Number(p.locked ?? 0);
    const exposure = Number(p.exposure ?? 0);
    return {
      status: Math.abs(quantity) > 0 ? "open" : "flat",
      symbol: p.symbol,
      asset: p.asset,
      quoteAsset: p.quoteAsset,
      quantity,
      free,
      locked,
      exposure,
      markPrice: Number(p.markPrice ?? 0),
      source: p.source ?? "exchange",
      lastReconciledAt: event.timestamp,
      meta: meta(prev.meta.revision, event)
    };
  }

  return prev;
}

export function reduceRiskState(prev: RiskState, event: DomainEvent, ctx: RuntimeSnapshot): RiskState {
  const reasons: string[] = [];
  const exposure = Math.abs(ctx.position.exposure);
  const configuredMax = Number(process.env.MAX_EXPOSURE_USDT ?? prev.maxExposure ?? 1000000);
  const maxExposure = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : prev.maxExposure;
  if (ctx.bootstrap.status !== "reconciled") {
    const reason = bootstrapReason(ctx.bootstrap.status);
    if (reason) reasons.push(reason);
  }
  if (ctx.exchangeTruth.status !== "fresh") {
    const reason = exchangeTruthBlockReason(ctx.exchangeTruth.status);
    if (reason) reasons.push(reason);
  }
  if (ctx.market.status !== "open") reasons.push("market_not_open");
  if (ctx.order.status === "uncertain") reasons.push("order_uncertain");
  if (ctx.position.status === "unknown") {
    reasons.push(ctx.position.lastReconciledAt ? "position_unknown" : "bootstrap_position_not_reconciled");
  }
  if (exposure > maxExposure) reasons.push("exposure_limit_exceeded");
  const t = event.timestamp;
  return {
    status: reasons.length ? "blocked" : "clear",
    reasons,
    maxExposure,
    currentExposure: exposure,
    meta: { revision: prev.meta.revision + 1, updatedAt: t }
  };
}

export function reduceSystemState(prev: SystemState, event: DomainEvent, ctx: RuntimeSnapshot): SystemState {
  const t = event.timestamp;

  if (event.eventType === (EVENT_TYPE as any).SYSTEM_HALTED) {
    const p: any = event.payload ?? {};
    return {
      status: "halted",
      reasons: [String(p.reason ?? "system_halted")],
      startedAt: prev.startedAt,
      lastConnectionHeartbeatAt: prev.lastConnectionHeartbeatAt,
      meta: { revision: prev.meta.revision + 1, updatedAt: t, sourceEventId: event.eventId }
    };
  }


  if (event.eventType === EVENT_TYPE.SYSTEM_HEALTH_CHANGED) {
    const p: any = event.payload ?? {};
    const connectionState = String(p.connectionState ?? p.status ?? p.state ?? "").toLowerCase();
    const wsConnected = p.wsConnected ?? p.connected;
    const isConnected = wsConnected === true || ["connected", "true", "up", "open"].includes(connectionState);
    const isDisconnected = wsConnected === false || ["disconnected", "false", "down", "closed"].includes(connectionState);
    const isUnknown = wsConnected === "unknown" || connectionState === "unknown";
    const lastConnectionHeartbeatAt =
      typeof p.lastConnectionHeartbeatAt === "string"
        ? p.lastConnectionHeartbeatAt
        : typeof p.heartbeatAt === "string"
          ? p.heartbeatAt
          : typeof p.receivedAt === "string" && isConnected
            ? p.receivedAt
            : isConnected
              ? event.timestamp
              : prev.lastConnectionHeartbeatAt;
    const reasons = isDisconnected || isUnknown ? Array.from(new Set([...prev.reasons, "connection_state_unknown"])) : prev.reasons;
    return {
      ...prev,
      reasons,
      lastConnectionHeartbeatAt,
      meta: { revision: prev.meta.revision + 1, updatedAt: t, sourceEventId: event.eventId }
    };
  }

  if (prev.status === "halted") {
    return { ...prev, meta: { ...prev.meta, revision: prev.meta.revision + 1, updatedAt: t } };
  }

  const reasons: string[] = [];
  if (ctx.bootstrap.status === "failed") reasons.push("bootstrap_failed");
  else if (ctx.bootstrap.status !== "reconciled") reasons.push(bootstrapReason(ctx.bootstrap.status) ?? "bootstrap_not_reconciled");
  if (ctx.exchangeTruth.status !== "fresh") {
    const reason = exchangeTruthBlockReason(ctx.exchangeTruth.status);
    if (reason) reasons.push(reason);
  }
  if (ctx.risk.status === "blocked") reasons.push("risk_blocked");
  if (ctx.market.status === "unknown") reasons.push("market_unknown");
  const status = ctx.bootstrap.status === "failed" ? "halted" : reasons.length ? "degraded" : "healthy";
  return { status, reasons, startedAt: prev.startedAt, lastConnectionHeartbeatAt: prev.lastConnectionHeartbeatAt, meta: { revision: prev.meta.revision + 1, updatedAt: t } };
}
