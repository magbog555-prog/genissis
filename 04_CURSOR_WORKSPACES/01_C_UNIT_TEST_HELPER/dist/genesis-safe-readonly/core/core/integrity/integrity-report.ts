import { createHash } from "node:crypto";
import type { GateDecision, KernelTrustState } from "../contracts/src/actions.js";
import type { DomainEvent } from "../contracts/src/events.js";
import type { RuntimeSnapshot } from "../state/src/types.js";
import type { TransitionTrace } from "../runtime/src/runtime-engine.js";

export type IntegrityStatus = "unknown" | "valid" | "warning" | "broken" | "tampered";
export type IntegritySeverity = "info" | "warning" | "blocking" | "critical" | "panic";

export type ProvenanceStatus = "complete" | "partial" | "missing" | "inconsistent" | "unverifiable";

export type MarketInputStatus =
  | "unknown"
  | "valid"
  | "stale"
  | "duplicate"
  | "gap_detected"
  | "checksum_mismatch"
  | "invalid"
  | "unverifiable";

export const MARKET_INPUT_BLOCKING_REASON = {
  UNKNOWN: "MARKET_INPUT_UNKNOWN",
  MISSING_PROVENANCE: "MARKET_INPUT_MISSING_PROVENANCE",
  STALE: "MARKET_INPUT_STALE",
  GAP: "MARKET_INPUT_GAP",
  DUPLICATE: "MARKET_INPUT_DUPLICATE",
  INVALID: "MARKET_INPUT_INVALID",
  CHECKSUM_MISMATCH: "MARKET_INPUT_CHECKSUM_MISMATCH",
  UNVERIFIABLE: "MARKET_INPUT_UNVERIFIABLE"
} as const;

export type MarketInputBlockingReason = typeof MARKET_INPUT_BLOCKING_REASON[keyof typeof MARKET_INPUT_BLOCKING_REASON];

export const PROVENANCE_BLOCKING_REASON = {
  MISSING: "PROVENANCE_MISSING",
  INCOMPLETE: "PROVENANCE_INCOMPLETE",
  INCONSISTENT: "PROVENANCE_INCONSISTENT",
  UNVERIFIABLE: "PROVENANCE_UNVERIFIABLE",
  PARENT_MISSING: "PROVENANCE_PARENT_MISSING",
  REPLAY_MISMATCH: "PROVENANCE_REPLAY_MISMATCH"
} as const;

export type ProvenanceBlockingReason = typeof PROVENANCE_BLOCKING_REASON[keyof typeof PROVENANCE_BLOCKING_REASON];

export interface ProvenanceHealthReport {
  status: ProvenanceStatus;
  blockingReasons: ProvenanceBlockingReason[];
  traceId?: string;
  parentTraceId?: string;
  sourceEventId?: string;
  checkedAt: string;
  severity: IntegritySeverity;
  evidence?: Record<string, unknown>;
}

export interface ProvenanceHealthInput {
  status?: ProvenanceStatus;
  blockingReasons?: ProvenanceBlockingReason[];
  traceId?: string;
  parentTraceId?: string;
  sourceEventId?: string;
  checkedAt?: string | Date;
  evidence?: Record<string, unknown>;
}

export interface MarketInputIntegrityReport {
  status: MarketInputStatus;
  blockingReasons: MarketInputBlockingReason[];
  source?: string;
  provider?: string;
  eventId?: string;
  sequence?: number | string;
  observedAt?: string;
  provenanceId?: string;
  checksum?: string;
  checkedAt: string;
  severity: IntegritySeverity;
  evidence?: Record<string, unknown>;
}

export interface MarketInputIntegrityInput {
  status?: MarketInputStatus;
  blockingReasons?: MarketInputBlockingReason[];
  source?: string;
  provider?: string;
  eventId?: string;
  sequence?: number | string;
  observedAt?: string | Date;
  provenanceId?: string;
  checksum?: string;
  checkedAt?: string | Date;
  evidence?: Record<string, unknown>;
}

export interface IntegrityReport {
  status: IntegrityStatus;
  revision: number;
  snapshotHash?: string;
  previousSnapshotHash?: string;
  lastEventHash?: string;
  lastTransitionHash?: string;
  chainContinuity: boolean | "unknown";
  mismatchReason?: string;
  checkedAt: string;
  severity: IntegritySeverity;
  provenanceStatus?: ProvenanceStatus;
  provenanceBlockingReasons?: ProvenanceBlockingReason[];
  marketInputStatus?: MarketInputStatus;
  marketInputBlockingReasons?: MarketInputBlockingReason[];
}

export interface CausalityReport {
  lastTraceId?: string;
  lastEventId?: string;
  revisionBefore?: number;
  revisionAfter?: number;
  changedDomains: string[];
  trustStateBefore?: KernelTrustState;
  trustStateAfter?: KernelTrustState;
  gateVerdict?: Pick<GateDecision, "actionType" | "decision" | "reason" | "snapshotRevision" | "gateVersion">;
  traceAvailable: boolean;
}

export interface IntegrityInput {
  snapshot: RuntimeSnapshot;
  lastEvent?: DomainEvent;
  lastTransition?: TransitionTrace;
  previousSnapshotHash?: string;
  expectedSnapshotHash?: string;
  forcedStatus?: IntegrityStatus;
  mismatchReason?: string;
  checkedAt?: string | Date;
  provenance?: ProvenanceHealthInput | ProvenanceHealthReport;
  marketInput?: MarketInputIntegrityInput | MarketInputIntegrityReport;
}

export interface CausalityInput {
  lastEvent?: DomainEvent;
  lastTransition?: TransitionTrace;
  trustStateBefore?: KernelTrustState;
  trustStateAfter?: KernelTrustState;
  gateVerdict?: GateDecision;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export function hashEvidence(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}


function provenanceSeverityFor(status: ProvenanceStatus): IntegritySeverity {
  switch (status) {
    case "inconsistent":
      return "critical";
    case "unverifiable":
      return "blocking";
    case "partial":
      return "warning";
    case "missing":
      return "blocking";
    case "complete":
    default:
      return "info";
  }
}

export function provenanceBlockingReasonsFor(status: ProvenanceStatus, explicit: ProvenanceBlockingReason[] = []): ProvenanceBlockingReason[] {
  const reasons = new Set<ProvenanceBlockingReason>(explicit);
  if (status === "missing") reasons.add(PROVENANCE_BLOCKING_REASON.MISSING);
  if (status === "partial") reasons.add(PROVENANCE_BLOCKING_REASON.INCOMPLETE);
  if (status === "inconsistent") reasons.add(PROVENANCE_BLOCKING_REASON.INCONSISTENT);
  if (status === "unverifiable") reasons.add(PROVENANCE_BLOCKING_REASON.UNVERIFIABLE);
  return Array.from(reasons);
}

export function buildProvenanceHealthReport(input: ProvenanceHealthInput = {}): ProvenanceHealthReport {
  const checkedAt = typeof input.checkedAt === "string"
    ? input.checkedAt
    : (input.checkedAt ?? new Date()).toISOString();
  const status = input.status ?? "missing";
  const blockingReasons = provenanceBlockingReasonsFor(status, input.blockingReasons ?? []);
  return {
    status,
    blockingReasons,
    traceId: input.traceId,
    parentTraceId: input.parentTraceId,
    sourceEventId: input.sourceEventId,
    checkedAt,
    severity: provenanceSeverityFor(status),
    evidence: input.evidence
  };
}

export function provenanceReasonToGateReason(reason: ProvenanceBlockingReason): string {
  switch (reason) {
    case PROVENANCE_BLOCKING_REASON.MISSING:
      return "provenance_missing";
    case PROVENANCE_BLOCKING_REASON.INCOMPLETE:
      return "provenance_incomplete";
    case PROVENANCE_BLOCKING_REASON.INCONSISTENT:
      return "provenance_inconsistent";
    case PROVENANCE_BLOCKING_REASON.UNVERIFIABLE:
      return "provenance_unverifiable";
    case PROVENANCE_BLOCKING_REASON.PARENT_MISSING:
      return "provenance_parent_missing";
    case PROVENANCE_BLOCKING_REASON.REPLAY_MISMATCH:
      return "provenance_replay_mismatch";
  }
}

export function provenanceIsValidForRiskIncrease(report?: ProvenanceHealthReport): boolean {
  return report?.status === "complete" && report.blockingReasons.length === 0;
}

export function marketInputBlockingReasonsFor(status: MarketInputStatus, explicit: MarketInputBlockingReason[] = []): MarketInputBlockingReason[] {
  const reasons = new Set<MarketInputBlockingReason>(explicit);
  if (status === "unknown") reasons.add(MARKET_INPUT_BLOCKING_REASON.UNKNOWN);
  if (status === "stale") reasons.add(MARKET_INPUT_BLOCKING_REASON.STALE);
  if (status === "duplicate") reasons.add(MARKET_INPUT_BLOCKING_REASON.DUPLICATE);
  if (status === "gap_detected") reasons.add(MARKET_INPUT_BLOCKING_REASON.GAP);
  if (status === "checksum_mismatch") reasons.add(MARKET_INPUT_BLOCKING_REASON.CHECKSUM_MISMATCH);
  if (status === "invalid") reasons.add(MARKET_INPUT_BLOCKING_REASON.INVALID);
  if (status === "unverifiable") reasons.add(MARKET_INPUT_BLOCKING_REASON.UNVERIFIABLE);
  return Array.from(reasons);
}

function marketInputSeverityFor(status: MarketInputStatus): IntegritySeverity {
  switch (status) {
    case "checksum_mismatch":
      return "critical";
    case "invalid":
    case "gap_detected":
    case "unverifiable":
      return "blocking";
    case "stale":
    case "duplicate":
      return "warning";
    case "unknown":
      return "info";
    case "valid":
    default:
      return "info";
  }
}

export function buildMarketInputIntegrityReport(input: MarketInputIntegrityInput = {}): MarketInputIntegrityReport {
  const checkedAt = typeof input.checkedAt === "string"
    ? input.checkedAt
    : (input.checkedAt ?? new Date()).toISOString();
  const observedAt = typeof input.observedAt === "string"
    ? input.observedAt
    : input.observedAt?.toISOString();
  const status = input.status ?? "unknown";
  const blockingReasons = marketInputBlockingReasonsFor(status, input.blockingReasons ?? []);
  return {
    status,
    blockingReasons,
    source: input.source,
    provider: input.provider,
    eventId: input.eventId,
    sequence: input.sequence,
    observedAt,
    provenanceId: input.provenanceId,
    checksum: input.checksum,
    checkedAt,
    severity: marketInputSeverityFor(status),
    evidence: input.evidence
  };
}

export function marketInputIsValidForRiskIncrease(report?: MarketInputIntegrityReport): boolean {
  return report?.status === "valid" && report.blockingReasons.length === 0;
}


function severityFor(status: IntegrityStatus): IntegritySeverity {
  switch (status) {
    case "tampered":
      return "panic";
    case "broken":
      return "critical";
    case "warning":
      return "warning";
    case "valid":
      return "info";
    case "unknown":
    default:
      return "info";
  }
}

export function buildIntegrityReport(input: IntegrityInput): IntegrityReport {
  const checkedAt = typeof input.checkedAt === "string"
    ? input.checkedAt
    : (input.checkedAt ?? new Date()).toISOString();

  const provenance = input.provenance
    ? ("blockingReasons" in input.provenance && "checkedAt" in input.provenance
      ? input.provenance as ProvenanceHealthReport
      : buildProvenanceHealthReport(input.provenance as ProvenanceHealthInput))
    : undefined;

  const marketInput = input.marketInput
    ? ("blockingReasons" in input.marketInput && "checkedAt" in input.marketInput
      ? input.marketInput as MarketInputIntegrityReport
      : buildMarketInputIntegrityReport(input.marketInput as MarketInputIntegrityInput))
    : undefined;

  const snapshotHash = hashEvidence({
    revision: input.snapshot.revision,
    committedAt: input.snapshot.committedAt,
    bootstrap: input.snapshot.bootstrap,
    exchangeTruth: input.snapshot.exchangeTruth,
    market: input.snapshot.market,
    trade: input.snapshot.trade,
    order: input.snapshot.order,
    position: input.snapshot.position,
    risk: input.snapshot.risk,
    system: input.snapshot.system
  });

  const lastEventHash = input.lastEvent ? hashEvidence(input.lastEvent) : undefined;
  const lastTransitionHash = input.lastTransition ? hashEvidence(input.lastTransition) : undefined;

  const hasLegacyNoTrace = input.snapshot.revision === 0 && !input.lastEvent && !input.lastTransition;
  const continuityOk =
    hasLegacyNoTrace
      ? "unknown"
      : Boolean(
          input.lastTransition &&
          input.lastTransition.snapshotRevisionAfter === input.snapshot.revision &&
          (!input.lastEvent || input.lastTransition.eventId === input.lastEvent.eventId)
        );

  let status: IntegrityStatus =
    input.forcedStatus ??
    (hasLegacyNoTrace
      ? "unknown"
      : continuityOk === true
        ? "valid"
        : "broken");

  let mismatchReason = input.mismatchReason;

  if (input.expectedSnapshotHash && input.expectedSnapshotHash !== snapshotHash) {
    status = "tampered";
    mismatchReason = mismatchReason ?? "snapshot_hash_mismatch";
  }

  if (status === "broken" && !mismatchReason) {
    mismatchReason = "hash_chain_continuity_broken";
  }

  if (status === "unknown" && !mismatchReason) {
    mismatchReason = "legacy_integrity_not_available";
  }

  return {
    status,
    revision: input.snapshot.revision,
    snapshotHash,
    previousSnapshotHash: input.previousSnapshotHash,
    lastEventHash,
    lastTransitionHash,
    chainContinuity: continuityOk,
    mismatchReason,
    checkedAt,
    severity: severityFor(status),
    provenanceStatus: provenance?.status,
    provenanceBlockingReasons: provenance?.blockingReasons,
    marketInputStatus: marketInput?.status,
    marketInputBlockingReasons: marketInput?.blockingReasons
  };
}

export function buildCausalityReport(input: CausalityInput): CausalityReport {
  const trace = input.lastTransition;
  return {
    lastTraceId: trace?.transitionId,
    lastEventId: trace?.eventId ?? input.lastEvent?.eventId,
    revisionBefore: trace?.snapshotRevisionBefore,
    revisionAfter: trace?.snapshotRevisionAfter,
    changedDomains: trace?.changedDomains ?? [],
    trustStateBefore: input.trustStateBefore,
    trustStateAfter: input.trustStateAfter,
    gateVerdict: input.gateVerdict
      ? {
          actionType: input.gateVerdict.actionType,
          decision: input.gateVerdict.decision,
          reason: input.gateVerdict.reason,
          snapshotRevision: input.gateVerdict.snapshotRevision,
          gateVersion: input.gateVerdict.gateVersion
        }
      : undefined,
    traceAvailable: Boolean(trace)
  };
}

export function integrityBlockingReason(report?: IntegrityReport): string | undefined {
  if (!report) return undefined;
  if (report.status === "tampered") return "integrity_tampered";
  if (report.status === "broken") return "integrity_broken";
  return undefined;
}

export function causalityBlockingReason(report?: CausalityReport): string | undefined {
  if (!report) return undefined;
  if (!report.traceAvailable && report.revisionAfter && report.revisionAfter > 0) return "causality_missing";
  if (
    report.traceAvailable &&
    typeof report.revisionAfter === "number" &&
    typeof report.revisionBefore === "number" &&
    report.revisionAfter !== report.revisionBefore + 1
  ) {
    return "causality_contradiction";
  }
  return undefined;
}
