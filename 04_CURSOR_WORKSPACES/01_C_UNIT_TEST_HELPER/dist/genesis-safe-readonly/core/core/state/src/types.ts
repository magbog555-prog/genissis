export type DomainStatus = "unknown" | "idle" | "open" | "closed" | "ready" | "pending" | "flat" | "clear" | "blocked" | "healthy" | "degraded" | "halted" | "uncertain" | "reconcile" | "fresh" | "stale" | "conflicted" | "unavailable" | "empty" | "recorded" | "observed" | "validated" | "rejected" | "gap_detected" | "duplicate_detected" | "stale_detected" | "checksum_mismatch_detected";

export type BootstrapStatus =
  | "cold"
  | "loading_snapshot"
  | "replaying_tail"
  | "awaiting_exchange_truth"
  | "reconciled"
  | "failed";

export interface BootstrapState {
  status: BootstrapStatus;
  quarantineRequired: boolean;
  reasons: string[];
  meta: StateMeta;
}

export type ExchangeTruthStatus =
  | "unknown"
  | "fresh"
  | "stale"
  | "conflicted"
  | "unavailable";

export interface ExchangeTruthDrift {
  positionQuantity?: number;
  positionExposure?: number;
  orderCount?: number;
  fillCount?: number;
  [key: string]: number | string | boolean | undefined;
}

export interface ExchangeTruthConflict {
  code: string;
  local?: string;
  exchange?: string;
  details?: string;
}

export interface ExchangeTruthState {
  status: ExchangeTruthStatus;
  lastAccountReconcileAt?: string;
  lastPositionReconcileAt?: string;
  lastOrderReconcileAt?: string;
  lastFillSyncAt?: string;
  source?: string;
  drift: ExchangeTruthDrift;
  conflicts: ExchangeTruthConflict[];
  reason?: string;
  meta: StateMeta;
}

export type ProvenanceOriginType =
  | "observation"
  | "hypothesis"
  | "signal"
  | "decision"
  | "action"
  | "order"
  | "fill"
  | "pnl"
  | "manual"
  | "system";

export interface ProvenanceRef {
  provenanceId: string;
  originType: ProvenanceOriginType;
  originEventId: string;
  targetId: string;
  parentProvenanceIds: string[];
  source: string;
  confidence: number;
  createdAtFromEvent: string;
}

export interface MetadataAttachment {
  metadataId: string;
  targetId: string;
  key: string;
  value: unknown;
  provenanceId: string;
  createdAtFromEvent: string;
  sourceEventId: string;
}

export interface ProvenanceState {
  status: "empty" | "recorded" | "observed" | "validated" | "rejected" | "gap_detected" | "duplicate_detected" | "stale_detected" | "checksum_mismatch_detected";
  records: Record<string, ProvenanceRef>;
  metadataById: Record<string, MetadataAttachment>;
  metadataByTarget: Record<string, string[]>;
  appliedEventIds: Record<string, true>;
  meta: StateMeta;
}



export type MarketInputStatus =
  | "unknown"
  | "observed"
  | "validated"
  | "rejected"
  | "gap_detected"
  | "duplicate_detected"
  | "stale_detected"
  | "checksum_mismatch_detected";

export interface MarketInputFreshnessHint {
  maxAgeMs?: number;
  observedAgeMs?: number;
  stale?: boolean;
  reason?: string;
}

export interface MarketInputObservation {
  observationId: string;
  sourceType: "exchange" | "aggregator" | "simulated" | "manual" | "system";
  sourceName: string;
  symbol: string;
  channel: string;
  sequence: number;
  previousSequence?: number;
  exchangeTimestamp: string;
  receivedTimestampFromEvent: string;
  payloadHash: string;
  provenanceId: string;
  freshnessHint?: MarketInputFreshnessHint;
  checksum?: string;
  bookChecksum?: string;
  schemaVersion: string;
}

export interface MarketInputIssue {
  code: string;
  path: string;
  message: string;
}

export interface MarketInputState {
  status: MarketInputStatus;
  lastObservationId?: string;
  lastValidObservationId?: string;
  symbol?: string;
  channel?: string;
  sourceName?: string;
  lastSequence?: number;
  lastValidSequence?: number;
  lastExchangeTimestamp?: string;
  lastReceivedTimestampFromEvent?: string;
  lastPayloadHash?: string;
  lastProvenanceId?: string;
  observationsById: Record<string, MarketInputObservation>;
  rejectedObservationIds: string[];
  gapObservationIds: string[];
  duplicateObservationIds: string[];
  staleObservationIds: string[];
  checksumMismatchObservationIds: string[];
  issues: MarketInputIssue[];
  meta: StateMeta;
}

export interface StateMeta {
  revision: number;
  updatedAt: string;
  sourceEventId?: string;
}

export interface MarketState {
  status: "unknown" | "open" | "closed" | "uncertain";
  symbol?: string;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  lastTickAt?: string;
  freshnessMs?: number;
  provider?: string;
  meta: StateMeta;
}

export interface TradeState {
  status: "idle" | "signal_ready" | "intent_created" | "blocked";
  tradeId?: string;
  symbol?: string;
  side?: "buy" | "sell";
  quantity?: number;
  confidence?: number;
  reason?: string;
  meta: StateMeta;
}

export interface OrderState {
  status: "none" | "pending" | "placed" | "filled" | "canceled" | "cancelled" | "partially_filled" | "uncertain" | "reconcile" | "settling";
  orderId?: string;
  clientOrderId?: string;
  symbol?: string;
  side?: "buy" | "sell";
  quantity?: number;
  filledQuantity?: number;
  meta: StateMeta;
}

export interface PositionState {
  status: "unknown" | "flat" | "open" | "reconcile";
  symbol?: string;
  asset?: string;
  quoteAsset?: string;
  quantity: number;
  free?: number;
  locked?: number;
  exposure: number;
  markPrice?: number;
  source?: "exchange" | "runtime" | "manual";
  lastReconciledAt?: string;
  meta: StateMeta;
}

export interface RiskState {
  status: "clear" | "blocked";
  reasons: string[];
  maxExposure: number;
  currentExposure: number;
  meta: StateMeta;
}

export interface SystemState {
  status: "bootstrapping" | "healthy" | "degraded" | "halted";
  reasons: string[];
  startedAt: string;
  lastConnectionHeartbeatAt?: string;
  meta: StateMeta;
}

export interface RuntimeSnapshot {
  bootstrap: BootstrapState;
  exchangeTruth: ExchangeTruthState;
  provenance: ProvenanceState;
  marketInput: MarketInputState;
  market: MarketState;
  trade: TradeState;
  order: OrderState;
  position: PositionState;
  risk: RiskState;
  system: SystemState;
  revision: number;
  committedAt: string;
}

const now = () => new Date().toISOString();

export function initialSnapshot(): RuntimeSnapshot {
  const t = now();
  return {
    bootstrap: {
      status: "cold",
      quarantineRequired: false,
      reasons: ["bootstrap_not_reconciled"],
      meta: { revision: 0, updatedAt: t }
    },
    exchangeTruth: {
      status: "unknown",
      drift: {},
      conflicts: [],
      reason: "exchange_truth_unknown",
      meta: { revision: 0, updatedAt: t }
    },
    provenance: {
      status: "empty",
      records: {},
      metadataById: {},
      metadataByTarget: {},
      appliedEventIds: {},
      meta: { revision: 0, updatedAt: t }
    },
    marketInput: {
      status: "unknown",
      observationsById: {},
      rejectedObservationIds: [],
      gapObservationIds: [],
      duplicateObservationIds: [],
      staleObservationIds: [],
      checksumMismatchObservationIds: [],
      issues: [],
      meta: { revision: 0, updatedAt: t }
    },
    market: { status: "unknown", meta: { revision: 0, updatedAt: t } },
    trade: { status: "idle", meta: { revision: 0, updatedAt: t } },
    order: { status: "none", filledQuantity: 0, meta: { revision: 0, updatedAt: t } },
    position: { status: "unknown", quantity: 0, exposure: 0, meta: { revision: 0, updatedAt: t } },
    risk: {
      status: "blocked",
      reasons: ["bootstrap_position_not_reconciled"],
      maxExposure: Number(process.env.MAX_EXPOSURE_USDT ?? 1000000),
      currentExposure: 0,
      meta: { revision: 0, updatedAt: t }
    },
    system: { status: "bootstrapping", reasons: [], startedAt: t, meta: { revision: 0, updatedAt: t } },
    revision: 0,
    committedAt: t
  };
}
