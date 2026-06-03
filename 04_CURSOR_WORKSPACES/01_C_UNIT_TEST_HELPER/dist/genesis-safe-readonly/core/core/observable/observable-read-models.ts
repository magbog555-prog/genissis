import type { GateDecision } from "../contracts/src/actions.js";
import type { IntegrityReport, MarketInputIntegrityReport, ProvenanceHealthReport } from "../integrity/integrity-report.js";
import type { CoreTrustReport, BlockingReason } from "../kernel/core-trust-report.js";
import type { RecoveryPlan, QuarantineSummary } from "../recovery/recovery-planner.js";

export const OBSERVABLE_READ_MODEL_VERSION = "observable-read-models-v0.1" as const;

export type ObservableStatus = "ok" | "warning" | "blocked" | "critical" | "unknown";
export type ObservableSeverity = "info" | "warning" | "blocking" | "critical" | "panic";

export interface ObservableExplanation {
  code: string;
  title: string;
  detail: string;
  severity: ObservableSeverity;
  domain?: string;
  evidence?: Record<string, unknown>;
}

export interface ObservableMachineSummary {
  trustState: string;
  runtimeMode: string;
  tradingAllowed: boolean;
  revision: number;
  mainReason?: string;
  mainExplanation?: string;
}

export interface ObservableTrustReportModel {
  modelVersion: typeof OBSERVABLE_READ_MODEL_VERSION;
  revision: number;
  trustState: string;
  runtimeMode: string;
  tradingAllowed: boolean;
  allowedActionClasses: string[];
  blockingReasons: ObservableExplanation[];
  health: {
    healthTruthComplete?: boolean;
    diagnostics: string[];
  };
  integrity?: ObservableIntegrityReportModel;
  provenance?: ObservableProvenanceIntegrityModel;
  marketInput?: ObservableMarketInputStatusModel;
}

export interface ObservableIntegrityReportModel {
  modelVersion: typeof OBSERVABLE_READ_MODEL_VERSION;
  status: string;
  severity: ObservableSeverity;
  revision?: number;
  chainContinuity?: boolean | "unknown";
  snapshotHash?: string;
  previousSnapshotHash?: string;
  lastEventHash?: string;
  lastTransitionHash?: string;
  mismatchReason?: string;
  explanation: ObservableExplanation;
}

export interface ObservableActionGateVerdictModel {
  modelVersion: typeof OBSERVABLE_READ_MODEL_VERSION;
  action: string;
  allowed: boolean;
  decision: "allow" | "deny";
  actionClass: string;
  severity: string;
  snapshotRevision: number;
  kernelTrustState: string;
  blockingReasons: ObservableExplanation[];
  allowedAlternatives: string[];
  relatedInvariants: string[];
  gateVersion: string;
  deterministicExplanation: string;
  traceId?: string;
  integrityStatus?: string;
  provenanceStatus?: string;
  marketInputStatus?: string;
}

export interface ObservableRecoveryPlanModel {
  modelVersion: typeof OBSERVABLE_READ_MODEL_VERSION;
  required: boolean;
  mode: string;
  priority: string;
  reasons: ObservableExplanation[];
  nextActions: ObservableRecoveryHint[];
  forbiddenActions: string[];
  manualReviewRequired: boolean;
  plannerVersion: string;
}

export interface ObservableRecoveryHint {
  action: string;
  title: string;
  detail: string;
  safeToDisplay: true;
}

export interface ObservableQuarantineSummaryModel {
  modelVersion: typeof OBSERVABLE_READ_MODEL_VERSION;
  count: number;
  hasItems: boolean;
  reasons: string[];
  explanation: string;
}

export interface ObservableMarketInputStatusModel {
  modelVersion: typeof OBSERVABLE_READ_MODEL_VERSION;
  status: string;
  blockingReasons: ObservableExplanation[];
  source?: string;
  provider?: string;
  eventId?: string;
  sequence?: number | string;
  provenanceId?: string;
  checksum?: string;
  checkedAt?: string;
}

export interface ObservableProvenanceIntegrityModel {
  modelVersion: typeof OBSERVABLE_READ_MODEL_VERSION;
  status: string;
  blockingReasons: ObservableExplanation[];
  traceId?: string;
  parentTraceId?: string;
  sourceEventId?: string;
  checkedAt?: string;
  severity?: string;
}

export interface ObservableCoreReadModel {
  modelVersion: typeof OBSERVABLE_READ_MODEL_VERSION;
  machine: ObservableMachineSummary;
  trustReport: ObservableTrustReportModel;
  integrity?: ObservableIntegrityReportModel;
  gateVerdict?: ObservableActionGateVerdictModel;
  blockingReasons: ObservableExplanation[];
  recoveryPlan?: ObservableRecoveryPlanModel;
  quarantine?: ObservableQuarantineSummaryModel;
  marketInput?: ObservableMarketInputStatusModel;
  provenance?: ObservableProvenanceIntegrityModel;
}

export interface ObservableCoreReadModelInput {
  coreTrustReport: CoreTrustReport;
  gateVerdict?: GateDecision;
  recoveryPlan?: RecoveryPlan;
  quarantineSummary?: QuarantineSummary;
}

const REASON_TITLES: Record<string, string> = {
  bootstrap_not_reconciled: "Bootstrap is not reconciled",
  bootstrap_awaiting_exchange_truth: "Bootstrap is waiting for exchange truth",
  exchange_truth_unknown: "Exchange truth is unknown",
  exchange_truth_stale: "Exchange truth is stale",
  exchange_truth_conflicted: "Exchange truth is conflicted",
  market_data_stale: "Market data is stale",
  freshness_unknown: "Freshness is unknown",
  connection_state_unknown: "Connection state is unknown",
  health_truth_partial: "Health truth is partial",
  ws_status_unknown: "WebSocket status is unknown",
  position_unknown: "Position is unknown",
  risk_blocked: "Risk is blocked",
  order_uncertain_requires_reconcile: "Order state is uncertain",
  integrity_broken: "Integrity chain is broken",
  integrity_tampered: "Integrity chain is tampered",
  causality_contradiction: "Causality contradiction detected",
  provenance_missing: "Provenance is missing",
  provenance_incomplete: "Provenance is incomplete",
  provenance_inconsistent: "Provenance is inconsistent",
  provenance_unverifiable: "Provenance is unverifiable",
  provenance_parent_missing: "Provenance parent is missing",
  provenance_replay_mismatch: "Provenance replay mismatch",
  PROVENANCE_MISSING: "Provenance is missing",
  PROVENANCE_INCOMPLETE: "Provenance is incomplete",
  PROVENANCE_INCONSISTENT: "Provenance is inconsistent",
  PROVENANCE_UNVERIFIABLE: "Provenance is unverifiable",
  PROVENANCE_PARENT_MISSING: "Provenance parent is missing",
  PROVENANCE_REPLAY_MISMATCH: "Provenance replay mismatch",
  MARKET_INPUT_UNKNOWN: "Market input is unknown",
  MARKET_INPUT_MISSING_PROVENANCE: "Market input provenance is missing",
  MARKET_INPUT_STALE: "Market input is stale",
  MARKET_INPUT_GAP: "Market input gap detected",
  MARKET_INPUT_DUPLICATE: "Duplicate market input",
  MARKET_INPUT_INVALID: "Market input is invalid",
  MARKET_INPUT_CHECKSUM_MISMATCH: "Market input checksum mismatch",
  MARKET_INPUT_UNVERIFIABLE: "Market input is unverifiable"
};

function titleFor(code: string): string {
  return REASON_TITLES[code] ?? code.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function detailFor(code: string): string {
  if (code.startsWith("MARKET_INPUT_")) return "Risk-increasing actions require valid, fresh, replay-safe market input with provenance.";
  if (code.startsWith("PROVENANCE_") || code.startsWith("provenance_")) return "Risk-increasing actions require valid provenance; recovery and risk-reducing actions remain observable.";
  if (code.startsWith("exchange_truth_")) return "Core cannot treat exchange truth as safe for normal trading until this condition is resolved.";
  if (code.includes("fresh") || code.includes("stale")) return "Freshness must be proven before ordinary risk-increasing action.";
  if (code.includes("integrity") || code.includes("tampered")) return "Integrity evidence blocks unsafe actions until replay/manual review resolves it.";
  if (code.includes("connection") || code.includes("health") || code.includes("ws_")) return "Health truth is not complete enough for normal action.";
  return "Core reported this reason as part of the deterministic action/trust evaluation.";
}

function severityFor(code: string, fallback: ObservableSeverity = "blocking"): ObservableSeverity {
  if (code.includes("PANIC") || code.includes("tampered") || code.includes("TAMPERED")) return "panic";
  if (code.includes("conflicted") || code.includes("mismatch") || code.includes("MISMATCH") || code.includes("INCONSISTENT") || code.includes("CHECKSUM")) return "critical";
  if (code.includes("unknown") || code.includes("UNKNOWN") || code.includes("missing") || code.includes("MISSING")) return "warning";
  return fallback;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort();
}

function explanationFromCode(code: string, domain?: string, severity?: ObservableSeverity, evidence?: Record<string, unknown>): ObservableExplanation {
  return {
    code,
    title: titleFor(code),
    detail: detailFor(code),
    severity: severity ?? severityFor(code),
    domain,
    evidence
  };
}

function explanationFromBlockingReason(reason: BlockingReason): ObservableExplanation {
  return {
    code: reason.code,
    title: titleFor(reason.code),
    detail: reason.message || detailFor(reason.code),
    severity: reason.severity,
    domain: reason.domain,
    evidence: reason.evidence
  };
}

export function buildObservableBlockingReasons(reasons: Array<string | BlockingReason>): ObservableExplanation[] {
  return reasons.map((reason) => {
    if (typeof reason === "string") return explanationFromCode(reason);
    return explanationFromBlockingReason(reason);
  }).sort((a, b) => a.code.localeCompare(b.code));
}

export function buildObservableIntegrityReport(integrity?: IntegrityReport): ObservableIntegrityReportModel | undefined {
  if (!integrity) return undefined;
  const code = integrity.mismatchReason || `integrity_${integrity.status}`;
  return {
    modelVersion: OBSERVABLE_READ_MODEL_VERSION,
    status: integrity.status,
    severity: integrity.severity,
    revision: integrity.revision,
    chainContinuity: integrity.chainContinuity,
    snapshotHash: integrity.snapshotHash,
    previousSnapshotHash: integrity.previousSnapshotHash,
    lastEventHash: integrity.lastEventHash,
    lastTransitionHash: integrity.lastTransitionHash,
    mismatchReason: integrity.mismatchReason,
    explanation: explanationFromCode(code, "integrity", integrity.severity, {
      chainContinuity: integrity.chainContinuity
    })
  };
}

export function buildObservableProvenanceIntegrity(provenance?: ProvenanceHealthReport): ObservableProvenanceIntegrityModel | undefined {
  if (!provenance) return undefined;
  return {
    modelVersion: OBSERVABLE_READ_MODEL_VERSION,
    status: provenance.status,
    blockingReasons: buildObservableBlockingReasons(provenance.blockingReasons),
    traceId: provenance.traceId,
    parentTraceId: provenance.parentTraceId,
    sourceEventId: provenance.sourceEventId,
    checkedAt: provenance.checkedAt,
    severity: provenance.severity
  };
}

export function buildObservableMarketInputStatus(marketInput?: MarketInputIntegrityReport): ObservableMarketInputStatusModel | undefined {
  if (!marketInput) return undefined;
  return {
    modelVersion: OBSERVABLE_READ_MODEL_VERSION,
    status: marketInput.status,
    blockingReasons: buildObservableBlockingReasons(marketInput.blockingReasons),
    source: marketInput.source,
    provider: marketInput.provider,
    eventId: marketInput.eventId,
    sequence: marketInput.sequence,
    provenanceId: marketInput.provenanceId,
    checksum: marketInput.checksum,
    checkedAt: marketInput.checkedAt
  };
}

export function deterministicVerdictExplanation(verdict: GateDecision): string {
  if (verdict.allowed) {
    return `${verdict.actionType}: allow at revision ${verdict.snapshotRevision} by ${verdict.gateVersion}`;
  }
  const reasons = unique(verdict.blockingReasons ?? []);
  const reasonText = reasons.length ? reasons.join(",") : "action_gate_denied";
  return `${verdict.actionType}: deny at revision ${verdict.snapshotRevision} by ${verdict.gateVersion}; reasons=${reasonText}`;
}

export function buildObservableActionGateVerdict(verdict?: GateDecision): ObservableActionGateVerdictModel | undefined {
  if (!verdict) return undefined;
  return {
    modelVersion: OBSERVABLE_READ_MODEL_VERSION,
    action: verdict.actionType,
    allowed: verdict.allowed,
    decision: verdict.decision,
    actionClass: verdict.actionClass,
    severity: verdict.severity,
    snapshotRevision: verdict.snapshotRevision,
    kernelTrustState: verdict.kernelTrustState,
    blockingReasons: buildObservableBlockingReasons(verdict.blockingReasons ?? []),
    allowedAlternatives: unique((verdict.allowedAlternatives ?? []).map(String)),
    relatedInvariants: unique(verdict.relatedInvariants ?? []),
    gateVersion: verdict.gateVersion,
    deterministicExplanation: deterministicVerdictExplanation(verdict),
    traceId: verdict.traceId,
    integrityStatus: verdict.integrityStatus,
    provenanceStatus: verdict.provenanceStatus,
    marketInputStatus: verdict.marketInputStatus
  };
}

export function buildObservableRecoveryPlan(plan?: RecoveryPlan): ObservableRecoveryPlanModel | undefined {
  if (!plan) return undefined;
  return {
    modelVersion: OBSERVABLE_READ_MODEL_VERSION,
    required: plan.required,
    mode: plan.mode,
    priority: plan.priority,
    reasons: buildObservableBlockingReasons(plan.reasons),
    nextActions: unique(plan.nextActions).map((action) => ({
      action,
      title: titleFor(action),
      detail: "Recovery hint is observable only; execution must still go through approved Core APIs and ActionGate.",
      safeToDisplay: true
    })),
    forbiddenActions: unique(plan.forbiddenActions),
    manualReviewRequired: plan.manualReviewRequired,
    plannerVersion: plan.plannerVersion
  };
}

export function buildObservableQuarantineSummary(summary?: QuarantineSummary): ObservableQuarantineSummaryModel | undefined {
  if (!summary) return undefined;
  const count = [summary.count, summary.itemCount, summary.quarantinedCount, summary.badDataCount, summary.rejectedEventCount]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .reduce((total, value) => total + Math.max(0, value), 0);
  const hasItems = Boolean(summary.hasItems || count > 0);
  const reasons = unique((summary.reasons ?? []).map(String));
  return {
    modelVersion: OBSERVABLE_READ_MODEL_VERSION,
    count,
    hasItems,
    reasons,
    explanation: hasItems
      ? "Quarantine has records. UI may display them as evidence but must not replay or apply them."
      : "Quarantine has no reported records."
  };
}

export function buildObservableTrustReport(report: CoreTrustReport): ObservableTrustReportModel {
  return {
    modelVersion: OBSERVABLE_READ_MODEL_VERSION,
    revision: report.revision,
    trustState: report.trustState,
    runtimeMode: report.runtimeMode,
    tradingAllowed: report.tradingAllowed,
    allowedActionClasses: unique(report.allowedActionClasses.map(String)),
    blockingReasons: buildObservableBlockingReasons(report.blockingReasons),
    health: {
      healthTruthComplete: report.healthTruth?.healthTruthComplete,
      diagnostics: unique(Array.isArray(report.healthTruth?.diagnostics) ? report.healthTruth.diagnostics.map(String) : [])
    },
    integrity: buildObservableIntegrityReport(report.integrity),
    provenance: buildObservableProvenanceIntegrity(report.provenance),
    marketInput: buildObservableMarketInputStatus(report.marketInput)
  };
}

export function buildObservableCoreReadModel(input: ObservableCoreReadModelInput): ObservableCoreReadModel {
  const trustReport = buildObservableTrustReport(input.coreTrustReport);
  const gateVerdict = buildObservableActionGateVerdict(input.gateVerdict ?? input.coreTrustReport.actionVerdicts?.place_order ?? input.coreTrustReport.actions?.place_order);
  const recoveryPlan = buildObservableRecoveryPlan(input.recoveryPlan);
  const quarantine = buildObservableQuarantineSummary(input.quarantineSummary);
  const blockingReasons = gateVerdict?.blockingReasons?.length ? gateVerdict.blockingReasons : trustReport.blockingReasons;
  const mainReason = blockingReasons[0];

  return {
    modelVersion: OBSERVABLE_READ_MODEL_VERSION,
    machine: {
      trustState: trustReport.trustState,
      runtimeMode: trustReport.runtimeMode,
      tradingAllowed: trustReport.tradingAllowed,
      revision: trustReport.revision,
      mainReason: mainReason?.code,
      mainExplanation: mainReason?.detail
    },
    trustReport,
    integrity: trustReport.integrity,
    gateVerdict,
    blockingReasons,
    recoveryPlan,
    quarantine,
    marketInput: trustReport.marketInput,
    provenance: trustReport.provenance
  };
}


export const OBSERVABLE_DTO_SUMMARY_VERSION = "observable-dto-summaries-v0.1" as const;

export interface UiSafeExplanation {
  code: string;
  title: string;
  detail: string;
  severity: ObservableSeverity;
  domain?: string;
  evidenceKeys: string[];
  uiSafe: true;
}

export interface TrustSummaryDto {
  dtoVersion: typeof OBSERVABLE_DTO_SUMMARY_VERSION;
  trustState: string;
  runtimeMode: string;
  tradingAllowed: boolean;
  revision: number;
  allowedActionClasses: string[];
  blockingReasonCodes: string[];
  explanations: UiSafeExplanation[];
  healthTruthComplete?: boolean;
}

export interface IntegritySummaryDto {
  dtoVersion: typeof OBSERVABLE_DTO_SUMMARY_VERSION;
  status: string;
  severity: ObservableSeverity;
  chainContinuity?: boolean | "unknown";
  revision?: number;
  mismatchReason?: string;
  snapshotHash?: string;
  previousSnapshotHash?: string;
  lastEventHash?: string;
  lastTransitionHash?: string;
  explanation: UiSafeExplanation;
}

export interface RecoverySummaryDto {
  dtoVersion: typeof OBSERVABLE_DTO_SUMMARY_VERSION;
  required: boolean;
  mode: string;
  priority: string;
  nextActions: string[];
  forbiddenActions: string[];
  manualReviewRequired: boolean;
  explanations: UiSafeExplanation[];
  plannerVersion: string;
}

export interface QuarantineSummaryDto {
  dtoVersion: typeof OBSERVABLE_DTO_SUMMARY_VERSION;
  count: number;
  hasItems: boolean;
  reasons: string[];
  explanation: string;
  uiSafe: true;
}

export interface MarketIntegritySummaryDto {
  dtoVersion: typeof OBSERVABLE_DTO_SUMMARY_VERSION;
  status: string;
  blockingReasonCodes: string[];
  explanations: UiSafeExplanation[];
  source?: string;
  provider?: string;
  eventId?: string;
  sequence?: number | string;
  provenanceId?: string;
  checksum?: string;
  checkedAt?: string;
}

export interface ProvenanceIntegritySummaryDto {
  dtoVersion: typeof OBSERVABLE_DTO_SUMMARY_VERSION;
  status: string;
  blockingReasonCodes: string[];
  explanations: UiSafeExplanation[];
  traceId?: string;
  parentTraceId?: string;
  sourceEventId?: string;
  checkedAt?: string;
  severity?: string;
}

export interface ActionGateVerdictSummaryDto {
  dtoVersion: typeof OBSERVABLE_DTO_SUMMARY_VERSION;
  action: string;
  allowed: boolean;
  decision: "allow" | "deny";
  actionClass: string;
  severity: string;
  snapshotRevision: number;
  kernelTrustState: string;
  blockingReasonCodes: string[];
  explanations: UiSafeExplanation[];
  allowedAlternatives: string[];
  relatedInvariants: string[];
  gateVersion: string;
  deterministicExplanation: string;
  traceId?: string;
  integrityStatus?: string;
  provenanceStatus?: string;
  marketInputStatus?: string;
}

export interface ObservableSummariesDto {
  dtoVersion: typeof OBSERVABLE_DTO_SUMMARY_VERSION;
  trust: TrustSummaryDto;
  integrity?: IntegritySummaryDto;
  recovery?: RecoverySummaryDto;
  quarantine?: QuarantineSummaryDto;
  marketIntegrity?: MarketIntegritySummaryDto;
  provenanceIntegrity?: ProvenanceIntegritySummaryDto;
  actionGateVerdict?: ActionGateVerdictSummaryDto;
}

function evidenceKeys(evidence?: Record<string, unknown>): string[] {
  if (!evidence) return [];
  return Object.keys(evidence).sort();
}

function toUiSafeExplanation(explanation: ObservableExplanation): UiSafeExplanation {
  return {
    code: explanation.code,
    title: explanation.title,
    detail: explanation.detail,
    severity: explanation.severity,
    domain: explanation.domain,
    evidenceKeys: evidenceKeys(explanation.evidence),
    uiSafe: true
  };
}

function toUiSafeExplanations(explanations: ObservableExplanation[]): UiSafeExplanation[] {
  return explanations.map(toUiSafeExplanation).sort((a, b) => a.code.localeCompare(b.code));
}

export function buildTrustSummaryDto(report: CoreTrustReport): TrustSummaryDto {
  const explanations = buildObservableBlockingReasons(report.blockingReasons);
  return {
    dtoVersion: OBSERVABLE_DTO_SUMMARY_VERSION,
    trustState: report.trustState,
    runtimeMode: report.runtimeMode,
    tradingAllowed: report.tradingAllowed,
    revision: report.revision,
    allowedActionClasses: unique(report.allowedActionClasses.map(String)),
    blockingReasonCodes: unique(explanations.map((reason) => reason.code)),
    explanations: toUiSafeExplanations(explanations),
    healthTruthComplete: report.healthTruth?.healthTruthComplete
  };
}

export function buildIntegritySummaryDto(integrity?: IntegrityReport): IntegritySummaryDto | undefined {
  const observable = buildObservableIntegrityReport(integrity);
  if (!observable) return undefined;
  return {
    dtoVersion: OBSERVABLE_DTO_SUMMARY_VERSION,
    status: observable.status,
    severity: observable.severity,
    chainContinuity: observable.chainContinuity,
    revision: observable.revision,
    mismatchReason: observable.mismatchReason,
    snapshotHash: observable.snapshotHash,
    previousSnapshotHash: observable.previousSnapshotHash,
    lastEventHash: observable.lastEventHash,
    lastTransitionHash: observable.lastTransitionHash,
    explanation: toUiSafeExplanation(observable.explanation)
  };
}

export function buildRecoverySummaryDto(plan?: RecoveryPlan): RecoverySummaryDto | undefined {
  const observable = buildObservableRecoveryPlan(plan);
  if (!observable) return undefined;
  return {
    dtoVersion: OBSERVABLE_DTO_SUMMARY_VERSION,
    required: observable.required,
    mode: observable.mode,
    priority: observable.priority,
    nextActions: unique(observable.nextActions.map((hint) => hint.action)),
    forbiddenActions: unique(observable.forbiddenActions),
    manualReviewRequired: observable.manualReviewRequired,
    explanations: toUiSafeExplanations(observable.reasons),
    plannerVersion: observable.plannerVersion
  };
}

export function buildQuarantineSummaryDto(summary?: QuarantineSummary): QuarantineSummaryDto | undefined {
  const observable = buildObservableQuarantineSummary(summary);
  if (!observable) return undefined;
  return {
    dtoVersion: OBSERVABLE_DTO_SUMMARY_VERSION,
    count: observable.count,
    hasItems: observable.hasItems,
    reasons: unique(observable.reasons),
    explanation: observable.explanation,
    uiSafe: true
  };
}

export function buildMarketIntegritySummaryDto(marketInput?: MarketInputIntegrityReport): MarketIntegritySummaryDto | undefined {
  const observable = buildObservableMarketInputStatus(marketInput);
  if (!observable) return undefined;
  return {
    dtoVersion: OBSERVABLE_DTO_SUMMARY_VERSION,
    status: observable.status,
    blockingReasonCodes: unique(observable.blockingReasons.map((reason) => reason.code)),
    explanations: toUiSafeExplanations(observable.blockingReasons),
    source: observable.source,
    provider: observable.provider,
    eventId: observable.eventId,
    sequence: observable.sequence,
    provenanceId: observable.provenanceId,
    checksum: observable.checksum,
    checkedAt: observable.checkedAt
  };
}

export function buildProvenanceIntegritySummaryDto(provenance?: ProvenanceHealthReport): ProvenanceIntegritySummaryDto | undefined {
  const observable = buildObservableProvenanceIntegrity(provenance);
  if (!observable) return undefined;
  return {
    dtoVersion: OBSERVABLE_DTO_SUMMARY_VERSION,
    status: observable.status,
    blockingReasonCodes: unique(observable.blockingReasons.map((reason) => reason.code)),
    explanations: toUiSafeExplanations(observable.blockingReasons),
    traceId: observable.traceId,
    parentTraceId: observable.parentTraceId,
    sourceEventId: observable.sourceEventId,
    checkedAt: observable.checkedAt,
    severity: observable.severity
  };
}

export function buildActionGateVerdictSummaryDto(verdict?: GateDecision): ActionGateVerdictSummaryDto | undefined {
  const observable = buildObservableActionGateVerdict(verdict);
  if (!observable) return undefined;
  return {
    dtoVersion: OBSERVABLE_DTO_SUMMARY_VERSION,
    action: observable.action,
    allowed: observable.allowed,
    decision: observable.decision,
    actionClass: observable.actionClass,
    severity: observable.severity,
    snapshotRevision: observable.snapshotRevision,
    kernelTrustState: observable.kernelTrustState,
    blockingReasonCodes: unique(observable.blockingReasons.map((reason) => reason.code)),
    explanations: toUiSafeExplanations(observable.blockingReasons),
    allowedAlternatives: unique(observable.allowedAlternatives),
    relatedInvariants: unique(observable.relatedInvariants),
    gateVersion: observable.gateVersion,
    deterministicExplanation: observable.deterministicExplanation,
    traceId: observable.traceId,
    integrityStatus: observable.integrityStatus,
    provenanceStatus: observable.provenanceStatus,
    marketInputStatus: observable.marketInputStatus
  };
}

export function buildObservableSummariesDto(input: ObservableCoreReadModelInput): ObservableSummariesDto {
  const verdict = input.gateVerdict ?? input.coreTrustReport.actionVerdicts?.place_order ?? input.coreTrustReport.actions?.place_order;
  return {
    dtoVersion: OBSERVABLE_DTO_SUMMARY_VERSION,
    trust: buildTrustSummaryDto(input.coreTrustReport),
    integrity: buildIntegritySummaryDto(input.coreTrustReport.integrity),
    recovery: buildRecoverySummaryDto(input.recoveryPlan),
    quarantine: buildQuarantineSummaryDto(input.quarantineSummary),
    marketIntegrity: buildMarketIntegritySummaryDto(input.coreTrustReport.marketInput),
    provenanceIntegrity: buildProvenanceIntegritySummaryDto(input.coreTrustReport.provenance),
    actionGateVerdict: buildActionGateVerdictSummaryDto(verdict)
  };
}
