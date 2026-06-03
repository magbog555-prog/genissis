import type { GateDecision, KernelTrustState } from "../contracts/src/actions.js";
import type { FreshnessReport } from "../runtime/src/freshness.js";
import type { HealthTruthSnapshot } from "../runtime/src/runtime-engine.js";
import type { RuntimeSnapshot } from "../state/src/types.js";
import type { BlockingReason, CoreTrustReport } from "../kernel/core-trust-report.js";

export const RECOVERY_PLANNER_VERSION = "recovery-planner-v1" as const;

export const RECOVERY_ACTION_TYPE = {
  RECONCILE_POSITION: "RECONCILE_POSITION",
  RECONCILE_ORDERS: "RECONCILE_ORDERS",
  SYNC_FILLS: "SYNC_FILLS",
  REFRESH_MARKET_DATA: "REFRESH_MARKET_DATA",
  CHECK_HEALTH: "CHECK_HEALTH",
  RUN_REPLAY_CHECK: "RUN_REPLAY_CHECK",
  INSPECT_QUARANTINE: "INSPECT_QUARANTINE",
  HALT_RUNTIME: "HALT_RUNTIME",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  INSPECT_TRACE: "INSPECT_TRACE",
  ATTACH_PROVENANCE: "ATTACH_PROVENANCE",
  REPAIR_METADATA_CHAIN: "REPAIR_METADATA_CHAIN",
  QUARANTINE_INCONSISTENT_METADATA: "QUARANTINE_INCONSISTENT_METADATA",
  WAIT_FOR_FRESH_MARKET_INPUT: "WAIT_FOR_FRESH_MARKET_INPUT",
  RUN_MARKET_REPLAY_CHECK: "RUN_MARKET_REPLAY_CHECK",
  RESYNC_MARKET_INPUT: "RESYNC_MARKET_INPUT",
  QUARANTINE_INVALID_MARKET_INPUT: "QUARANTINE_INVALID_MARKET_INPUT"
} as const;

export type RecoveryActionType = typeof RECOVERY_ACTION_TYPE[keyof typeof RECOVERY_ACTION_TYPE];

export type RecoveryMode =
  | "none"
  | "evidence_collection"
  | "guided_recovery"
  | "forensic_review"
  | "halted_review"
  | "panic_halt";

export type RecoveryPriority = "none" | "low" | "medium" | "high" | "critical";

export type ForbiddenRecoveryAction =
  | "PLACE_ORDER"
  | "RESUME_RUNTIME"
  | "LIVE_TRADING"
  | "BYPASS_ACTION_GATE"
  | "MUTATE_SNAPSHOT"
  | "WRITE_EVENTS"
  | "CALL_EXCHANGE";

export interface QuarantineSummary {
  count?: number;
  itemCount?: number;
  quarantinedCount?: number;
  badDataCount?: number;
  rejectedEventCount?: number;
  hasItems?: boolean;
  reasons?: string[];
  [key: string]: unknown;
}

export interface RecoveryPlannerInput {
  coreTrustReport: CoreTrustReport;
  blockingReasons?: BlockingReason[];
  trustState?: KernelTrustState;
  exchangeTruth?: RuntimeSnapshot["exchangeTruth"];
  freshness?: FreshnessReport;
  healthTruth?: HealthTruthSnapshot;
  quarantineSummary?: QuarantineSummary;
  lastActionGateVerdict?: GateDecision;
}

export interface RecoveryPlan {
  required: boolean;
  mode: RecoveryMode;
  reasons: string[];
  nextActions: RecoveryActionType[];
  forbiddenActions: ForbiddenRecoveryAction[];
  priority: RecoveryPriority;
  manualReviewRequired: boolean;
  plannerVersion: typeof RECOVERY_PLANNER_VERSION;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function reasonCodes(reasons: BlockingReason[]): string[] {
  return unique(reasons.map((reason) => reason.code).filter((code) => code.trim().length > 0));
}

function quarantineCount(summary?: QuarantineSummary): number {
  if (!summary) return 0;

  const numericValues = [
    summary.count,
    summary.itemCount,
    summary.quarantinedCount,
    summary.badDataCount,
    summary.rejectedEventCount
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (numericValues.length > 0) return numericValues.reduce((total, value) => total + Math.max(0, value), 0);
  return summary.hasItems ? 1 : 0;
}

function replayIsMismatch(report: CoreTrustReport): boolean {
  const replay = report.replay as { ok?: boolean; mismatch?: unknown; reason?: unknown } | undefined;
  if (!replay) return false;
  if (replay.ok === false && replay.mismatch) return true;
  if (typeof replay.reason === "string" && replay.reason.toLowerCase().includes("mismatch")) return true;
  return false;
}

function addForReason(code: string, actions: RecoveryActionType[], manualReviewReasons: string[]) {
  if (code === "position_unknown" || code === "bootstrap_position_not_reconciled") {
    actions.push(RECOVERY_ACTION_TYPE.RECONCILE_POSITION);
  }

  if (
    code === "exchange_truth_unknown" ||
    code === "exchange_truth_stale" ||
    code === "exchange_truth_unavailable"
  ) {
    actions.push(RECOVERY_ACTION_TYPE.RECONCILE_POSITION, RECOVERY_ACTION_TYPE.RECONCILE_ORDERS);
  }

  if (code === "exchange_truth_conflicted") {
    actions.push(
      RECOVERY_ACTION_TYPE.RECONCILE_POSITION,
      RECOVERY_ACTION_TYPE.RECONCILE_ORDERS,
      RECOVERY_ACTION_TYPE.SYNC_FILLS,
      RECOVERY_ACTION_TYPE.MANUAL_REVIEW
    );
    manualReviewReasons.push(code);
  }

  if (
    code === "market_data_stale" ||
    code === "freshness_stale" ||
    code === "freshness_expired" ||
    code === "freshness_unknown"
  ) {
    actions.push(RECOVERY_ACTION_TYPE.REFRESH_MARKET_DATA);
  }

  if (
    code === "health_truth_unknown" ||
    code === "health_truth_partial" ||
    code === "connection_state_unknown" ||
    code === "connection_state_stale" ||
    code === "ws_status_unknown"
  ) {
    actions.push(RECOVERY_ACTION_TYPE.CHECK_HEALTH);
  }

  if (code === "replay_mismatch") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    manualReviewReasons.push(code);
  }

  if (code === "system_halted" || code === "health_truth_halted") {
    actions.push(RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    manualReviewReasons.push(code);
  }

  if (code === "critical_corruption") {
    actions.push(RECOVERY_ACTION_TYPE.HALT_RUNTIME, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    manualReviewReasons.push(code);
  }

  if (code === "integrity_broken") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    manualReviewReasons.push(code);
  }

  if (code === "integrity_tampered") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.MANUAL_REVIEW, RECOVERY_ACTION_TYPE.HALT_RUNTIME);
    manualReviewReasons.push(code);
  }

  if (code === "causality_missing") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.INSPECT_TRACE);
  }

  if (code === "causality_contradiction") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.INSPECT_TRACE, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    manualReviewReasons.push(code);
  }

  if (code === "PROVENANCE_MISSING" || code === "provenance_missing") {
    actions.push(RECOVERY_ACTION_TYPE.ATTACH_PROVENANCE);
  }

  if (code === "PROVENANCE_INCOMPLETE" || code === "PROVENANCE_PARENT_MISSING" || code === "provenance_incomplete" || code === "provenance_parent_missing") {
    actions.push(RECOVERY_ACTION_TYPE.REPAIR_METADATA_CHAIN, RECOVERY_ACTION_TYPE.ATTACH_PROVENANCE);
  }

  if (code === "PROVENANCE_UNVERIFIABLE" || code === "provenance_unverifiable") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
  }

  if (code === "PROVENANCE_INCONSISTENT" || code === "PROVENANCE_REPLAY_MISMATCH" || code === "provenance_inconsistent" || code === "provenance_replay_mismatch") {
    actions.push(
      RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK,
      RECOVERY_ACTION_TYPE.REPAIR_METADATA_CHAIN,
      RECOVERY_ACTION_TYPE.QUARANTINE_INCONSISTENT_METADATA,
      RECOVERY_ACTION_TYPE.MANUAL_REVIEW
    );
    manualReviewReasons.push(code);
  }

  if (code === "MARKET_INPUT_UNKNOWN") {
    actions.push(RECOVERY_ACTION_TYPE.WAIT_FOR_FRESH_MARKET_INPUT, RECOVERY_ACTION_TYPE.RESYNC_MARKET_INPUT);
  }

  if (code === "MARKET_INPUT_MISSING_PROVENANCE") {
    actions.push(RECOVERY_ACTION_TYPE.ATTACH_PROVENANCE, RECOVERY_ACTION_TYPE.RESYNC_MARKET_INPUT);
  }

  if (code === "MARKET_INPUT_STALE") {
    actions.push(RECOVERY_ACTION_TYPE.WAIT_FOR_FRESH_MARKET_INPUT, RECOVERY_ACTION_TYPE.RESYNC_MARKET_INPUT);
  }

  if (code === "MARKET_INPUT_GAP" || code === "MARKET_INPUT_DUPLICATE") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_MARKET_REPLAY_CHECK, RECOVERY_ACTION_TYPE.RESYNC_MARKET_INPUT);
  }

  if (code === "MARKET_INPUT_INVALID" || code === "MARKET_INPUT_UNVERIFIABLE") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_MARKET_REPLAY_CHECK, RECOVERY_ACTION_TYPE.QUARANTINE_INVALID_MARKET_INPUT, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    manualReviewReasons.push(code);
  }

  if (code === "MARKET_INPUT_CHECKSUM_MISMATCH") {
    actions.push(
      RECOVERY_ACTION_TYPE.RUN_MARKET_REPLAY_CHECK,
      RECOVERY_ACTION_TYPE.QUARANTINE_INVALID_MARKET_INPUT,
      RECOVERY_ACTION_TYPE.MANUAL_REVIEW
    );
    manualReviewReasons.push(code);
  }
}

function modeFor(trustState: KernelTrustState, required: boolean): RecoveryMode {
  if (!required) return "none";
  if (trustState === "PANIC") return "panic_halt";
  if (trustState === "HALTED") return "halted_review";
  if (trustState === "COMPROMISED") return "forensic_review";
  if (trustState === "RECOVERABLE") return "guided_recovery";
  return "evidence_collection";
}

function priorityFor(trustState: KernelTrustState, actions: RecoveryActionType[], reasons: string[]): RecoveryPriority {
  if (trustState === "PANIC" || reasons.includes("critical_corruption")) return "critical";
  if (trustState === "HALTED" || trustState === "COMPROMISED" || actions.includes(RECOVERY_ACTION_TYPE.MANUAL_REVIEW)) return "high";
  if (actions.length > 0) return "medium";
  return "none";
}

export function planRecovery(input: RecoveryPlannerInput): RecoveryPlan {
  const report = input.coreTrustReport;
  const trustState = input.trustState ?? report.trustState;
  const blockingReasons = input.blockingReasons ?? report.blockingReasons ?? [];
  const exchangeTruth = input.exchangeTruth ?? report.exchangeTruth;
  const freshness = input.freshness ?? report.freshness;
  const healthTruth = input.healthTruth ?? report.healthTruth;
  const lastVerdict = input.lastActionGateVerdict;

  const reasons = reasonCodes(blockingReasons);
  const actions: RecoveryActionType[] = [];
  const manualReviewReasons: string[] = [];

  for (const code of reasons) {
    addForReason(code, actions, manualReviewReasons);
  }

  if (exchangeTruth.status === "unknown" || exchangeTruth.status === "stale" || exchangeTruth.status === "unavailable") {
    actions.push(RECOVERY_ACTION_TYPE.RECONCILE_POSITION, RECOVERY_ACTION_TYPE.RECONCILE_ORDERS);
    reasons.push(`exchange_truth_${exchangeTruth.status}`);
  }

  if (exchangeTruth.status === "conflicted") {
    actions.push(
      RECOVERY_ACTION_TYPE.RECONCILE_POSITION,
      RECOVERY_ACTION_TYPE.RECONCILE_ORDERS,
      RECOVERY_ACTION_TYPE.SYNC_FILLS,
      RECOVERY_ACTION_TYPE.MANUAL_REVIEW
    );
    reasons.push("exchange_truth_conflicted");
    manualReviewReasons.push("exchange_truth_conflicted");
  }

  if (freshness.marketDataFreshness.status !== "fresh") {
    actions.push(RECOVERY_ACTION_TYPE.REFRESH_MARKET_DATA);
    reasons.push(freshness.marketDataFreshness.reason ?? "market_freshness_not_fresh");
  }

  if (freshness.exchangeTruthFreshness.status !== "fresh") {
    actions.push(RECOVERY_ACTION_TYPE.RECONCILE_POSITION, RECOVERY_ACTION_TYPE.RECONCILE_ORDERS);
    reasons.push(freshness.exchangeTruthFreshness.reason ?? "exchange_truth_freshness_not_fresh");
  }

  if (freshness.connectionFreshness.status !== "fresh") {
    actions.push(RECOVERY_ACTION_TYPE.CHECK_HEALTH);
    reasons.push(freshness.connectionFreshness.reason ?? "connection_freshness_not_fresh");
  }

  if (!healthTruth.healthTruthComplete || healthTruth.wsConnected === "unknown" || healthTruth.wsConnected === "stale") {
    actions.push(RECOVERY_ACTION_TYPE.CHECK_HEALTH);
    reasons.push("health_truth_not_complete");
  }

  if (replayIsMismatch(report) || trustState === "COMPROMISED") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    reasons.push(replayIsMismatch(report) ? "replay_mismatch" : "trust_state_compromised");
    manualReviewReasons.push("compromised");
  }

  if (report.integrity?.status === "broken") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    reasons.push("integrity_broken");
    manualReviewReasons.push("integrity_broken");
  }

  if (report.integrity?.status === "tampered") {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.MANUAL_REVIEW, RECOVERY_ACTION_TYPE.HALT_RUNTIME);
    reasons.push("integrity_tampered");
    manualReviewReasons.push("integrity_tampered");
  }

  if (report.causality && !report.causality.traceAvailable && report.revision > 0) {
    actions.push(RECOVERY_ACTION_TYPE.RUN_REPLAY_CHECK, RECOVERY_ACTION_TYPE.INSPECT_TRACE);
    reasons.push("causality_missing");
  }

  if (report.marketInput && report.marketInput.status !== "valid") {
    reasons.push(...report.marketInput.blockingReasons);
    if (report.marketInput.status === "unknown" || report.marketInput.status === "stale") {
      actions.push(RECOVERY_ACTION_TYPE.WAIT_FOR_FRESH_MARKET_INPUT, RECOVERY_ACTION_TYPE.RESYNC_MARKET_INPUT);
    }
    if (report.marketInput.status === "gap_detected" || report.marketInput.status === "duplicate") {
      actions.push(RECOVERY_ACTION_TYPE.RUN_MARKET_REPLAY_CHECK, RECOVERY_ACTION_TYPE.RESYNC_MARKET_INPUT);
    }
    if (report.marketInput.status === "invalid" || report.marketInput.status === "unverifiable" || report.marketInput.status === "checksum_mismatch") {
      actions.push(RECOVERY_ACTION_TYPE.RUN_MARKET_REPLAY_CHECK, RECOVERY_ACTION_TYPE.QUARANTINE_INVALID_MARKET_INPUT, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
      manualReviewReasons.push(...report.marketInput.blockingReasons);
    }
  }

  if (trustState === "PANIC") {
    actions.push(RECOVERY_ACTION_TYPE.HALT_RUNTIME, RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    reasons.push("trust_state_panic");
    manualReviewReasons.push("panic");
  }

  if (trustState === "HALTED") {
    actions.push(RECOVERY_ACTION_TYPE.MANUAL_REVIEW);
    reasons.push("trust_state_halted");
    manualReviewReasons.push("halted");
  }

  const qCount = quarantineCount(input.quarantineSummary);
  if (qCount > 0) {
    actions.push(RECOVERY_ACTION_TYPE.INSPECT_QUARANTINE);
    reasons.push("quarantine_items_present");
  }

  if (lastVerdict?.decision === "deny") {
    reasons.push(...lastVerdict.blockingReasons);
  }

  const uniqueReasons = unique(reasons);
  const uniqueActions = unique(actions);
  const required = trustState !== "TRUSTED" || uniqueActions.length > 0;
  const manualReviewRequired =
    trustState === "PANIC" ||
    trustState === "COMPROMISED" ||
    trustState === "HALTED" ||
    manualReviewReasons.length > 0 ||
    uniqueActions.includes(RECOVERY_ACTION_TYPE.MANUAL_REVIEW);

  return {
    required,
    mode: modeFor(trustState, required),
    reasons: required ? uniqueReasons : [],
    nextActions: required ? uniqueActions : [],
    forbiddenActions: required
      ? ["PLACE_ORDER", "LIVE_TRADING", "BYPASS_ACTION_GATE", "MUTATE_SNAPSHOT", "WRITE_EVENTS", "CALL_EXCHANGE"]
      : ["BYPASS_ACTION_GATE", "MUTATE_SNAPSHOT", "WRITE_EVENTS", "CALL_EXCHANGE"],
    priority: priorityFor(trustState, uniqueActions, uniqueReasons),
    manualReviewRequired,
    plannerVersion: RECOVERY_PLANNER_VERSION
  };
}

export const RecoveryPlanner = {
  plan: planRecovery
} as const;
