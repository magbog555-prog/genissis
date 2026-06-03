import { z } from "zod";

export const EVENT_TYPE = {
  MARKET_TICK_RECEIVED: "market.tick.received",
  SIGNAL_RECEIVED: "signal.received",
  ORDER_REQUESTED: "order.requested",
  ORDER_CANCELED: "order.canceled",
  ORDER_RECONCILED: "order.reconciled",
  ORDER_EXECUTION_REPORTED: "order.execution.reported",
  ORDER_UNCERTAIN: "order.uncertain",
  POSITION_UNKNOWN: "position.unknown",
  POSITION_RECONCILED: "position.reconciled",
  BOOTSTRAP_LOADING_SNAPSHOT: "bootstrap.loading_snapshot",
  BOOTSTRAP_REPLAYING_TAIL: "bootstrap.replaying_tail",
  BOOTSTRAP_AWAITING_EXCHANGE_TRUTH: "bootstrap.awaiting_exchange_truth",
  BOOTSTRAP_RECONCILED: "bootstrap.reconciled",
  BOOTSTRAP_FAILED: "bootstrap.failed",
  BOOTSTRAP_RECOVERY_STARTED: "bootstrap.recovery_started",
  EXCHANGE_TRUTH_RECONCILE_STARTED: "exchange_truth.reconcile_started",
  EXCHANGE_TRUTH_RECONCILE_SUCCEEDED: "exchange_truth.reconcile_succeeded",
  EXCHANGE_TRUTH_RECONCILE_FAILED: "exchange_truth.reconcile_failed",
  EXCHANGE_TRUTH_STALE_DETECTED: "exchange_truth.stale_detected",
  EXCHANGE_TRUTH_CONFLICT_DETECTED: "exchange_truth.conflict_detected",
  EXCHANGE_TRUTH_UNAVAILABLE_DETECTED: "exchange_truth.unavailable_detected",
  SYSTEM_HEALTH_CHANGED: "system.health.changed",
  SYSTEM_HALTED: "system.halted",
  METADATA_ATTACHED: "metadata.attached",
  PROVENANCE_RECORDED: "provenance.recorded",
  ACTION_PROVENANCE_RECORDED: "provenance.action.recorded",
  TRADE_PROVENANCE_RECORDED: "provenance.trade.recorded",
  FILL_PROVENANCE_RECORDED: "provenance.fill.recorded",
  PNL_PROVENANCE_RECORDED: "provenance.pnl.recorded",
  METADATA_PROVENANCE_ATTACHED: "metadata.provenance.attached",
  METADATA_PROVENANCE_RECORDED: "metadata.provenance.recorded",
  METADATA_PROVENANCE_ACTION_RECORDED: "metadata.provenance.action_recorded",
  METADATA_PROVENANCE_TRADE_RECORDED: "metadata.provenance.trade_recorded",
  METADATA_PROVENANCE_FILL_RECORDED: "metadata.provenance.fill_recorded",
  METADATA_PROVENANCE_PNL_RECORDED: "metadata.provenance.pnl_recorded",
  METADATA_PROVENANCE_MISMATCH_DETECTED: "metadata.provenance.mismatch_detected",
  MARKET_INPUT_OBSERVED: "market.input.observed",
  MARKET_INPUT_OBSERVATION_RECEIVED: "market.input.observed",
  MARKET_INPUT_VALIDATED: "market.input.validated",
  MARKET_INPUT_REJECTED: "market.input.rejected",
  MARKET_INPUT_GAP_DETECTED: "market.input.gap_detected",
  MARKET_INPUT_SEQUENCE_GAP_DETECTED: "market.input.gap_detected",
  MARKET_INPUT_DUPLICATE_DETECTED: "market.input.duplicate_detected",
  MARKET_INPUT_STALE_DETECTED: "market.input.stale_detected",
  MARKET_INPUT_CHECKSUM_MISMATCH_DETECTED: "market.input.checksum_mismatch_detected",
  MARKET_INPUT_UNKNOWN_OBSERVED: "market.input.rejected"
} as const;

export type EventType = typeof EVENT_TYPE[keyof typeof EVENT_TYPE];

export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  eventType: EventType;
  timestamp: string;
  source?: string;
  schemaVersion?: string;
  payload: TPayload;
}

export const MarketTickPayloadSchema = z.object({
  symbol: z.string().min(1),
  price: z.number().positive(),
  bid: z.number().positive().optional(),
  ask: z.number().positive().optional(),
  volume: z.number().nonnegative().optional(),
  provider: z.string().optional()
});

export type MarketTickPayload = z.infer<typeof MarketTickPayloadSchema>;

export const SignalPayloadSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  confidence: z.number().min(0).max(1),
  quantity: z.number().positive().default(0.01),
  reason: z.string().optional()
});

export type SignalPayload = z.infer<typeof SignalPayloadSchema>;


export const BootstrapPayloadSchema = z.object({
  reason: z.string().optional(),
  quarantineRequired: z.boolean().optional()
});

export type BootstrapPayload = z.infer<typeof BootstrapPayloadSchema>;


export const ExchangeTruthConflictSchema = z.object({
  code: z.string().min(1),
  local: z.string().optional(),
  exchange: z.string().optional(),
  details: z.string().optional()
});

export const ExchangeTruthDriftSchema = z.record(z.union([z.number(), z.string(), z.boolean(), z.undefined()])).default({});

export const ExchangeTruthPayloadSchema = z.object({
  reason: z.string().optional(),
  source: z.string().optional(),
  lastAccountReconcileAt: z.string().optional(),
  lastPositionReconcileAt: z.string().optional(),
  lastOrderReconcileAt: z.string().optional(),
  lastFillSyncAt: z.string().optional(),
  drift: ExchangeTruthDriftSchema.optional(),
  conflicts: z.array(ExchangeTruthConflictSchema).optional(),
  localPositionStatus: z.enum(["unknown", "flat", "open", "reconcile"]).optional(),
  exchangePositionStatus: z.enum(["unknown", "flat", "open", "reconcile"]).optional(),
  exchangePositionQuantity: z.number().optional(),
  staleAfterMs: z.number().nonnegative().optional()
});

export type ExchangeTruthPayload = z.infer<typeof ExchangeTruthPayloadSchema>;


export const ProvenanceOriginTypeSchema = z.enum([
  "observation",
  "hypothesis",
  "signal",
  "decision",
  "action",
  "order",
  "fill",
  "pnl",
  "manual",
  "system"
]);

export type ProvenanceOriginType = z.infer<typeof ProvenanceOriginTypeSchema>;

export const ProvenanceRefSchema = z.object({
  provenanceId: z.string().min(1),
  originType: ProvenanceOriginTypeSchema,
  originEventId: z.string().min(1),
  targetId: z.string().min(1),
  parentProvenanceIds: z.array(z.string().min(1)).default([]),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1),
  createdAtFromEvent: z.string().min(1)
});

export type ProvenanceRef = z.infer<typeof ProvenanceRefSchema>;

export const MetadataAttachedPayloadSchema = z.object({
  metadataId: z.string().min(1),
  targetId: z.string().min(1),
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.unknown()), z.array(z.unknown())]),
  provenance: ProvenanceRefSchema,
  createdAtFromEvent: z.string().min(1)
});

export type MetadataAttachedPayload = z.infer<typeof MetadataAttachedPayloadSchema>;

export const ProvenanceRecordedPayloadSchema = ProvenanceRefSchema.extend({
  note: z.string().optional()
});

export type ProvenanceRecordedPayload = z.infer<typeof ProvenanceRecordedPayloadSchema>;

export const MetadataEventPayloadSchema = z.union([
  MetadataAttachedPayloadSchema,
  ProvenanceRecordedPayloadSchema
]);

export type MetadataEventPayload = z.infer<typeof MetadataEventPayloadSchema>;


export const MarketInputSourceTypeSchema = z.enum(["exchange", "aggregator", "simulated", "manual", "system"]);
export const MarketInputChannelSchema = z.enum(["ticker", "trade", "book", "book_delta", "kline", "mark_price", "unknown"]);

export const MarketInputFreshnessHintSchema = z.object({
  maxAgeMs: z.number().nonnegative().optional(),
  observedAgeMs: z.number().nonnegative().optional(),
  stale: z.boolean().optional(),
  reason: z.string().optional()
}).default({});

export const MarketInputObservationSchema = z.object({
  observationId: z.string().min(1),
  sourceType: MarketInputSourceTypeSchema,
  sourceName: z.string().min(1),
  symbol: z.string().min(1),
  channel: z.union([MarketInputChannelSchema, z.string().min(1)]),
  sequence: z.number().int().nonnegative(),
  previousSequence: z.number().int().nonnegative().optional(),
  exchangeTimestamp: z.string().min(1),
  receivedTimestampFromEvent: z.string().min(1),
  payloadHash: z.string().min(1),
  provenanceId: z.string().min(1),
  freshnessHint: MarketInputFreshnessHintSchema.optional(),
  checksum: z.string().min(1).optional(),
  bookChecksum: z.string().min(1).optional(),
  schemaVersion: z.string().min(1)
});

export type MarketInputObservation = z.infer<typeof MarketInputObservationSchema>;

export const MarketInputIssueSchema = z.object({
  code: z.string().min(1),
  path: z.string().min(1),
  message: z.string().min(1)
});

export const MarketInputPayloadSchema = z.object({
  observation: MarketInputObservationSchema,
  validationStatus: z.enum([
    "valid",
    "rejected",
    "gap_detected",
    "duplicate_detected",
    "stale_detected",
    "checksum_mismatch_detected"
  ]).optional(),
  issues: z.array(MarketInputIssueSchema).optional(),
  reason: z.string().optional()
});

export type MarketInputPayload = z.infer<typeof MarketInputPayloadSchema>;

export function makeEvent<T>(eventType: EventType, payload: T): DomainEvent<T> {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    source: "core",
    payload
  };
}
