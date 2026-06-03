import { createHash } from "node:crypto";
import type { DomainEvent } from "../contracts/src/events.js";
import type { DomainEventValidationRejected } from "../events/validate-domain-event.js";
import type { IdempotencyDiagnostic } from "../runtime/src/idempotency.js";

export type QuarantineSource =
  | "invalid_event"
  | "unknown_event_type"
  | "schema_violation"
  | "idempotency_conflict"
  | "suspicious_payload";

export type QuarantineSeverity = "info" | "warning" | "blocking" | "critical" | "panic";

export interface QuarantineRecord {
  quarantineId: string;
  reason: string;
  source: QuarantineSource;
  eventId?: string;
  eventType?: string;
  payloadHash: string;
  detectedBy: string;
  detectedAt: string;
  severity: QuarantineSeverity;
  rawEvent?: Record<string, unknown>;
  recoverable: boolean;
  notes?: string[];
}

export interface QuarantineSummary {
  count: number;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
  lastRecord?: QuarantineRecord;
}

export interface QuarantineStoreView extends QuarantineSummary {
  records: QuarantineRecord[];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function quarantinePayloadHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeEventSnapshot(event: unknown): Record<string, unknown> | undefined {
  if (!isRecord(event)) return undefined;

  const payload = isRecord(event.payload)
    ? event.payload
    : event.payload === undefined
      ? undefined
      : { valueType: typeof event.payload };

  return {
    eventId: typeof event.eventId === "string" ? event.eventId : event.eventId === undefined ? undefined : String(event.eventId),
    eventType: typeof event.eventType === "string" ? event.eventType : event.eventType === undefined ? undefined : String(event.eventType),
    timestamp: typeof event.timestamp === "string" ? event.timestamp : event.timestamp === undefined ? undefined : String(event.timestamp),
    source: typeof event.source === "string" ? event.source : event.source === undefined ? undefined : String(event.source),
    schemaVersion: typeof event.schemaVersion === "string" ? event.schemaVersion : event.schemaVersion === undefined ? undefined : String(event.schemaVersion),
    payload
  };
}

function sourceFromValidation(diagnostic: DomainEventValidationRejected): QuarantineSource {
  if (diagnostic.issues.some((issue) => issue.code === "event_type_invalid")) return "unknown_event_type";
  if (diagnostic.issues.some((issue) => issue.code === "payload_invalid")) return "schema_violation";
  return "invalid_event";
}

function severityFromValidation(diagnostic: DomainEventValidationRejected): QuarantineSeverity {
  if (diagnostic.issues.some((issue) => issue.code === "event_type_invalid")) return "blocking";
  if (diagnostic.issues.some((issue) => issue.code === "timestamp_in_future")) return "warning";
  return "blocking";
}

export interface QuarantineFromValidationInput {
  event: unknown;
  diagnostic: DomainEventValidationRejected;
  detectedBy?: string;
  detectedAt?: string;
  notes?: string[];
}

export interface QuarantineFromIdempotencyInput {
  event: DomainEvent;
  diagnostic: IdempotencyDiagnostic;
  detectedBy?: string;
  detectedAt?: string;
  notes?: string[];
}

export class QuarantineStore {
  private records: QuarantineRecord[] = [];
  constructor(private readonly maxRecords = 1000) {}

  add(record: QuarantineRecord): QuarantineRecord {
    this.records.push(record);
    if (this.records.length > this.maxRecords) this.records.shift();
    return record;
  }

  recordValidation(input: QuarantineFromValidationInput): QuarantineRecord {
    const rawEvent = safeEventSnapshot(input.event);
    const reason = input.diagnostic.issues.map((issue) => issue.code).join(",") || "invalid_event";
    const record: QuarantineRecord = {
      quarantineId: crypto.randomUUID(),
      reason,
      source: sourceFromValidation(input.diagnostic),
      eventId: input.diagnostic.eventId ?? (rawEvent?.eventId as string | undefined),
      eventType: input.diagnostic.eventType ?? (rawEvent?.eventType as string | undefined),
      payloadHash: quarantinePayloadHash(isRecord(input.event) ? input.event.payload : input.event),
      detectedBy: input.detectedBy ?? "core.event_validation",
      detectedAt: input.detectedAt ?? new Date().toISOString(),
      severity: severityFromValidation(input.diagnostic),
      rawEvent,
      recoverable: false,
      notes: ["rejected", ...(input.notes ?? [])]
    };
    return this.add(record);
  }

  recordIdempotencyConflict(input: QuarantineFromIdempotencyInput): QuarantineRecord {
    const record: QuarantineRecord = {
      quarantineId: crypto.randomUUID(),
      reason: input.diagnostic.reason,
      source: "idempotency_conflict",
      eventId: input.event.eventId,
      eventType: input.event.eventType,
      payloadHash: input.diagnostic.incomingFingerprint ?? quarantinePayloadHash(input.event.payload),
      detectedBy: input.detectedBy ?? "core.idempotency",
      detectedAt: input.detectedAt ?? new Date().toISOString(),
      severity: "critical",
      rawEvent: safeEventSnapshot(input.event),
      recoverable: true,
      notes: [
        `scope=${input.diagnostic.scope}`,
        `key=${input.diagnostic.key}`,
        ...(input.diagnostic.existingEventId ? [`existingEventId=${input.diagnostic.existingEventId}`] : []),
        ...(input.notes ?? [])
      ]
    };
    return this.add(record);
  }

  clear(): void {
    this.records = [];
  }

  get count(): number {
    return this.records.length;
  }

  getRecords(limit = 100): QuarantineRecord[] {
    return this.records.slice(-limit);
  }

  getSummary(): QuarantineSummary {
    const bySource: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const record of this.records) {
      bySource[record.source] = (bySource[record.source] ?? 0) + 1;
      bySeverity[record.severity] = (bySeverity[record.severity] ?? 0) + 1;
    }

    return {
      count: this.records.length,
      bySource,
      bySeverity,
      lastRecord: this.records.at(-1)
    };
  }

  getView(limit = 100): QuarantineStoreView {
    return {
      ...this.getSummary(),
      records: this.getRecords(limit)
    };
  }
}
