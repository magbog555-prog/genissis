import { EVENT_TYPE, type DomainEvent, type EventType } from "../contracts/src/events.js";

export type DomainEventValidationCode =
  | "event_id_missing"
  | "event_type_invalid"
  | "timestamp_invalid"
  | "timestamp_in_future"
  | "source_missing"
  | "payload_invalid";

export interface DomainEventValidationIssue {
  code: DomainEventValidationCode;
  path: string;
  message: string;
}

export interface DomainEventValidationAccepted {
  ok: true;
  eventId: string;
  eventType: EventType;
}

export interface DomainEventValidationRejected {
  ok: false;
  eventId?: string;
  eventType?: string;
  issues: DomainEventValidationIssue[];
}

export type DomainEventValidationResult = DomainEventValidationAccepted | DomainEventValidationRejected;

const DEFAULT_FUTURE_TOLERANCE_MS = Number(process.env.MBG_EVENT_FUTURE_TOLERANCE_MS ?? 5000);

function issue(code: DomainEventValidationCode, path: string, message: string): DomainEventValidationIssue {
  return { code, path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validSide(value: unknown) {
  return value === "buy" || value === "sell";
}

function hasKnownSource(event: DomainEvent, payload: Record<string, unknown>) {
  return nonEmptyString(event.source) || nonEmptyString(payload.provider) || nonEmptyString(payload.source);
}

function validateTimestamp(event: DomainEvent, issues: DomainEventValidationIssue[], futureToleranceMs: number) {
  if (!nonEmptyString(event.timestamp)) {
    issues.push(issue("timestamp_invalid", "timestamp", "event timestamp is required"));
    return;
  }

  const parsed = Date.parse(event.timestamp);
  if (!Number.isFinite(parsed)) {
    issues.push(issue("timestamp_invalid", "timestamp", "event timestamp must be a valid ISO-compatible timestamp"));
    return;
  }

  if (parsed > Date.now() + futureToleranceMs) {
    issues.push(issue("timestamp_in_future", "timestamp", `event timestamp is beyond future tolerance (${futureToleranceMs}ms)`));
  }
}

function validateMarketTick(event: DomainEvent, payload: Record<string, unknown>, issues: DomainEventValidationIssue[]) {
  if (!nonEmptyString(payload.symbol)) {
    issues.push(issue("payload_invalid", "payload.symbol", "market tick symbol is required"));
  }

  if (!positiveNumber(payload.price)) {
    issues.push(issue("payload_invalid", "payload.price", "market tick price must be > 0"));
  }

  if (!positiveNumber(payload.bid)) {
    issues.push(issue("payload_invalid", "payload.bid", "market tick bid must be > 0"));
  }

  if (!positiveNumber(payload.ask)) {
    issues.push(issue("payload_invalid", "payload.ask", "market tick ask must be > 0"));
  }

  if (positiveNumber(payload.bid) && positiveNumber(payload.ask) && Number(payload.bid) > Number(payload.ask)) {
    issues.push(issue("payload_invalid", "payload.bid", "market tick bid must be <= ask"));
  }

  if (!nonNegativeNumber(payload.volume)) {
    issues.push(issue("payload_invalid", "payload.volume", "market tick volume must be >= 0"));
  }

  if (!hasKnownSource(event, payload)) {
    issues.push(issue("source_missing", "source", "market tick source/provider is required"));
  }
}

function validateOrderLike(event: DomainEvent, payload: Record<string, unknown>, issues: DomainEventValidationIssue[]) {
  if (event.eventType !== EVENT_TYPE.ORDER_REQUESTED && !nonEmptyString(payload.orderId)) {
    issues.push(issue("payload_invalid", "payload.orderId", `${event.eventType} orderId is required`));
  }

  if (!positiveNumber(payload.quantity)) {
    issues.push(issue("payload_invalid", "payload.quantity", `${event.eventType} quantity must be > 0`));
  }

  if (!nonEmptyString(payload.symbol)) {
    issues.push(issue("payload_invalid", "payload.symbol", `${event.eventType} symbol is required`));
  }

  if (!validSide(payload.side)) {
    issues.push(issue("payload_invalid", "payload.side", `${event.eventType} side must be buy or sell`));
  }

  if (!hasKnownSource(event, payload)) {
    issues.push(issue("source_missing", "source", `${event.eventType} source/provider is required`));
  }

  if (event.eventType === EVENT_TYPE.ORDER_EXECUTION_REPORTED && !nonEmptyString(payload.fillId)) {
    issues.push(issue("payload_invalid", "payload.fillId", "fill event fillId is required"));
  }
}

function validatePositionReconciled(event: DomainEvent, payload: Record<string, unknown>, issues: DomainEventValidationIssue[]) {
  if (!nonEmptyString(payload.symbol)) {
    issues.push(issue("payload_invalid", "payload.symbol", "position reconcile symbol is required"));
  }

  if (!nonEmptyString(payload.source) && !nonEmptyString(event.source)) {
    issues.push(issue("source_missing", "source", "position reconcile source is required"));
  }

  if (typeof payload.quantity !== "number" || !Number.isFinite(payload.quantity)) {
    issues.push(issue("payload_invalid", "payload.quantity", "position reconcile quantity must be finite"));
  }

  if (typeof payload.exposure !== "number" || !Number.isFinite(payload.exposure) || payload.exposure < 0) {
    issues.push(issue("payload_invalid", "payload.exposure", "position reconcile exposure must be finite and >= 0"));
  }
}


function validateIsoIfPresent(value: unknown, path: string, issues: DomainEventValidationIssue[]) {
  if (value === undefined) return;
  if (!nonEmptyString(value) || Number.isNaN(Date.parse(String(value)))) {
    issues.push(issue("payload_invalid", path, `${path} must be an ISO-compatible timestamp when provided`));
  }
}

function validateExchangeTruth(event: DomainEvent, payload: Record<string, unknown>, issues: DomainEventValidationIssue[]) {
  if (!hasKnownSource(event, payload) && !nonEmptyString(payload.reason)) {
    issues.push(issue("source_missing", "source", `${event.eventType} source/provider or diagnostic reason is required`));
  }

  validateIsoIfPresent(payload.lastAccountReconcileAt, "payload.lastAccountReconcileAt", issues);
  validateIsoIfPresent(payload.lastPositionReconcileAt, "payload.lastPositionReconcileAt", issues);
  validateIsoIfPresent(payload.lastOrderReconcileAt, "payload.lastOrderReconcileAt", issues);
  validateIsoIfPresent(payload.lastFillSyncAt, "payload.lastFillSyncAt", issues);

  if (payload.drift !== undefined && !isRecord(payload.drift)) {
    issues.push(issue("payload_invalid", "payload.drift", "exchange truth drift must be an object when provided"));
  }

  if (payload.conflicts !== undefined) {
    if (!Array.isArray(payload.conflicts)) {
      issues.push(issue("payload_invalid", "payload.conflicts", "exchange truth conflicts must be an array when provided"));
    } else {
      payload.conflicts.forEach((conflict, index) => {
        if (!isRecord(conflict) || !nonEmptyString(conflict.code)) {
          issues.push(issue("payload_invalid", `payload.conflicts.${index}.code`, "exchange truth conflict code is required"));
        }
      });
    }
  }

  if (payload.localPositionStatus !== undefined && !["unknown", "flat", "open", "reconcile"].includes(String(payload.localPositionStatus))) {
    issues.push(issue("payload_invalid", "payload.localPositionStatus", "localPositionStatus must be unknown, flat, open, or reconcile"));
  }

  if (payload.exchangePositionStatus !== undefined && !["unknown", "flat", "open", "reconcile"].includes(String(payload.exchangePositionStatus))) {
    issues.push(issue("payload_invalid", "payload.exchangePositionStatus", "exchangePositionStatus must be unknown, flat, open, or reconcile"));
  }

  if (payload.exchangePositionQuantity !== undefined && (typeof payload.exchangePositionQuantity !== "number" || !Number.isFinite(payload.exchangePositionQuantity))) {
    issues.push(issue("payload_invalid", "payload.exchangePositionQuantity", "exchangePositionQuantity must be finite when provided"));
  }
}



function validateProvenanceRef(payload: Record<string, unknown>, issues: DomainEventValidationIssue[], basePath = "payload") {
  if (!nonEmptyString(payload.provenanceId)) {
    issues.push(issue("payload_invalid", `${basePath}.provenanceId`, "provenanceId is required"));
  }

  if (!["observation", "hypothesis", "signal", "decision", "action", "order", "fill", "pnl", "manual", "system"].includes(String(payload.originType))) {
    issues.push(issue("payload_invalid", `${basePath}.originType`, "originType is invalid"));
  }

  if (!nonEmptyString(payload.originEventId)) {
    issues.push(issue("payload_invalid", `${basePath}.originEventId`, "originEventId is required"));
  }

  if (!nonEmptyString(payload.targetId)) {
    issues.push(issue("payload_invalid", `${basePath}.targetId`, "targetId is required"));
  }

  if (payload.parentProvenanceIds !== undefined && !Array.isArray(payload.parentProvenanceIds)) {
    issues.push(issue("payload_invalid", `${basePath}.parentProvenanceIds`, "parentProvenanceIds must be an array"));
  }

  if (!nonEmptyString(payload.source)) {
    issues.push(issue("source_missing", `${basePath}.source`, "provenance source is required"));
  }

  if (typeof payload.confidence !== "number" || !Number.isFinite(payload.confidence) || payload.confidence < 0 || payload.confidence > 1) {
    issues.push(issue("payload_invalid", `${basePath}.confidence`, "confidence must be between 0 and 1"));
  }

  validateIsoIfPresent(payload.createdAtFromEvent, `${basePath}.createdAtFromEvent`, issues);
  if (!nonEmptyString(payload.createdAtFromEvent)) {
    issues.push(issue("payload_invalid", `${basePath}.createdAtFromEvent`, "createdAtFromEvent is required and must come from the event"));
  }
}

function validateMetadataEvent(event: DomainEvent, payload: Record<string, unknown>, issues: DomainEventValidationIssue[]) {
  if (event.eventType === EVENT_TYPE.METADATA_ATTACHED) {
    if (!nonEmptyString(payload.metadataId)) {
      issues.push(issue("payload_invalid", "payload.metadataId", "metadataId is required"));
    }
    if (!nonEmptyString(payload.targetId)) {
      issues.push(issue("payload_invalid", "payload.targetId", "targetId is required"));
    }
    if (!nonEmptyString(payload.key)) {
      issues.push(issue("payload_invalid", "payload.key", "metadata key is required"));
    }
    if (!("value" in payload)) {
      issues.push(issue("payload_invalid", "payload.value", "metadata value is required"));
    }
    if (!isRecord(payload.provenance)) {
      issues.push(issue("payload_invalid", "payload.provenance", "metadata provenance object is required"));
    } else {
      validateProvenanceRef(payload.provenance, issues, "payload.provenance");
    }
    validateIsoIfPresent(payload.createdAtFromEvent, "payload.createdAtFromEvent", issues);
    if (!nonEmptyString(payload.createdAtFromEvent)) {
      issues.push(issue("payload_invalid", "payload.createdAtFromEvent", "createdAtFromEvent is required and must come from the event"));
    }
    return;
  }

  validateProvenanceRef(payload, issues, "payload");
}



function validateMarketInputEvent(event: DomainEvent, payload: Record<string, unknown>, issues: DomainEventValidationIssue[]) {
  const observation = isRecord(payload.observation) ? payload.observation : payload;

  if (!nonEmptyString(observation.observationId)) {
    issues.push(issue("payload_invalid", "payload.observation.observationId", "market input observationId is required"));
  }
  if (!["exchange", "aggregator", "simulated", "manual", "system"].includes(String(observation.sourceType))) {
    issues.push(issue("payload_invalid", "payload.observation.sourceType", "market input sourceType is invalid"));
  }
  if (!nonEmptyString(observation.sourceName)) {
    issues.push(issue("source_missing", "payload.observation.sourceName", "market input sourceName is required"));
  }
  if (!nonEmptyString(observation.symbol)) {
    issues.push(issue("payload_invalid", "payload.observation.symbol", "market input symbol is required"));
  }
  if (!nonEmptyString(observation.channel)) {
    issues.push(issue("payload_invalid", "payload.observation.channel", "market input channel is required"));
  }
  if (!Number.isInteger(observation.sequence) || Number(observation.sequence) < 0) {
    issues.push(issue("payload_invalid", "payload.observation.sequence", "market input sequence must be a non-negative integer"));
  }
  if (observation.previousSequence !== undefined && (!Number.isInteger(observation.previousSequence) || Number(observation.previousSequence) < 0)) {
    issues.push(issue("payload_invalid", "payload.observation.previousSequence", "market input previousSequence must be a non-negative integer"));
  }
  validateIsoIfPresent(observation.exchangeTimestamp, "payload.observation.exchangeTimestamp", issues);
  if (!nonEmptyString(observation.exchangeTimestamp)) {
    issues.push(issue("payload_invalid", "payload.observation.exchangeTimestamp", "market input exchangeTimestamp is required"));
  }
  validateIsoIfPresent(observation.receivedTimestampFromEvent, "payload.observation.receivedTimestampFromEvent", issues);
  if (!nonEmptyString(observation.receivedTimestampFromEvent)) {
    issues.push(issue("payload_invalid", "payload.observation.receivedTimestampFromEvent", "market input receivedTimestampFromEvent is required and must come from the event"));
  }
  if (!nonEmptyString(observation.payloadHash)) {
    issues.push(issue("payload_invalid", "payload.observation.payloadHash", "market input payloadHash is required"));
  }
  if (!nonEmptyString(observation.provenanceId)) {
    issues.push(issue("payload_invalid", "payload.observation.provenanceId", "market input provenanceId is required"));
  }
  if (!nonEmptyString(observation.schemaVersion)) {
    issues.push(issue("payload_invalid", "payload.observation.schemaVersion", "market input schemaVersion is required"));
  }

  const price = Number((observation as any).price);
  const bid = Number((observation as any).bid);
  const ask = Number((observation as any).ask);
  if ((observation as any).price !== undefined && (!Number.isFinite(price) || price < 0)) {
    issues.push(issue("payload_invalid", "payload.observation.price", "market input price must be non-negative when provided"));
  }
  if ((observation as any).bid !== undefined && (!Number.isFinite(bid) || bid < 0)) {
    issues.push(issue("payload_invalid", "payload.observation.bid", "market input bid must be non-negative when provided"));
  }
  if ((observation as any).ask !== undefined && (!Number.isFinite(ask) || ask < 0)) {
    issues.push(issue("payload_invalid", "payload.observation.ask", "market input ask must be non-negative when provided"));
  }
  if ((observation as any).bid !== undefined && (observation as any).ask !== undefined && Number.isFinite(bid) && Number.isFinite(ask) && bid > ask) {
    issues.push(issue("payload_invalid", "payload.observation.spread", "market input bid cannot exceed ask"));
  }

  if (payload.validationStatus !== undefined && ![
    "valid",
    "rejected",
    "gap_detected",
    "duplicate_detected",
    "stale_detected",
    "checksum_mismatch_detected"
  ].includes(String(payload.validationStatus))) {
    issues.push(issue("payload_invalid", "payload.validationStatus", "market input validationStatus is invalid"));
  }

  if (payload.issues !== undefined && !Array.isArray(payload.issues)) {
    issues.push(issue("payload_invalid", "payload.issues", "market input issues must be an array when provided"));
  }
}

function validateSignal(payload: Record<string, unknown>, issues: DomainEventValidationIssue[]) {
  if (!nonEmptyString(payload.symbol)) {
    issues.push(issue("payload_invalid", "payload.symbol", "signal symbol is required"));
  }
  if (!validSide(payload.side)) {
    issues.push(issue("payload_invalid", "payload.side", "signal side must be buy or sell"));
  }
  if (typeof payload.confidence !== "number" || payload.confidence < 0 || payload.confidence > 1) {
    issues.push(issue("payload_invalid", "payload.confidence", "signal confidence must be between 0 and 1"));
  }
  if (payload.quantity !== undefined && !positiveNumber(payload.quantity)) {
    issues.push(issue("payload_invalid", "payload.quantity", "signal quantity must be > 0 when provided"));
  }
}

export function validateDomainEvent(
  event: DomainEvent,
  options: { futureToleranceMs?: number } = {}
): DomainEventValidationResult {
  const issues: DomainEventValidationIssue[] = [];
  const futureToleranceMs = options.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS;

  if (!isRecord(event)) {
    return {
      ok: false,
      issues: [issue("payload_invalid", "event", "domain event must be an object")]
    };
  }

  if (!nonEmptyString(event.eventId)) {
    issues.push(issue("event_id_missing", "eventId", "eventId is required"));
  }

  const validEventTypes = new Set<string>(Object.values(EVENT_TYPE));
  if (!nonEmptyString(event.eventType) || !validEventTypes.has(event.eventType)) {
    issues.push(issue("event_type_invalid", "eventType", `unsupported event type: ${String(event.eventType)}`));
  }

  validateTimestamp(event, issues, futureToleranceMs);

  if (event.schemaVersion !== undefined && !["1", "v1", 1].includes(event.schemaVersion as string | number)) {
    issues.push(issue("payload_invalid", "schemaVersion", "unsupported event schema version"));
  }

  if (!isRecord(event.payload)) {
    issues.push(issue("payload_invalid", "payload", "event payload must be an object"));
  }

  const payload = isRecord(event.payload) ? event.payload : {};

  switch (event.eventType) {
    case EVENT_TYPE.MARKET_TICK_RECEIVED:
      validateMarketTick(event, payload, issues);
      break;
    case EVENT_TYPE.ORDER_REQUESTED:
    case EVENT_TYPE.ORDER_CANCELED:
    case EVENT_TYPE.ORDER_RECONCILED:
    case EVENT_TYPE.ORDER_EXECUTION_REPORTED:
      validateOrderLike(event, payload, issues);
      break;
    case EVENT_TYPE.POSITION_RECONCILED:
      validatePositionReconciled(event, payload, issues);
      break;
    case EVENT_TYPE.SIGNAL_RECEIVED:
      validateSignal(payload, issues);
      break;
    case EVENT_TYPE.BOOTSTRAP_LOADING_SNAPSHOT:
    case EVENT_TYPE.BOOTSTRAP_REPLAYING_TAIL:
    case EVENT_TYPE.BOOTSTRAP_AWAITING_EXCHANGE_TRUTH:
    case EVENT_TYPE.BOOTSTRAP_RECONCILED:
    case EVENT_TYPE.BOOTSTRAP_FAILED:
    case EVENT_TYPE.BOOTSTRAP_RECOVERY_STARTED:
      if (!hasKnownSource(event, payload) && !nonEmptyString(payload.reason)) {
        issues.push(issue("source_missing", "source", `${event.eventType} source/provider or diagnostic reason is required`));
      }
      break;
    case EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_STARTED:
    case EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_SUCCEEDED:
    case EVENT_TYPE.EXCHANGE_TRUTH_RECONCILE_FAILED:
    case EVENT_TYPE.EXCHANGE_TRUTH_STALE_DETECTED:
    case EVENT_TYPE.EXCHANGE_TRUTH_CONFLICT_DETECTED:
    case EVENT_TYPE.EXCHANGE_TRUTH_UNAVAILABLE_DETECTED:
      validateExchangeTruth(event, payload, issues);
      break;
    case EVENT_TYPE.MARKET_INPUT_OBSERVED:
    case EVENT_TYPE.MARKET_INPUT_VALIDATED:
    case EVENT_TYPE.MARKET_INPUT_REJECTED:
    case EVENT_TYPE.MARKET_INPUT_GAP_DETECTED:
    case EVENT_TYPE.MARKET_INPUT_DUPLICATE_DETECTED:
    case EVENT_TYPE.MARKET_INPUT_STALE_DETECTED:
    case EVENT_TYPE.MARKET_INPUT_CHECKSUM_MISMATCH_DETECTED:
      validateMarketInputEvent(event, payload, issues);
      break;
    case EVENT_TYPE.METADATA_ATTACHED:
    case EVENT_TYPE.PROVENANCE_RECORDED:
    case EVENT_TYPE.ACTION_PROVENANCE_RECORDED:
    case EVENT_TYPE.TRADE_PROVENANCE_RECORDED:
    case EVENT_TYPE.FILL_PROVENANCE_RECORDED:
    case EVENT_TYPE.PNL_PROVENANCE_RECORDED:
      validateMetadataEvent(event, payload, issues);
      break;
    case EVENT_TYPE.ORDER_UNCERTAIN:
    case EVENT_TYPE.POSITION_UNKNOWN:
    case EVENT_TYPE.SYSTEM_HEALTH_CHANGED:
    case EVENT_TYPE.SYSTEM_HALTED:
      if (!hasKnownSource(event, payload) && !nonEmptyString(payload.reason)) {
        issues.push(issue("source_missing", "source", `${event.eventType} source/provider or diagnostic reason is required`));
      }
      break;
  }

  if (issues.length > 0) {
    return {
      ok: false,
      eventId: nonEmptyString(event.eventId) ? event.eventId : undefined,
      eventType: nonEmptyString(event.eventType) ? event.eventType : undefined,
      issues
    };
  }

  return {
    ok: true,
    eventId: event.eventId,
    eventType: event.eventType
  };
}
