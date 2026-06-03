import crypto from "node:crypto";
import type { GateDecision, KernelTrustState } from "../contracts/src/actions.js";
import type { DomainEvent } from "../contracts/src/events.js";
import type { BlockingReason, CoreTrustReport } from "../kernel/core-trust-report.js";
import type { PermissionRecord } from "../permissions/permission-ledger.js";
import type { QuarantineRecord } from "../quarantine/quarantine.js";
import type { RuntimeSnapshot } from "../state/src/types.js";

export type TraceTransitionStatus =
  | "accepted"
  | "rejected"
  | "duplicate_ignored"
  | "duplicate_conflict"
  | "permission_evaluated"
  | "unknown";

export type ProvenanceCompletenessStatus = "complete" | "partial" | "missing" | "unknown";

export interface MetadataEventReference {
  eventId: string;
  eventType: string;
  source?: string;
  timestamp?: string;
  schemaVersion?: string;
  metadataType?: string;
  originRef?: string;
  parentProvenanceIds: string[];
  payloadHash?: string;
}

export interface ProvenanceChainLink {
  provenanceId: string;
  eventId?: string;
  eventType?: string;
  source?: string;
  originRef?: string;
  parentProvenanceIds: string[];
  metadataEventIds: string[];
  status: "observed" | "derived" | "gap";
  evidence?: string;
}

export interface ProvenanceCompleteness {
  status: ProvenanceCompletenessStatus;
  originPresent: boolean;
  metadataEventsPresent: boolean;
  parentLinksPresent: boolean;
  gaps: string[];
}

export interface ProvenanceTraceSummary {
  status: ProvenanceCompletenessStatus;
  summary: string;
  originRef?: string;
  metadataEventCount: number;
  parentProvenanceCount: number;
  gaps: string[];
}

export type MarketInputValidationStatus = "passed" | "failed" | "unknown" | "not_applicable";
export type MarketInputSequenceStatus = "ordered" | "out_of_order" | "unknown" | "not_applicable";
export type MarketInputGapStatus = "none" | "gap" | "unknown" | "not_applicable";
export type MarketInputDuplicateStatus = "none" | "duplicate" | "conflict" | "unknown" | "not_applicable";
export type MarketInputFreshnessStatus = "fresh" | "stale" | "expired" | "unavailable" | "unknown" | "not_applicable";
export type MarketInputChecksumStatus = "valid" | "mismatch" | "missing" | "unknown" | "not_applicable";

export interface MarketInputObservation {
  eventId: string;
  eventType: string;
  source?: string;
  symbol?: string;
  provider?: string;
  timestamp?: string;
  price?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  sequence?: string | number;
}

export interface MarketInputValidationResult {
  status: MarketInputValidationStatus;
  issues: string[];
  evidence?: Record<string, unknown>;
}

export interface MarketInputIntegritySummary {
  applicable: boolean;
  status: "valid" | "rejected" | "issue" | "unknown" | "not_applicable";
  summary: string;
  issues: string[];
  snapshotMutated: boolean;
  trustChanged: boolean;
  verdictAffected: boolean;
}

export interface BlockingReasonDiff {
  added: BlockingReason[];
  removed: BlockingReason[];
  unchanged: BlockingReason[];
}

export interface TrustStateDiff {
  before: KernelTrustState;
  after: KernelTrustState;
  changed: boolean;
}

export interface ChangedDomainSummary {
  changedDomains: string[];
  domains: Record<string, {
    changed: boolean;
    statusBefore?: string;
    statusAfter?: string;
    revisionBefore?: number;
    revisionAfter?: number;
  }>;
}

export interface CausalityTrace {
  traceId: string;
  eventId: string;
  eventType: string;
  source?: string;
  revisionBefore: number;
  revisionAfter: number;
  changedDomains: string[];
  reducerName: string;
  transitionStatus: TraceTransitionStatus;
  blockingReasonsBefore: BlockingReason[];
  blockingReasonsAfter: BlockingReason[];
  blockingReasonsDiff: BlockingReasonDiff;
  trustStateBefore: KernelTrustState;
  trustStateAfter: KernelTrustState;
  trustStateDiff: TrustStateDiff;
  gateVerdictBefore?: GateDecision;
  gateVerdictAfter?: GateDecision;
  recoveryPlanBefore?: unknown;
  recoveryPlanAfter?: unknown;
  quarantineRecordId?: string;
  permissionRecordId?: string;
  hashChainLinkId?: string;
  provenanceChain: ProvenanceChainLink[];
  metadataEvents: MetadataEventReference[];
  originRef?: string;
  parentProvenanceIds: string[];
  provenanceCompleteness: ProvenanceCompleteness;
  provenanceTraceSummary: ProvenanceTraceSummary;
  marketInputObservation?: MarketInputObservation;
  validationResult: MarketInputValidationResult;
  sequenceStatus: MarketInputSequenceStatus;
  gapStatus: MarketInputGapStatus;
  duplicateStatus: MarketInputDuplicateStatus;
  freshnessStatus: MarketInputFreshnessStatus;
  provenanceRef?: string;
  payloadHash?: string;
  checksumStatus: MarketInputChecksumStatus;
  marketInputIntegritySummary: MarketInputIntegritySummary;
  generatedAt: string;
  traceVersion: "causality-trace-v2";
  summary: string;
}

export interface BuildCausalityTraceInput {
  event?: Partial<DomainEvent> | undefined;
  eventId?: string;
  eventType?: string;
  source?: string;
  beforeSnapshot: RuntimeSnapshot;
  afterSnapshot: RuntimeSnapshot;
  beforeReport: CoreTrustReport;
  afterReport: CoreTrustReport;
  reducerName?: string;
  transitionStatus: TraceTransitionStatus;
  gateVerdictBefore?: GateDecision;
  gateVerdictAfter?: GateDecision;
  recoveryPlanBefore?: unknown;
  recoveryPlanAfter?: unknown;
  quarantineRecord?: QuarantineRecord;
  quarantineRecordId?: string;
  permissionRecord?: PermissionRecord;
  permissionRecordId?: string;
  hashChainLinkId?: string;
  metadataEvents?: unknown[];
  provenanceChain?: ProvenanceChainLink[];
  originRef?: string;
  parentProvenanceIds?: string[];
  marketInputObservation?: MarketInputObservation;
  validationResult?: MarketInputValidationResult;
  sequenceStatus?: MarketInputSequenceStatus;
  gapStatus?: MarketInputGapStatus;
  duplicateStatus?: MarketInputDuplicateStatus;
  freshnessStatus?: MarketInputFreshnessStatus;
  provenanceRef?: string;
  payloadHash?: string;
  checksumStatus?: MarketInputChecksumStatus;
  generatedAt?: string;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stable(nested)])
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

function hashUnknown(value: unknown): string {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function statusOf(value: unknown): string | undefined {
  return value && typeof value === "object" && "status" in value
    ? String((value as { status?: unknown }).status)
    : undefined;
}

function revisionOf(value: unknown): number | undefined {
  const meta = value && typeof value === "object" && "meta" in value
    ? (value as { meta?: { revision?: unknown } }).meta
    : undefined;
  return typeof meta?.revision === "number" ? meta.revision : undefined;
}

function reasonKey(reason: BlockingReason): string {
  return `${reason.domain}:${reason.code}:${reason.severity}`;
}

export function summarizeChangedDomains(beforeSnapshot: RuntimeSnapshot, afterSnapshot: RuntimeSnapshot): ChangedDomainSummary {
  const domainNames = ["bootstrap", "exchangeTruth", "market", "trade", "order", "position", "risk", "system"] as const;
  const domains: ChangedDomainSummary["domains"] = {};
  const changedDomains: string[] = [];

  for (const domain of domainNames) {
    const before = beforeSnapshot[domain];
    const after = afterSnapshot[domain];
    const changed = stableJson(before) !== stableJson(after);
    domains[domain] = {
      changed,
      statusBefore: statusOf(before),
      statusAfter: statusOf(after),
      revisionBefore: revisionOf(before),
      revisionAfter: revisionOf(after)
    };
    if (changed) changedDomains.push(domain);
  }

  return { changedDomains, domains };
}

export function compareBlockingReasons(before: BlockingReason[] = [], after: BlockingReason[] = []): BlockingReasonDiff {
  const beforeMap = new Map(before.map((reason) => [reasonKey(reason), reason]));
  const afterMap = new Map(after.map((reason) => [reasonKey(reason), reason]));

  return {
    added: [...afterMap.entries()].filter(([key]) => !beforeMap.has(key)).map(([, value]) => value),
    removed: [...beforeMap.entries()].filter(([key]) => !afterMap.has(key)).map(([, value]) => value),
    unchanged: [...afterMap.entries()].filter(([key]) => beforeMap.has(key)).map(([, value]) => value)
  };
}

export function compareTrustState(before: KernelTrustState, after: KernelTrustState): TrustStateDiff {
  return { before, after, changed: before !== after };
}

export function attachGateVerdict(trace: CausalityTrace, verdict: GateDecision, phase: "before" | "after" = "after"): CausalityTrace {
  return phase === "before"
    ? { ...trace, gateVerdictBefore: verdict }
    : { ...trace, gateVerdictAfter: verdict };
}

export function attachLedgerRecord(trace: CausalityTrace, record?: PermissionRecord | string): CausalityTrace {
  if (!record) return trace;
  return { ...trace, permissionRecordId: typeof record === "string" ? record : record.permissionId };
}

export function attachQuarantineRecord(trace: CausalityTrace, record?: QuarantineRecord | string): CausalityTrace {
  if (!record) return trace;
  return { ...trace, quarantineRecordId: typeof record === "string" ? record : record.quarantineId };
}

function candidateProvenanceRecords(event?: Partial<DomainEvent>): Record<string, unknown>[] {
  const eventRecord = asRecord(event);
  const payload = asRecord(eventRecord?.payload);
  const metadata = asRecord(payload?.metadata) ?? asRecord(eventRecord?.metadata);
  const provenance = asRecord(payload?.provenance) ?? asRecord(metadata?.provenance) ?? asRecord(eventRecord?.provenance);
  return [eventRecord, payload, metadata, provenance].filter((candidate): candidate is Record<string, unknown> => Boolean(candidate));
}

function extractOriginRef(event?: Partial<DomainEvent>, explicit?: string): string | undefined {
  if (explicit) return explicit;
  for (const candidate of candidateProvenanceRecords(event)) {
    const origin = stringValue(candidate.originRef)
      ?? stringValue(candidate.origin)
      ?? stringValue(candidate.originId)
      ?? stringValue(candidate.sourceRef)
      ?? stringValue(candidate.provenanceId);
    if (origin) return origin;
  }
  return undefined;
}

function extractParentProvenanceIds(event?: Partial<DomainEvent>, explicit?: string[]): string[] {
  if (explicit) return [...explicit].sort();
  const parents = new Set<string>();
  for (const candidate of candidateProvenanceRecords(event)) {
    for (const value of [
      ...stringArray(candidate.parentProvenanceIds),
      ...stringArray(candidate.parentIds),
      ...stringArray(candidate.parents),
      ...stringArray(candidate.causationChain)
    ]) parents.add(value);
  }
  return [...parents].sort();
}

function normalizeMetadataEvent(raw: unknown, fallbackIndex: number): MetadataEventReference | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const payload = asRecord(record.payload);
  const provenance = asRecord(record.provenance) ?? asRecord(payload?.provenance) ?? asRecord(asRecord(payload?.metadata)?.provenance);
  const parentProvenanceIds = [
    ...stringArray(record.parentProvenanceIds),
    ...stringArray(provenance?.parentProvenanceIds)
  ].sort();
  const eventId = stringValue(record.eventId) ?? stringValue(record.metadataEventId) ?? `metadata:${hashUnknown(record).slice(0, 16)}:${fallbackIndex}`;
  const eventType = stringValue(record.eventType) ?? stringValue(record.type) ?? "metadata.event";
  const originRef = stringValue(record.originRef) ?? stringValue(provenance?.originRef);
  return {
    eventId,
    eventType,
    source: stringValue(record.source),
    timestamp: stringValue(record.timestamp),
    schemaVersion: stringValue(record.schemaVersion),
    metadataType: stringValue(record.metadataType) ?? stringValue(record.kind),
    originRef,
    parentProvenanceIds,
    payloadHash: stringValue(record.payloadHash) ?? hashUnknown(payload ?? record)
  };
}

function extractMetadataEvents(event?: Partial<DomainEvent>, explicit: unknown[] = []): MetadataEventReference[] {
  const eventRecord = asRecord(event);
  const payload = asRecord(eventRecord?.payload);
  const metadata = asRecord(payload?.metadata) ?? asRecord(eventRecord?.metadata);
  const provenance = asRecord(payload?.provenance) ?? asRecord(metadata?.provenance) ?? asRecord(eventRecord?.provenance);

  const candidates: unknown[] = [
    ...explicit,
    ...((Array.isArray(eventRecord?.metadataEvents) ? eventRecord?.metadataEvents : []) as unknown[]),
    ...((Array.isArray(payload?.metadataEvents) ? payload?.metadataEvents : []) as unknown[]),
    ...((Array.isArray(metadata?.events) ? metadata?.events : []) as unknown[]),
    ...((Array.isArray(provenance?.metadataEvents) ? provenance?.metadataEvents : []) as unknown[])
  ];

  return candidates
    .map((candidate, index) => normalizeMetadataEvent(candidate, index))
    .filter((candidate): candidate is MetadataEventReference => Boolean(candidate))
    .sort((a, b) => a.eventId.localeCompare(b.eventId));
}

function buildProvenanceCompleteness(input: {
  originRef?: string;
  metadataEvents: MetadataEventReference[];
  parentProvenanceIds: string[];
}): ProvenanceCompleteness {
  const gaps: string[] = [];
  if (!input.originRef) gaps.push("origin_ref_missing");
  if (input.metadataEvents.length === 0) gaps.push("metadata_events_missing");

  const originPresent = Boolean(input.originRef);
  const metadataEventsPresent = input.metadataEvents.length > 0;
  const parentLinksPresent = input.parentProvenanceIds.length > 0 || input.metadataEvents.some((event) => event.parentProvenanceIds.length > 0);
  const status: ProvenanceCompletenessStatus =
    gaps.length === 0 ? "complete"
      : gaps.length === 2 ? "missing"
        : "partial";

  return { status, originPresent, metadataEventsPresent, parentLinksPresent, gaps };
}

function buildProvenanceChain(input: {
  eventId: string;
  eventType: string;
  source?: string;
  originRef?: string;
  parentProvenanceIds: string[];
  metadataEvents: MetadataEventReference[];
  explicit?: ProvenanceChainLink[];
}): ProvenanceChainLink[] {
  if (input.explicit && input.explicit.length > 0) return input.explicit;
  if (!input.originRef && input.metadataEvents.length === 0 && input.parentProvenanceIds.length === 0) {
    return [{
      provenanceId: `provenance:gap:${hashUnknown({ eventId: input.eventId, eventType: input.eventType }).slice(0, 16)}`,
      eventId: input.eventId,
      eventType: input.eventType,
      source: input.source,
      parentProvenanceIds: [],
      metadataEventIds: [],
      status: "gap",
      evidence: "missing_provenance"
    }];
  }

  const provenanceId = `provenance:${hashUnknown({
    eventId: input.eventId,
    eventType: input.eventType,
    originRef: input.originRef,
    parentProvenanceIds: input.parentProvenanceIds,
    metadataEventIds: input.metadataEvents.map((event) => event.eventId)
  }).slice(0, 24)}`;

  return [{
    provenanceId,
    eventId: input.eventId,
    eventType: input.eventType,
    source: input.source,
    originRef: input.originRef,
    parentProvenanceIds: input.parentProvenanceIds,
    metadataEventIds: input.metadataEvents.map((event) => event.eventId),
    status: input.originRef ? "observed" : "derived",
    evidence: input.metadataEvents.length > 0 ? "metadata_events_observed" : "metadata_gap_observed"
  }];
}

function summarizeProvenance(input: {
  completeness: ProvenanceCompleteness;
  originRef?: string;
  metadataEvents: MetadataEventReference[];
  parentProvenanceIds: string[];
}): ProvenanceTraceSummary {
  const summary =
    input.completeness.status === "complete"
      ? `provenance complete from ${input.originRef}; metadata events=${input.metadataEvents.length}; parents=${input.parentProvenanceIds.length}`
      : `provenance ${input.completeness.status}; gaps=${input.completeness.gaps.join(",") || "none"}; metadata events=${input.metadataEvents.length}; parents=${input.parentProvenanceIds.length}`;
  return {
    status: input.completeness.status,
    summary,
    originRef: input.originRef,
    metadataEventCount: input.metadataEvents.length,
    parentProvenanceCount: input.parentProvenanceIds.length,
    gaps: input.completeness.gaps
  };
}


function numericValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function boolValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const stringified = stringValue(value);
    if (stringified) return stringified;
  }
  return undefined;
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  for (const value of values) {
    const record = asRecord(value);
    if (record) return record;
  }
  return undefined;
}

function marketInputRecord(event?: Partial<DomainEvent>): Record<string, unknown> | undefined {
  const eventRecord = asRecord(event);
  const payload = asRecord(eventRecord?.payload);
  return firstRecord(payload?.marketInputIntegrity, payload?.marketInput, eventRecord?.marketInputIntegrity, eventRecord?.marketInput);
}

function isMarketInputEvent(eventId: string, eventType: string, event?: Partial<DomainEvent>): boolean {
  const eventRecord = asRecord(event);
  const payload = asRecord(eventRecord?.payload);
  if (eventType.includes("market")) return true;
  if (marketInputRecord(event)) return true;
  return Boolean(payload && (
    "price" in payload ||
    "bid" in payload ||
    "ask" in payload ||
    "provider" in payload ||
    "marketInputIntegrity" in payload
  ));
}

function extractMarketInputObservation(input: {
  eventId: string;
  eventType: string;
  source?: string;
  event?: Partial<DomainEvent>;
  explicit?: MarketInputObservation;
}): MarketInputObservation | undefined {
  if (input.explicit) return input.explicit;
  if (!isMarketInputEvent(input.eventId, input.eventType, input.event)) return undefined;
  const eventRecord = asRecord(input.event);
  const payload = asRecord(eventRecord?.payload);
  const marketInput = marketInputRecord(input.event);
  const sequence = marketInput?.sequence ?? marketInput?.sequenceNumber ?? marketInput?.updateId ?? payload?.sequence ?? payload?.sequenceNumber ?? payload?.updateId;
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    source: input.source,
    symbol: firstString(marketInput?.symbol, payload?.symbol),
    provider: firstString(marketInput?.provider, payload?.provider, input.source),
    timestamp: firstString(marketInput?.timestamp, payload?.timestamp, eventRecord?.timestamp),
    price: numericValue(marketInput?.price) ?? numericValue(payload?.price),
    bid: numericValue(marketInput?.bid) ?? numericValue(payload?.bid),
    ask: numericValue(marketInput?.ask) ?? numericValue(payload?.ask),
    volume: numericValue(marketInput?.volume) ?? numericValue(payload?.volume),
    sequence: typeof sequence === "string" || typeof sequence === "number" ? sequence : undefined
  };
}

function statusString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extractValidationResult(input: {
  event?: Partial<DomainEvent>;
  transitionStatus: TraceTransitionStatus;
  observation?: MarketInputObservation;
  explicit?: MarketInputValidationResult;
  quarantineRecordId?: string;
}): MarketInputValidationResult {
  if (input.explicit) return input.explicit;
  if (!input.observation) return { status: "not_applicable", issues: [] };

  const marketInput = marketInputRecord(input.event);
  const validation = firstRecord(marketInput?.validationResult, marketInput?.validation, asRecord(input.event)?.validationResult);
  const explicitStatus = statusString(validation?.status);
  const explicitIssues = stringArray(validation?.issues);

  if (explicitStatus === "passed" || explicitStatus === "valid") return { status: "passed", issues: explicitIssues };
  if (explicitStatus === "failed" || explicitStatus === "invalid" || explicitStatus === "rejected") return { status: "failed", issues: explicitIssues };

  if (input.transitionStatus === "accepted" || input.transitionStatus === "duplicate_ignored") return { status: "passed", issues: [] };
  if (input.transitionStatus === "rejected" || input.transitionStatus === "duplicate_conflict") {
    return {
      status: "failed",
      issues: input.quarantineRecordId ? ["quarantined"] : ["rejected"],
      evidence: input.quarantineRecordId ? { quarantineRecordId: input.quarantineRecordId } : undefined
    };
  }

  return { status: "unknown", issues: [] };
}

function normalizeSequenceStatus(value: unknown, observation?: MarketInputObservation): MarketInputSequenceStatus {
  const status = statusString(value);
  if (status === "ordered" || status === "out_of_order" || status === "unknown" || status === "not_applicable") return status;
  if (status === "ok" || status === "valid" || status === "in_order") return "ordered";
  if (status === "gap" || status === "violation" || status === "out-of-order") return "out_of_order";
  if (!observation) return "not_applicable";
  return observation.sequence === undefined ? "unknown" : "ordered";
}

function normalizeGapStatus(value: unknown, observation?: MarketInputObservation): MarketInputGapStatus {
  const status = statusString(value);
  if (status === "none" || status === "gap" || status === "unknown" || status === "not_applicable") return status;
  if (status === "ok" || status === "no_gap") return "none";
  if (status === "detected" || status === "sequence_gap") return "gap";
  const bool = boolValue(value);
  if (bool === true) return "gap";
  if (bool === false) return "none";
  return observation ? "unknown" : "not_applicable";
}

function normalizeDuplicateStatus(input: {
  value?: unknown;
  transitionStatus: TraceTransitionStatus;
  observation?: MarketInputObservation;
}): MarketInputDuplicateStatus {
  if (input.transitionStatus === "duplicate_ignored") return "duplicate";
  if (input.transitionStatus === "duplicate_conflict") return "conflict";

  const status = statusString(input.value);
  if (status === "none" || status === "duplicate" || status === "conflict" || status === "unknown" || status === "not_applicable") return status;
  if (status === "duplicate_ignored") return "duplicate";
  if (status === "duplicate_conflict") return "conflict";
  return input.observation ? "none" : "not_applicable";
}

function normalizeFreshnessStatus(input: {
  value?: unknown;
  observation?: MarketInputObservation;
  beforeReport: CoreTrustReport;
  afterReport: CoreTrustReport;
}): MarketInputFreshnessStatus {
  const status = statusString(input.value);
  if (
    status === "fresh" ||
    status === "stale" ||
    status === "expired" ||
    status === "unavailable" ||
    status === "unknown" ||
    status === "not_applicable"
  ) return status;

  const afterFreshness = asRecord(asRecord(input.afterReport.freshness)?.marketDataFreshness);
  const reportStatus = statusString(afterFreshness?.status);
  if (
    reportStatus === "fresh" ||
    reportStatus === "stale" ||
    reportStatus === "expired" ||
    reportStatus === "unavailable" ||
    reportStatus === "unknown"
  ) return reportStatus;

  return input.observation ? "unknown" : "not_applicable";
}

function normalizeChecksumStatus(value: unknown, payloadHash?: string, observation?: MarketInputObservation): MarketInputChecksumStatus {
  const status = statusString(value);
  if (status === "valid" || status === "mismatch" || status === "missing" || status === "unknown" || status === "not_applicable") return status;
  if (status === "ok" || status === "matched") return "valid";
  if (status === "failed" || status === "invalid") return "mismatch";
  if (!observation) return "not_applicable";
  return payloadHash ? "valid" : "missing";
}

function extractPayloadHash(event?: Partial<DomainEvent>, explicit?: string): string | undefined {
  if (explicit) return explicit;
  const eventRecord = asRecord(event);
  const payload = asRecord(eventRecord?.payload);
  const marketInput = marketInputRecord(event);
  return firstString(
    marketInput?.payloadHash,
    marketInput?.hash,
    payload?.payloadHash,
    payload?.checksum,
    eventRecord?.payloadHash
  ) ?? (payload ? hashUnknown(payload) : undefined);
}

function buildMarketInputIntegritySummary(input: {
  observation?: MarketInputObservation;
  validationResult: MarketInputValidationResult;
  sequenceStatus: MarketInputSequenceStatus;
  gapStatus: MarketInputGapStatus;
  duplicateStatus: MarketInputDuplicateStatus;
  freshnessStatus: MarketInputFreshnessStatus;
  checksumStatus: MarketInputChecksumStatus;
  snapshotMutated: boolean;
  trustChanged: boolean;
  verdictAffected: boolean;
  provenanceRef?: string;
}): MarketInputIntegritySummary {
  if (!input.observation) {
    return {
      applicable: false,
      status: "not_applicable",
      summary: "not a market input event",
      issues: [],
      snapshotMutated: input.snapshotMutated,
      trustChanged: input.trustChanged,
      verdictAffected: input.verdictAffected
    };
  }

  const issues: string[] = [];
  if (input.validationResult.status === "failed") issues.push("validation_failed");
  if (input.sequenceStatus === "out_of_order") issues.push("sequence_violation");
  if (input.gapStatus === "gap") issues.push("sequence_gap");
  if (input.duplicateStatus === "duplicate") issues.push("duplicate");
  if (input.duplicateStatus === "conflict") issues.push("duplicate_conflict");
  if (input.freshnessStatus === "stale" || input.freshnessStatus === "expired" || input.freshnessStatus === "unavailable") issues.push(`freshness_${input.freshnessStatus}`);
  if (input.freshnessStatus === "unknown") issues.push("freshness_unknown");
  if (input.checksumStatus === "mismatch") issues.push("checksum_mismatch");
  if (!input.provenanceRef) issues.push("provenance_missing");

  const status: MarketInputIntegritySummary["status"] =
    input.validationResult.status === "failed" ? "rejected"
      : issues.length > 0 ? "issue"
        : input.validationResult.status === "unknown" ? "unknown"
          : "valid";

  const summary = `market input ${input.observation.eventType} ${status}; validation=${input.validationResult.status}; sequence=${input.sequenceStatus}; gap=${input.gapStatus}; duplicate=${input.duplicateStatus}; freshness=${input.freshnessStatus}; checksum=${input.checksumStatus}; provenance=${input.provenanceRef ? "present" : "missing"}; snapshotMutated=${input.snapshotMutated}`;

  return {
    applicable: true,
    status,
    summary,
    issues,
    snapshotMutated: input.snapshotMutated,
    trustChanged: input.trustChanged,
    verdictAffected: input.verdictAffected
  };
}

function deterministicTraceId(input: {
  eventId: string;
  eventType: string;
  revisionBefore: number;
  revisionAfter: number;
  transitionStatus: TraceTransitionStatus;
  changedDomains: string[];
  quarantineRecordId?: string;
  permissionRecordId?: string;
  hashChainLinkId?: string;
  originRef?: string;
  parentProvenanceIds: string[];
  metadataEventIds: string[];
  provenanceCompletenessStatus: ProvenanceCompletenessStatus;
}): string {
  const digest = crypto
    .createHash("sha256")
    .update(stableJson(input))
    .digest("hex");
  return `trace:${digest.slice(0, 24)}`;
}

function summarize(input: {
  eventType: string;
  transitionStatus: TraceTransitionStatus;
  changedDomains: string[];
  trustChanged: boolean;
  trustStateBefore: KernelTrustState;
  trustStateAfter: KernelTrustState;
  addedBlockers: number;
  removedBlockers: number;
  provenanceStatus: ProvenanceCompletenessStatus;
  metadataEventCount: number;
  marketInputSummary?: string;
}): string {
  const domains = input.changedDomains.length ? input.changedDomains.join(", ") : "no domains";
  const trust = input.trustChanged
    ? `trust ${input.trustStateBefore} -> ${input.trustStateAfter}`
    : `trust remained ${input.trustStateAfter}`;
  const market = input.marketInputSummary ? `; ${input.marketInputSummary}` : "";
  return `${input.eventType} ${input.transitionStatus}; provenance ${input.provenanceStatus} metadata=${input.metadataEventCount}; changed ${domains}; ${trust}; blockers +${input.addedBlockers}/-${input.removedBlockers}${market}`;
}

export function buildCausalityTrace(input: BuildCausalityTraceInput): CausalityTrace {
  const eventId = String(input.event?.eventId ?? input.eventId ?? "none");
  const eventType = String(input.event?.eventType ?? input.eventType ?? "unknown");
  const source = input.event?.source ?? input.source;
  const domainSummary = summarizeChangedDomains(input.beforeSnapshot, input.afterSnapshot);
  const blockingReasonsBefore = input.beforeReport.blockingReasons ?? [];
  const blockingReasonsAfter = input.afterReport.blockingReasons ?? [];
  const blockingReasonsDiff = compareBlockingReasons(blockingReasonsBefore, blockingReasonsAfter);
  const trustStateDiff = compareTrustState(input.beforeReport.trustState, input.afterReport.trustState);
  const quarantineRecordId = input.quarantineRecord?.quarantineId ?? input.quarantineRecordId;
  const permissionRecordId = input.permissionRecord?.permissionId ?? input.permissionRecordId;
  const metadataEvents = extractMetadataEvents(input.event, input.metadataEvents);
  const originRef = extractOriginRef(input.event, input.originRef);
  const parentProvenanceIds = extractParentProvenanceIds(input.event, input.parentProvenanceIds);
  const provenanceCompleteness = buildProvenanceCompleteness({ originRef, metadataEvents, parentProvenanceIds });
  const provenanceChain = buildProvenanceChain({
    eventId,
    eventType,
    source,
    originRef,
    parentProvenanceIds,
    metadataEvents,
    explicit: input.provenanceChain
  });
  const provenanceTraceSummary = summarizeProvenance({
    completeness: provenanceCompleteness,
    originRef,
    metadataEvents,
    parentProvenanceIds
  });
  const payloadHash = extractPayloadHash(input.event, input.payloadHash);
  const marketInputObservation = extractMarketInputObservation({
    eventId,
    eventType,
    source,
    event: input.event,
    explicit: input.marketInputObservation
  });
  const marketInput = marketInputRecord(input.event);
  const validationResult = extractValidationResult({
    event: input.event,
    transitionStatus: input.transitionStatus,
    observation: marketInputObservation,
    explicit: input.validationResult,
    quarantineRecordId
  });
  const sequenceStatus = input.sequenceStatus ?? normalizeSequenceStatus(marketInput?.sequenceStatus ?? marketInput?.sequence, marketInputObservation);
  const gapStatus = input.gapStatus ?? normalizeGapStatus(marketInput?.gapStatus ?? marketInput?.gapDetected, marketInputObservation);
  const duplicateStatus = input.duplicateStatus ?? normalizeDuplicateStatus({
    value: marketInput?.duplicateStatus,
    transitionStatus: input.transitionStatus,
    observation: marketInputObservation
  });
  const freshnessStatus = input.freshnessStatus ?? normalizeFreshnessStatus({
    value: marketInput?.freshnessStatus,
    observation: marketInputObservation,
    beforeReport: input.beforeReport,
    afterReport: input.afterReport
  });
  const provenanceRef = input.provenanceRef ?? originRef;
  const checksumStatus = input.checksumStatus ?? normalizeChecksumStatus(marketInput?.checksumStatus ?? marketInput?.checksum, payloadHash, marketInputObservation);
  const snapshotMutated = input.beforeSnapshot.revision !== input.afterSnapshot.revision || domainSummary.changedDomains.length > 0;
  const verdictAffected = Boolean(input.gateVerdictBefore || input.gateVerdictAfter) || blockingReasonsDiff.added.length > 0 || blockingReasonsDiff.removed.length > 0;
  const marketInputIntegritySummary = buildMarketInputIntegritySummary({
    observation: marketInputObservation,
    validationResult,
    sequenceStatus,
    gapStatus,
    duplicateStatus,
    freshnessStatus,
    checksumStatus,
    snapshotMutated,
    trustChanged: trustStateDiff.changed,
    verdictAffected,
    provenanceRef
  });

  const traceBase = {
    eventId,
    eventType,
    revisionBefore: input.beforeSnapshot.revision,
    revisionAfter: input.afterSnapshot.revision,
    transitionStatus: input.transitionStatus,
    changedDomains: domainSummary.changedDomains,
    quarantineRecordId,
    permissionRecordId,
    hashChainLinkId: input.hashChainLinkId,
    originRef,
    parentProvenanceIds,
    metadataEventIds: metadataEvents.map((event) => event.eventId),
    provenanceCompletenessStatus: provenanceCompleteness.status,
    marketInputStatus: marketInputIntegritySummary.status,
    validationStatus: validationResult.status,
    sequenceStatus,
    gapStatus,
    duplicateStatus,
    freshnessStatus,
    checksumStatus,
    payloadHash
  };

  return {
    traceId: deterministicTraceId(traceBase),
    eventId,
    eventType,
    source,
    revisionBefore: input.beforeSnapshot.revision,
    revisionAfter: input.afterSnapshot.revision,
    changedDomains: domainSummary.changedDomains,
    reducerName: input.reducerName ?? "reduceSnapshot",
    transitionStatus: input.transitionStatus,
    blockingReasonsBefore,
    blockingReasonsAfter,
    blockingReasonsDiff,
    trustStateBefore: input.beforeReport.trustState,
    trustStateAfter: input.afterReport.trustState,
    trustStateDiff,
    gateVerdictBefore: input.gateVerdictBefore,
    gateVerdictAfter: input.gateVerdictAfter,
    recoveryPlanBefore: input.recoveryPlanBefore,
    recoveryPlanAfter: input.recoveryPlanAfter,
    quarantineRecordId,
    permissionRecordId,
    hashChainLinkId: input.hashChainLinkId,
    provenanceChain,
    metadataEvents,
    originRef,
    parentProvenanceIds,
    provenanceCompleteness,
    provenanceTraceSummary,
    marketInputObservation,
    validationResult,
    sequenceStatus,
    gapStatus,
    duplicateStatus,
    freshnessStatus,
    provenanceRef,
    payloadHash,
    checksumStatus,
    marketInputIntegritySummary,
    generatedAt: input.generatedAt ?? new Date(0).toISOString(),
    traceVersion: "causality-trace-v2",
    summary: summarize({
      eventType,
      transitionStatus: input.transitionStatus,
      changedDomains: domainSummary.changedDomains,
      trustChanged: trustStateDiff.changed,
      trustStateBefore: trustStateDiff.before,
      trustStateAfter: trustStateDiff.after,
      addedBlockers: blockingReasonsDiff.added.length,
      removedBlockers: blockingReasonsDiff.removed.length,
      provenanceStatus: provenanceCompleteness.status,
      metadataEventCount: metadataEvents.length,
      marketInputSummary: marketInputIntegritySummary.applicable ? marketInputIntegritySummary.summary : undefined
    })
  };
}


export type ObservableTraceStepKind =
  | "event"
  | "metadata_provenance"
  | "transition"
  | "snapshot"
  | "trust"
  | "gate_verdict"
  | "permission_ledger"
  | "quarantine"
  | "recovery"
  | "integrity_failure"
  | "market_input";

export type ObservableTraceStepStatus =
  | "ok"
  | "blocked"
  | "gap"
  | "warning"
  | "failed"
  | "unknown"
  | "not_applicable";

export interface ObservableRevisionCursor {
  revisionBefore: number;
  revisionAfter: number;
  cursor: string;
  isMutation: boolean;
}

export interface ObservableTraceStep {
  observableId: string;
  order: number;
  kind: ObservableTraceStepKind;
  status: ObservableTraceStepStatus;
  label: string;
  summary: string;
  traceId: string;
  eventId: string;
  eventType: string;
  revision: ObservableRevisionCursor;
  refs: {
    provenanceIds: string[];
    metadataEventIds: string[];
    quarantineRecordId?: string;
    permissionRecordId?: string;
    hashChainLinkId?: string;
  };
  payload?: Record<string, unknown>;
}

export interface ObservableRevisionHistoryEntry {
  cursor: string;
  revisionBefore: number;
  revisionAfter: number;
  traceId: string;
  eventId: string;
  eventType: string;
  transitionStatus: TraceTransitionStatus;
  changedDomains: string[];
  snapshotMutated: boolean;
  summary: string;
}

export interface ObservableReplayStep {
  order: number;
  cursor: string;
  traceId: string;
  eventId: string;
  eventType: string;
  transitionStatus: TraceTransitionStatus;
  replaySafe: boolean;
  hashChainLinkId?: string;
  summary: string;
}

export interface ObservableTimeTravelSemantics {
  cursorField: "revisionCursor";
  orderingRule: string;
  mutationRule: string;
  readOnlyRule: string;
}


export type ReplayNavigationDirection = "previous" | "current" | "next" | "latest";
export type ReplayObservableStatus = "accepted" | "rejected" | "duplicate_ignored" | "duplicate_conflict" | "permission_evaluated" | "unknown";

export interface RevisionTimelineEntry {
  cursor: string;
  order: number;
  revisionBefore: number;
  revisionAfter: number;
  traceId: string;
  eventId: string;
  eventType: string;
  transitionStatus: TraceTransitionStatus;
  snapshotMutated: boolean;
  changedDomains: string[];
  hashChainLinkId?: string;
  summary: string;
}

export interface SnapshotTimelineEntry {
  cursor: string;
  order: number;
  revision: number;
  revisionBefore: number;
  revisionAfter: number;
  traceId: string;
  eventId: string;
  eventType: string;
  changedDomains: string[];
  snapshotMutated: boolean;
  transitionStatus: TraceTransitionStatus;
  summary: string;
}

export interface ReplayNavigationSemantics {
  selectedCursor?: string;
  currentIndex: number;
  previousCursor?: string;
  nextCursor?: string;
  latestCursor?: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  readOnly: true;
  noExecutionReplay: true;
  noStateMutation: true;
  noWebsocketAuthority: true;
  cursorRule: string;
  orderingRule: string;
}

export interface ReplaySafeTraceDto {
  dtoVersion: "replay-safe-trace-dto-v1";
  traceId: string;
  cursor: string;
  orderKey: string;
  event: {
    eventId: string;
    eventType: string;
    source?: string;
    payloadHash?: string;
  };
  transition: {
    reducerName: string;
    status: TraceTransitionStatus;
    revisionBefore: number;
    revisionAfter: number;
    changedDomains: string[];
  };
  snapshot: {
    mutated: boolean;
    hashChainLinkId?: string;
  };
  trust: {
    before: KernelTrustState;
    after: KernelTrustState;
    changed: boolean;
    blockingReasonsAdded: string[];
    blockingReasonsRemoved: string[];
  };
  refs: {
    provenanceIds: string[];
    metadataEventIds: string[];
    quarantineRecordId?: string;
    permissionRecordId?: string;
    hashChainLinkId?: string;
  };
  replaySafe: true;
  readOnly: true;
}

export interface ReplayRevisionObservableLayer {
  layerVersion: "replay-revision-observable-layer-v1";
  generatedAt: string;
  ordering: {
    stable: true;
    rule: string;
  };
  revisionTimeline: RevisionTimelineEntry[];
  replaySteps: ObservableReplayStep[];
  snapshotTimeline: SnapshotTimelineEntry[];
  navigation: ReplayNavigationSemantics;
  replaySafeDto: ReplaySafeTraceDto[];
  timeTravel: ObservableTimeTravelSemantics;
}

export interface ObservableTraceMapping {
  mappingVersion: "observable-trace-mapping-v1";
  generatedAt: string;
  ordering: {
    stable: true;
    rule: string;
  };
  revisionCursor: {
    latestRevision: number;
    availableCursors: string[];
    selectedCursor?: string;
  };
  revisionHistory: ObservableRevisionHistoryEntry[];
  replaySteps: ObservableReplayStep[];
  causalityChain: ObservableTraceStep[];
  provenanceLineage: ObservableTraceStep[];
  integrityFailures: ObservableTraceStep[];
  marketInputIntegrity: ObservableTraceStep[];
  snapshotTransitions: ObservableTraceStep[];
  gateReasoning: ObservableTraceStep[];
  quarantineRecoveryVisibility: ObservableTraceStep[];
  timeTravel: ObservableTimeTravelSemantics;
}

function revisionCursor(trace: Pick<CausalityTrace, "revisionBefore" | "revisionAfter">): ObservableRevisionCursor {
  return {
    revisionBefore: trace.revisionBefore,
    revisionAfter: trace.revisionAfter,
    cursor: `rev:${trace.revisionBefore}->${trace.revisionAfter}`,
    isMutation: trace.revisionBefore !== trace.revisionAfter
  };
}

function observableStatusFromTrace(trace: CausalityTrace): ObservableTraceStepStatus {
  if (trace.transitionStatus === "rejected" || trace.transitionStatus === "duplicate_conflict") return "failed";
  if (trace.blockingReasonsAfter.length > 0) return "blocked";
  if (trace.provenanceCompleteness.status === "missing" || trace.marketInputIntegritySummary.issues.includes("provenance_missing")) return "gap";
  if (trace.provenanceCompleteness.status === "partial" || trace.marketInputIntegritySummary.status === "issue") return "warning";
  if (trace.transitionStatus === "unknown") return "unknown";
  return "ok";
}

function observableStatusFromIntegrity(trace: CausalityTrace): ObservableTraceStepStatus {
  if (trace.transitionStatus === "rejected" || trace.validationResult.status === "failed" || trace.checksumStatus === "mismatch") return "failed";
  if (trace.gapStatus === "gap" || trace.provenanceCompleteness.status === "missing") return "gap";
  if (trace.marketInputIntegritySummary.status === "issue") return "warning";
  if (trace.marketInputIntegritySummary.status === "not_applicable") return "not_applicable";
  if (trace.marketInputIntegritySummary.status === "unknown") return "unknown";
  return "ok";
}

function orderedTraces(traces: readonly CausalityTrace[]): CausalityTrace[] {
  return [...traces].sort((a, b) => {
    const byRevisionAfter = a.revisionAfter - b.revisionAfter;
    if (byRevisionAfter !== 0) return byRevisionAfter;
    const byRevisionBefore = a.revisionBefore - b.revisionBefore;
    if (byRevisionBefore !== 0) return byRevisionBefore;
    const byEvent = a.eventId.localeCompare(b.eventId);
    if (byEvent !== 0) return byEvent;
    const byType = a.eventType.localeCompare(b.eventType);
    if (byType !== 0) return byType;
    const byStatus = a.transitionStatus.localeCompare(b.transitionStatus);
    if (byStatus !== 0) return byStatus;
    return a.traceId.localeCompare(b.traceId);
  });
}

function makeObservableId(trace: CausalityTrace, kind: ObservableTraceStepKind, suffix = "main"): string {
  return `observable:${kind}:${trace.revisionBefore}:${trace.revisionAfter}:${trace.eventId}:${suffix}`;
}

function traceRefs(trace: CausalityTrace): ObservableTraceStep["refs"] {
  return {
    provenanceIds: trace.provenanceChain.map((link) => link.provenanceId),
    metadataEventIds: trace.metadataEvents.map((event) => event.eventId),
    quarantineRecordId: trace.quarantineRecordId,
    permissionRecordId: trace.permissionRecordId,
    hashChainLinkId: trace.hashChainLinkId
  };
}

export function mapTraceToObservableSteps(trace: CausalityTrace, baseOrder = 0): ObservableTraceStep[] {
  const revision = revisionCursor(trace);
  const refs = traceRefs(trace);
  const steps: ObservableTraceStep[] = [
    {
      observableId: makeObservableId(trace, "event"),
      order: baseOrder,
      kind: "event",
      status: observableStatusFromTrace(trace),
      label: "Event",
      summary: `${trace.eventType} from ${trace.source ?? "unknown source"}`,
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        source: trace.source,
        transitionStatus: trace.transitionStatus,
        payloadHash: trace.payloadHash
      }
    },
    {
      observableId: makeObservableId(trace, "metadata_provenance"),
      order: baseOrder + 1,
      kind: "metadata_provenance",
      status: trace.provenanceCompleteness.status === "complete" ? "ok" : trace.provenanceCompleteness.status === "missing" ? "gap" : "warning",
      label: "Metadata / Provenance",
      summary: trace.provenanceTraceSummary.summary,
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        originRef: trace.originRef,
        parentProvenanceIds: trace.parentProvenanceIds,
        metadataEvents: trace.metadataEvents,
        provenanceCompleteness: trace.provenanceCompleteness
      }
    },
    {
      observableId: makeObservableId(trace, "transition"),
      order: baseOrder + 2,
      kind: "transition",
      status: trace.transitionStatus === "accepted" || trace.transitionStatus === "duplicate_ignored" ? "ok" : trace.transitionStatus === "unknown" ? "unknown" : "failed",
      label: "Transition",
      summary: `${trace.reducerName} ${trace.transitionStatus}`,
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        reducerName: trace.reducerName,
        transitionStatus: trace.transitionStatus,
        changedDomains: trace.changedDomains
      }
    },
    {
      observableId: makeObservableId(trace, "snapshot"),
      order: baseOrder + 3,
      kind: "snapshot",
      status: revision.isMutation ? "ok" : "not_applicable",
      label: "Snapshot Transition",
      summary: revision.isMutation ? `snapshot ${revision.cursor}` : `snapshot unchanged at ${trace.revisionAfter}`,
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        revisionBefore: trace.revisionBefore,
        revisionAfter: trace.revisionAfter,
        changedDomains: trace.changedDomains
      }
    },
    {
      observableId: makeObservableId(trace, "trust"),
      order: baseOrder + 4,
      kind: "trust",
      status: trace.trustStateDiff.changed ? "warning" : "ok",
      label: "Trust Effect",
      summary: trace.trustStateDiff.changed
        ? `trust ${trace.trustStateBefore} -> ${trace.trustStateAfter}`
        : `trust remained ${trace.trustStateAfter}`,
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        trustStateBefore: trace.trustStateBefore,
        trustStateAfter: trace.trustStateAfter,
        blockingReasonsDiff: trace.blockingReasonsDiff
      }
    },
    {
      observableId: makeObservableId(trace, "gate_verdict"),
      order: baseOrder + 5,
      kind: "gate_verdict",
      status: trace.gateVerdictAfter ? (trace.gateVerdictAfter.allowed ? "ok" : "blocked") : "not_applicable",
      label: "Gate Reasoning",
      summary: trace.gateVerdictAfter
        ? `gate ${trace.gateVerdictAfter.allowed ? "allowed" : "denied"} ${trace.gateVerdictAfter.actionType}`
        : "no gate verdict attached",
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        gateVerdictBefore: trace.gateVerdictBefore,
        gateVerdictAfter: trace.gateVerdictAfter,
        permissionRecordId: trace.permissionRecordId
      }
    }
  ];

  if (trace.marketInputIntegritySummary.applicable) {
    steps.push({
      observableId: makeObservableId(trace, "market_input"),
      order: baseOrder + 6,
      kind: "market_input",
      status: observableStatusFromIntegrity(trace),
      label: "Market Input Integrity",
      summary: trace.marketInputIntegritySummary.summary,
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        marketInputObservation: trace.marketInputObservation,
        validationResult: trace.validationResult,
        sequenceStatus: trace.sequenceStatus,
        gapStatus: trace.gapStatus,
        duplicateStatus: trace.duplicateStatus,
        freshnessStatus: trace.freshnessStatus,
        checksumStatus: trace.checksumStatus,
        provenanceRef: trace.provenanceRef
      }
    });
  }

  if (trace.quarantineRecordId || trace.recoveryPlanBefore || trace.recoveryPlanAfter) {
    steps.push({
      observableId: makeObservableId(trace, "quarantine", trace.quarantineRecordId ?? "recovery"),
      order: baseOrder + 7,
      kind: trace.quarantineRecordId ? "quarantine" : "recovery",
      status: trace.quarantineRecordId ? "failed" : "warning",
      label: trace.quarantineRecordId ? "Quarantine Visibility" : "Recovery Visibility",
      summary: trace.quarantineRecordId
        ? `quarantine record ${trace.quarantineRecordId}`
        : "recovery plan reference attached",
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        quarantineRecordId: trace.quarantineRecordId,
        recoveryPlanBefore: trace.recoveryPlanBefore,
        recoveryPlanAfter: trace.recoveryPlanAfter
      }
    });
  }

  if (trace.transitionStatus === "rejected" || trace.gapStatus === "gap" || trace.checksumStatus === "mismatch" || trace.marketInputIntegritySummary.issues.length > 0) {
    steps.push({
      observableId: makeObservableId(trace, "integrity_failure"),
      order: baseOrder + 8,
      kind: "integrity_failure",
      status: observableStatusFromIntegrity(trace),
      label: "Integrity Failure / Issue",
      summary: trace.marketInputIntegritySummary.applicable
        ? trace.marketInputIntegritySummary.summary
        : `transition=${trace.transitionStatus}; blockers=${trace.blockingReasonsAfter.length}`,
      traceId: trace.traceId,
      eventId: trace.eventId,
      eventType: trace.eventType,
      revision,
      refs,
      payload: {
        transitionStatus: trace.transitionStatus,
        issues: trace.marketInputIntegritySummary.issues,
        blockingReasonsAfter: trace.blockingReasonsAfter,
        provenanceGaps: trace.provenanceCompleteness.gaps
      }
    });
  }

  return steps.sort((a, b) => a.order - b.order || a.observableId.localeCompare(b.observableId));
}

function revisionHistoryEntry(trace: CausalityTrace): ObservableRevisionHistoryEntry {
  return {
    cursor: revisionCursor(trace).cursor,
    revisionBefore: trace.revisionBefore,
    revisionAfter: trace.revisionAfter,
    traceId: trace.traceId,
    eventId: trace.eventId,
    eventType: trace.eventType,
    transitionStatus: trace.transitionStatus,
    changedDomains: trace.changedDomains,
    snapshotMutated: trace.revisionBefore !== trace.revisionAfter || trace.changedDomains.length > 0,
    summary: trace.summary
  };
}

function replayStep(trace: CausalityTrace, order: number): ObservableReplayStep {
  return {
    order,
    cursor: revisionCursor(trace).cursor,
    traceId: trace.traceId,
    eventId: trace.eventId,
    eventType: trace.eventType,
    transitionStatus: trace.transitionStatus,
    replaySafe: true,
    hashChainLinkId: trace.hashChainLinkId,
    summary: `${trace.eventType} ${trace.transitionStatus} at ${revisionCursor(trace).cursor}`
  };
}


function orderKey(trace: CausalityTrace): string {
  return [
    trace.revisionAfter.toString().padStart(12, "0"),
    trace.revisionBefore.toString().padStart(12, "0"),
    trace.eventId,
    trace.eventType,
    trace.transitionStatus,
    trace.traceId
  ].join("|");
}

export function buildRevisionTimeline(traces: readonly CausalityTrace[]): RevisionTimelineEntry[] {
  return orderedTraces(traces).map((trace, order) => ({
    cursor: revisionCursor(trace).cursor,
    order,
    revisionBefore: trace.revisionBefore,
    revisionAfter: trace.revisionAfter,
    traceId: trace.traceId,
    eventId: trace.eventId,
    eventType: trace.eventType,
    transitionStatus: trace.transitionStatus,
    snapshotMutated: trace.revisionBefore !== trace.revisionAfter || trace.changedDomains.length > 0,
    changedDomains: trace.changedDomains,
    hashChainLinkId: trace.hashChainLinkId,
    summary: trace.summary
  }));
}

export function buildSnapshotTimeline(traces: readonly CausalityTrace[]): SnapshotTimelineEntry[] {
  return orderedTraces(traces).map((trace, order) => ({
    cursor: revisionCursor(trace).cursor,
    order,
    revision: trace.revisionAfter,
    revisionBefore: trace.revisionBefore,
    revisionAfter: trace.revisionAfter,
    traceId: trace.traceId,
    eventId: trace.eventId,
    eventType: trace.eventType,
    changedDomains: trace.changedDomains,
    snapshotMutated: trace.revisionBefore !== trace.revisionAfter || trace.changedDomains.length > 0,
    transitionStatus: trace.transitionStatus,
    summary: trace.revisionBefore !== trace.revisionAfter
      ? `snapshot revision ${trace.revisionBefore} -> ${trace.revisionAfter}`
      : `snapshot unchanged at revision ${trace.revisionAfter}`
  }));
}

export function mapTraceToReplaySafeDto(trace: CausalityTrace): ReplaySafeTraceDto {
  return {
    dtoVersion: "replay-safe-trace-dto-v1",
    traceId: trace.traceId,
    cursor: revisionCursor(trace).cursor,
    orderKey: orderKey(trace),
    event: {
      eventId: trace.eventId,
      eventType: trace.eventType,
      source: trace.source,
      payloadHash: trace.payloadHash
    },
    transition: {
      reducerName: trace.reducerName,
      status: trace.transitionStatus,
      revisionBefore: trace.revisionBefore,
      revisionAfter: trace.revisionAfter,
      changedDomains: [...trace.changedDomains]
    },
    snapshot: {
      mutated: trace.revisionBefore !== trace.revisionAfter || trace.changedDomains.length > 0,
      hashChainLinkId: trace.hashChainLinkId
    },
    trust: {
      before: trace.trustStateBefore,
      after: trace.trustStateAfter,
      changed: trace.trustStateDiff.changed,
      blockingReasonsAdded: trace.blockingReasonsDiff.added.map(reasonKey).sort(),
      blockingReasonsRemoved: trace.blockingReasonsDiff.removed.map(reasonKey).sort()
    },
    refs: traceRefs(trace),
    replaySafe: true,
    readOnly: true
  };
}

export function buildReplayNavigationSemantics(timeline: readonly RevisionTimelineEntry[], selectedCursor?: string): ReplayNavigationSemantics {
  const currentIndex = selectedCursor
    ? Math.max(0, timeline.findIndex((entry) => entry.cursor === selectedCursor))
    : Math.max(0, timeline.length - 1);
  const normalizedIndex = timeline.length === 0 ? -1 : currentIndex;
  const current = normalizedIndex >= 0 ? timeline[normalizedIndex] : undefined;
  const previous = normalizedIndex > 0 ? timeline[normalizedIndex - 1] : undefined;
  const next = normalizedIndex >= 0 && normalizedIndex < timeline.length - 1 ? timeline[normalizedIndex + 1] : undefined;
  const latest = timeline.length > 0 ? timeline[timeline.length - 1] : undefined;

  return {
    selectedCursor: selectedCursor ?? current?.cursor,
    currentIndex: normalizedIndex,
    previousCursor: previous?.cursor,
    nextCursor: next?.cursor,
    latestCursor: latest?.cursor,
    canGoPrevious: Boolean(previous),
    canGoNext: Boolean(next),
    readOnly: true,
    noExecutionReplay: true,
    noStateMutation: true,
    noWebsocketAuthority: true,
    cursorRule: "revision cursor is rev:<before>-><after>; duplicate cursors are ordered by stable trace order, not wall-clock time",
    orderingRule: "revisionAfter ASC, revisionBefore ASC, eventId ASC, eventType ASC, transitionStatus ASC, traceId ASC"
  };
}

export function buildReplayRevisionObservableLayer(traces: readonly CausalityTrace[], selectedCursor?: string): ReplayRevisionObservableLayer {
  const ordered = orderedTraces(traces);
  const revisionTimeline = buildRevisionTimeline(ordered);
  const snapshotTimeline = buildSnapshotTimeline(ordered);
  const replaySteps = ordered.map((trace, index) => replayStep(trace, index));
  const replaySafeDto = ordered.map(mapTraceToReplaySafeDto);

  return {
    layerVersion: "replay-revision-observable-layer-v1",
    generatedAt: new Date(0).toISOString(),
    ordering: {
      stable: true,
      rule: "revisionAfter ASC, revisionBefore ASC, eventId ASC, eventType ASC, transitionStatus ASC, traceId ASC; generatedAt and runtime receive time are ignored"
    },
    revisionTimeline,
    replaySteps,
    snapshotTimeline,
    navigation: buildReplayNavigationSemantics(revisionTimeline, selectedCursor),
    replaySafeDto,
    timeTravel: {
      cursorField: "revisionCursor",
      orderingRule: "A UI may navigate only across Core-provided revisionTimeline cursors; it must not sort by wall-clock time.",
      mutationRule: "Replay navigation is a read-only visualization cursor and never replays execution or mutates Core state.",
      readOnlyRule: "UI observes replay-safe DTOs; Core remains the only state and trust authority."
    }
  };
}


export function buildObservableTraceMapping(traces: readonly CausalityTrace[], selectedCursor?: string): ObservableTraceMapping {
  const ordered = orderedTraces(traces);
  const revisionHistory = ordered.map(revisionHistoryEntry);
  const replaySteps = ordered.map((trace, index) => replayStep(trace, index));
  const causalityChain = ordered.flatMap((trace, index) => mapTraceToObservableSteps(trace, index * 100));
  const latestRevision = ordered.reduce((max, trace) => Math.max(max, trace.revisionAfter), 0);
  const availableCursors = [...new Set(revisionHistory.map((entry) => entry.cursor))];

  return {
    mappingVersion: "observable-trace-mapping-v1",
    generatedAt: new Date(0).toISOString(),
    ordering: {
      stable: true,
      rule: "revisionAfter ASC, revisionBefore ASC, eventId ASC, eventType ASC, transitionStatus ASC, traceId ASC; generatedAt is ignored"
    },
    revisionCursor: {
      latestRevision,
      availableCursors,
      selectedCursor
    },
    revisionHistory,
    replaySteps,
    causalityChain,
    provenanceLineage: causalityChain.filter((step) => step.kind === "metadata_provenance"),
    integrityFailures: causalityChain.filter((step) => step.kind === "integrity_failure"),
    marketInputIntegrity: causalityChain.filter((step) => step.kind === "market_input"),
    snapshotTransitions: causalityChain.filter((step) => step.kind === "snapshot"),
    gateReasoning: causalityChain.filter((step) => step.kind === "gate_verdict"),
    quarantineRecoveryVisibility: causalityChain.filter((step) => step.kind === "quarantine" || step.kind === "recovery"),
    timeTravel: {
      cursorField: "revisionCursor",
      orderingRule: "A UI may move across availableCursors only; it must not recompute ordering from wall-clock time.",
      mutationRule: "Selecting a cursor is read-only visualization and never mutates Core state.",
      readOnlyRule: "UI observes mapped Core evidence; Kernel Authority and ActionGate remain the only trust/action authorities."
    }
  };
}
