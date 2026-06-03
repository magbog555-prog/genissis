import type { MarketInputObservation, MarketInputValidationIssue, MarketInputValidationResult } from "./market-input-types.js";
import { assessMarketInputSequence, type MarketInputSequenceGuardContext } from "./sequence-guard.js";

function issue(code: MarketInputValidationIssue["code"], path: string, message: string): MarketInputValidationIssue {
  return { code, path, message };
}

function isIsoTimestamp(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function deterministicStaleIssues(observation: MarketInputObservation): MarketInputValidationIssue[] {
  const issues: MarketInputValidationIssue[] = [];
  const exchangeMs = Date.parse(observation.exchangeTimestamp);
  const receivedMs = Date.parse(observation.receivedTimestampFromEvent);
  const maxAgeMs = observation.freshnessHint?.maxAgeMs;
  const observedAgeMs = observation.freshnessHint?.observedAgeMs;

  if (observation.freshnessHint?.stale === true) {
    issues.push(issue("stale_observation", "freshnessHint.stale", observation.freshnessHint.reason ?? "market input marked stale by event"));
  }

  if (typeof maxAgeMs === "number" && Number.isFinite(maxAgeMs) && maxAgeMs >= 0) {
    if (Number.isFinite(exchangeMs) && Number.isFinite(receivedMs) && receivedMs - exchangeMs > maxAgeMs) {
      issues.push(issue("stale_observation", "receivedTimestampFromEvent", `market input age exceeds maxAgeMs ${maxAgeMs}`));
    }

    if (typeof observedAgeMs === "number" && Number.isFinite(observedAgeMs) && observedAgeMs > maxAgeMs) {
      issues.push(issue("stale_observation", "freshnessHint.observedAgeMs", `market input observedAgeMs exceeds maxAgeMs ${maxAgeMs}`));
    }
  }

  return issues;
}

export function validateMarketInputObservation(
  observation: MarketInputObservation,
  context: MarketInputSequenceGuardContext = {}
): MarketInputValidationResult {
  const issues: MarketInputValidationIssue[] = [];

  if (!observation.observationId) issues.push(issue("required_field_missing", "observationId", "observationId is required"));
  if (!observation.sourceType) issues.push(issue("required_field_missing", "sourceType", "sourceType is required"));
  if (!observation.sourceName) issues.push(issue("required_field_missing", "sourceName", "sourceName is required"));
  if (!observation.symbol) issues.push(issue("required_field_missing", "symbol", "symbol is required"));
  if (!observation.channel) issues.push(issue("required_field_missing", "channel", "channel is required"));
  if (!Number.isInteger(observation.sequence) || observation.sequence < 0) {
    issues.push(issue("schema_invalid", "sequence", "sequence must be a non-negative integer"));
  }
  if (observation.previousSequence !== undefined && (!Number.isInteger(observation.previousSequence) || observation.previousSequence < 0)) {
    issues.push(issue("schema_invalid", "previousSequence", "previousSequence must be a non-negative integer when provided"));
  }
  if (!isIsoTimestamp(observation.exchangeTimestamp)) {
    issues.push(issue("schema_invalid", "exchangeTimestamp", "exchangeTimestamp must be an ISO-compatible timestamp"));
  }
  if (!isIsoTimestamp(observation.receivedTimestampFromEvent)) {
    issues.push(issue("schema_invalid", "receivedTimestampFromEvent", "receivedTimestampFromEvent must be an ISO-compatible timestamp supplied by the event"));
  }
  if (!observation.payloadHash) issues.push(issue("payload_hash_missing", "payloadHash", "payloadHash is required"));
  if (!observation.provenanceId) issues.push(issue("provenance_missing", "provenanceId", "provenanceId is required"));
  if (!observation.schemaVersion) issues.push(issue("schema_invalid", "schemaVersion", "schemaVersion is required"));


  if (
    observation.checksum &&
    observation.payloadHash &&
    String(observation.checksum).startsWith("sha256:") &&
    String(observation.payloadHash).startsWith("sha256:") &&
    observation.checksum !== observation.payloadHash
  ) {
    issues.push(issue("checksum_mismatch", "checksum", "market input checksum does not match payloadHash"));
  }

  issues.push(...deterministicStaleIssues(observation));
  issues.push(...assessMarketInputSequence(observation, context));

  const status =
    issues.some((i) => i.code === "duplicate_observation")
      ? "duplicate_detected"
      : issues.some((i) => i.code === "sequence_gap" || i.code === "sequence_not_monotonic")
        ? "gap_detected"
        : issues.some((i) => i.code === "stale_observation")
          ? "stale_detected"
          : issues.some((i) => i.code === "checksum_mismatch")
            ? "checksum_mismatch_detected"
            : issues.length > 0
              ? "rejected"
              : "valid";

  return { status, observation, issues };
}
