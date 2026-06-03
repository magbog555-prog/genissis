import { createHash } from "node:crypto";
import { DomainEvent, EVENT_TYPE } from "../../contracts/src/events.js";

export type IdempotencyScope = "eventId" | "fillId" | "reconcileId" | "exchangeReportId" | "provenanceId" | "metadataId" | "marketObservationId";

export type IdempotencyDecision =
  | "accepted"
  | "duplicate_ignored"
  | "duplicate_conflict";

export interface IdempotencyDiagnostic {
  decision: IdempotencyDecision;
  scope: IdempotencyScope;
  key: string;
  eventId: string;
  eventType: string;
  reason: string;
  canonicalEvent: boolean;
  existingEventId?: string;
  existingFingerprint?: string;
  incomingFingerprint?: string;
}

interface IndexedIdentity {
  eventId: string;
  fingerprint: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function payloadRecord(event: DomainEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === "object"
    ? event.payload as Record<string, unknown>
    : {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function exchangeReportKey(event: DomainEvent, payload: Record<string, unknown>): string | undefined {
  const direct = firstString(payload, [
    "exchangeReportId",
    "executionReportId",
    "reportId",
    "executionId",
    "transactionId"
  ]);
  if (direct) return direct;

  if (event.eventType !== EVENT_TYPE.ORDER_EXECUTION_REPORTED) return undefined;

  const orderId = firstString(payload, ["orderId", "clientOrderId"]);
  const tradeId = firstString(payload, ["tradeId", "fillId"]);
  const executionTime = firstString(payload, ["executionTime", "tradeTime", "time", "transactTime"]);
  if (!orderId || !tradeId || !executionTime) return undefined;

  return `${orderId}:${tradeId}:${executionTime}`;
}


function metadataEventKind(event: DomainEvent): "metadata" | undefined {
  const metadataTypes = new Set<string>([
    EVENT_TYPE.METADATA_ATTACHED,
    EVENT_TYPE.PROVENANCE_RECORDED,
    EVENT_TYPE.ACTION_PROVENANCE_RECORDED,
    EVENT_TYPE.TRADE_PROVENANCE_RECORDED,
    EVENT_TYPE.FILL_PROVENANCE_RECORDED,
    EVENT_TYPE.PNL_PROVENANCE_RECORDED
  ]);
  return metadataTypes.has(event.eventType) ? "metadata" : undefined;
}

function provenanceKey(payload: Record<string, unknown>): string | undefined {
  const nested = payload.provenance && typeof payload.provenance === "object"
    ? payload.provenance as Record<string, unknown>
    : undefined;
  return firstString(payload, ["provenanceId"]) ?? (nested ? firstString(nested, ["provenanceId"]) : undefined);
}



function marketInputEventKind(event: DomainEvent): "marketInput" | undefined {
  const marketInputTypes = new Set<string>([
    EVENT_TYPE.MARKET_INPUT_OBSERVED,
    EVENT_TYPE.MARKET_INPUT_VALIDATED,
    EVENT_TYPE.MARKET_INPUT_REJECTED,
    EVENT_TYPE.MARKET_INPUT_GAP_DETECTED,
    EVENT_TYPE.MARKET_INPUT_DUPLICATE_DETECTED,
    EVENT_TYPE.MARKET_INPUT_STALE_DETECTED,
    EVENT_TYPE.MARKET_INPUT_CHECKSUM_MISMATCH_DETECTED
  ]);
  return marketInputTypes.has(event.eventType) ? "marketInput" : undefined;
}

function marketObservationKey(payload: Record<string, unknown>): string | undefined {
  const nested = payload.observation && typeof payload.observation === "object"
    ? payload.observation as Record<string, unknown>
    : undefined;
  return firstString(payload, ["observationId"]) ?? (nested ? firstString(nested, ["observationId"]) : undefined);
}

export function canonicalEventFingerprint(event: DomainEvent): string {
  return fingerprint({
    eventType: event.eventType,
    timestamp: event.timestamp,
    payload: event.payload
  });
}

function secondaryFingerprint(event: DomainEvent): string {
  return fingerprint({
    eventType: event.eventType,
    payload: event.payload
  });
}

export class EventIdempotencyIndex {
  private eventIds = new Map<string, IndexedIdentity>();
  private fillIds = new Map<string, IndexedIdentity>();
  private reconcileIds = new Map<string, IndexedIdentity>();
  private exchangeReportIds = new Map<string, IndexedIdentity>();
  private provenanceIds = new Map<string, IndexedIdentity>();
  private metadataIds = new Map<string, IndexedIdentity>();
  private marketObservationIds = new Map<string, IndexedIdentity>();

  clear(): void {
    this.eventIds.clear();
    this.fillIds.clear();
    this.reconcileIds.clear();
    this.exchangeReportIds.clear();
    this.provenanceIds.clear();
    this.metadataIds.clear();
    this.marketObservationIds.clear();
  }

  get size() {
    return {
      eventIds: this.eventIds.size,
      fillIds: this.fillIds.size,
      reconcileIds: this.reconcileIds.size,
      exchangeReportIds: this.exchangeReportIds.size,
      provenanceIds: this.provenanceIds.size,
      metadataIds: this.metadataIds.size,
      marketObservationIds: this.marketObservationIds.size
    };
  }

  evaluate(event: DomainEvent): IdempotencyDiagnostic {
    const eventFingerprint = canonicalEventFingerprint(event);
    const byEventId = this.eventIds.get(event.eventId);
    if (byEventId) {
      return {
        decision: byEventId.fingerprint === eventFingerprint ? "duplicate_ignored" : "duplicate_conflict",
        scope: "eventId",
        key: event.eventId,
        eventId: event.eventId,
        eventType: event.eventType,
        reason: byEventId.fingerprint === eventFingerprint
          ? "duplicate_event_id_same_payload"
          : "duplicate_event_id_conflicting_payload",
        canonicalEvent: false,
        existingEventId: byEventId.eventId,
        existingFingerprint: byEventId.fingerprint,
        incomingFingerprint: eventFingerprint
      };
    }

    const payload = payloadRecord(event);
    const secondary = secondaryFingerprint(event);

    if (event.eventType === EVENT_TYPE.ORDER_EXECUTION_REPORTED) {
      const fillId = firstString(payload, ["fillId", "tradeId", "executionId"]);
      if (fillId) {
        const existing = this.fillIds.get(fillId);
        if (existing) {
          return {
            decision: existing.fingerprint === secondary ? "duplicate_ignored" : "duplicate_conflict",
            scope: "fillId",
            key: fillId,
            eventId: event.eventId,
            eventType: event.eventType,
            reason: existing.fingerprint === secondary
              ? "duplicate_fill_id_same_payload"
              : "duplicate_fill_id_conflicting_payload",
            canonicalEvent: false,
            existingEventId: existing.eventId,
            existingFingerprint: existing.fingerprint,
            incomingFingerprint: secondary
          };
        }
      }
    }

    if (event.eventType === EVENT_TYPE.ORDER_RECONCILED || event.eventType === EVENT_TYPE.POSITION_RECONCILED) {
      const reconcileId = firstString(payload, ["reconcileId", "reconciliationId"]);
      if (reconcileId) {
        const existing = this.reconcileIds.get(reconcileId);
        if (existing) {
          return {
            decision: existing.fingerprint === secondary ? "duplicate_ignored" : "duplicate_conflict",
            scope: "reconcileId",
            key: reconcileId,
            eventId: event.eventId,
            eventType: event.eventType,
            reason: existing.fingerprint === secondary
              ? "duplicate_reconcile_id_same_payload"
              : "duplicate_reconcile_id_conflicting_payload",
            canonicalEvent: false,
            existingEventId: existing.eventId,
            existingFingerprint: existing.fingerprint,
            incomingFingerprint: secondary
          };
        }
      }
    }

    if (metadataEventKind(event)) {
      const metadataId = firstString(payload, ["metadataId"]);
      if (metadataId) {
        const existing = this.metadataIds.get(metadataId);
        if (existing) {
          return {
            decision: existing.fingerprint === secondary ? "duplicate_ignored" : "duplicate_conflict",
            scope: "metadataId",
            key: metadataId,
            eventId: event.eventId,
            eventType: event.eventType,
            reason: existing.fingerprint === secondary
              ? "duplicate_metadata_id_same_payload"
              : "duplicate_metadata_id_conflicting_payload",
            canonicalEvent: false,
            existingEventId: existing.eventId,
            existingFingerprint: existing.fingerprint,
            incomingFingerprint: secondary
          };
        }
      }

      const provenanceId = provenanceKey(payload);
      if (provenanceId) {
        const existing = this.provenanceIds.get(provenanceId);
        if (existing) {
          return {
            decision: existing.fingerprint === secondary ? "duplicate_ignored" : "duplicate_conflict",
            scope: "provenanceId",
            key: provenanceId,
            eventId: event.eventId,
            eventType: event.eventType,
            reason: existing.fingerprint === secondary
              ? "duplicate_provenance_id_same_payload"
              : "duplicate_provenance_id_conflicting_payload",
            canonicalEvent: false,
            existingEventId: existing.eventId,
            existingFingerprint: existing.fingerprint,
            incomingFingerprint: secondary
          };
        }
      }
    }



    if (marketInputEventKind(event)) {
      const observationId = marketObservationKey(payload);
      if (observationId) {
        const existing = this.marketObservationIds.get(observationId);
        if (existing) {
          return {
            decision: existing.fingerprint === secondary ? "duplicate_ignored" : "duplicate_conflict",
            scope: "marketObservationId",
            key: observationId,
            eventId: event.eventId,
            eventType: event.eventType,
            reason: existing.fingerprint === secondary
              ? "duplicate_market_observation_id_same_payload"
              : "duplicate_market_observation_id_conflicting_payload",
            canonicalEvent: false,
            existingEventId: existing.eventId,
            existingFingerprint: existing.fingerprint,
            incomingFingerprint: secondary
          };
        }
      }
    }

    const reportKey = exchangeReportKey(event, payload);
    if (reportKey) {
      const existing = this.exchangeReportIds.get(reportKey);
      if (existing) {
        return {
          decision: existing.fingerprint === secondary ? "duplicate_ignored" : "duplicate_conflict",
          scope: "exchangeReportId",
          key: reportKey,
          eventId: event.eventId,
          eventType: event.eventType,
          reason: existing.fingerprint === secondary
            ? "duplicate_exchange_report_same_payload"
            : "duplicate_exchange_report_conflicting_payload",
          canonicalEvent: false,
          existingEventId: existing.eventId,
          existingFingerprint: existing.fingerprint,
          incomingFingerprint: secondary
        };
      }
    }

    return {
      decision: "accepted",
      scope: "eventId",
      key: event.eventId,
      eventId: event.eventId,
      eventType: event.eventType,
      reason: "accepted_new_event_identity",
      canonicalEvent: true,
      incomingFingerprint: eventFingerprint
    };
  }

  recordAccepted(event: DomainEvent): void {
    const eventFingerprint = canonicalEventFingerprint(event);
    this.eventIds.set(event.eventId, { eventId: event.eventId, fingerprint: eventFingerprint });

    const payload = payloadRecord(event);
    const secondary = secondaryFingerprint(event);

    if (event.eventType === EVENT_TYPE.ORDER_EXECUTION_REPORTED) {
      const fillId = firstString(payload, ["fillId", "tradeId", "executionId"]);
      if (fillId && !this.fillIds.has(fillId)) {
        this.fillIds.set(fillId, { eventId: event.eventId, fingerprint: secondary });
      }
    }

    if (event.eventType === EVENT_TYPE.ORDER_RECONCILED || event.eventType === EVENT_TYPE.POSITION_RECONCILED) {
      const reconcileId = firstString(payload, ["reconcileId", "reconciliationId"]);
      if (reconcileId && !this.reconcileIds.has(reconcileId)) {
        this.reconcileIds.set(reconcileId, { eventId: event.eventId, fingerprint: secondary });
      }
    }

    if (metadataEventKind(event)) {
      const metadataId = firstString(payload, ["metadataId"]);
      if (metadataId && !this.metadataIds.has(metadataId)) {
        this.metadataIds.set(metadataId, { eventId: event.eventId, fingerprint: secondary });
      }

      const provenanceId = provenanceKey(payload);
      if (provenanceId && !this.provenanceIds.has(provenanceId)) {
        this.provenanceIds.set(provenanceId, { eventId: event.eventId, fingerprint: secondary });
      }
    }


    if (marketInputEventKind(event)) {
      const observationId = marketObservationKey(payload);
      if (observationId && !this.marketObservationIds.has(observationId)) {
        this.marketObservationIds.set(observationId, { eventId: event.eventId, fingerprint: secondary });
      }
    }

    const reportKey = exchangeReportKey(event, payload);
    if (reportKey && !this.exchangeReportIds.has(reportKey)) {
      this.exchangeReportIds.set(reportKey, { eventId: event.eventId, fingerprint: secondary });
    }
  }

  evaluateAndRecord(event: DomainEvent): IdempotencyDiagnostic {
    const diagnostic = this.evaluate(event);
    if (diagnostic.decision === "accepted") this.recordAccepted(event);
    return diagnostic;
  }
}
