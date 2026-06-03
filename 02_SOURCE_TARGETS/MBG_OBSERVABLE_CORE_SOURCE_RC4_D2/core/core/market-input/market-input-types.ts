export type MarketInputSourceType =
  | "exchange"
  | "aggregator"
  | "simulated"
  | "manual"
  | "system";

export type MarketInputChannel =
  | "ticker"
  | "trade"
  | "book"
  | "book_delta"
  | "kline"
  | "mark_price"
  | "unknown";

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
  sourceType: MarketInputSourceType;
  sourceName: string;
  symbol: string;
  channel: MarketInputChannel | string;
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

export type MarketInputValidationStatus =
  | "valid"
  | "rejected"
  | "gap_detected"
  | "duplicate_detected"
  | "stale_detected"
  | "checksum_mismatch_detected";

export interface MarketInputValidationIssue {
  code:
    | "schema_invalid"
    | "required_field_missing"
    | "sequence_not_monotonic"
    | "sequence_gap"
    | "duplicate_observation"
    | "stale_observation"
    | "provenance_missing"
    | "payload_hash_missing"
    | "checksum_mismatch";
  path: string;
  message: string;
}

export interface MarketInputValidationResult {
  status: MarketInputValidationStatus;
  observation: MarketInputObservation;
  issues: MarketInputValidationIssue[];
}
