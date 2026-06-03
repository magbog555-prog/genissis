import {
  ACTION_TYPE,
  ActionClass,
  ActionRequest,
  ActionType,
  GateDecision,
  GateSeverity,
  KernelTrustState
} from "../../contracts/src/actions.js";
import { RuntimeSnapshot } from "../../state/src/types.js";
import { calculateSnapshotFreshness, type FreshnessConfig, type FreshnessReport } from "../../runtime/src/freshness.js";
import {
  PROVENANCE_BLOCKING_REASON,
  marketInputBlockingReasonsFor,
  marketInputIsValidForRiskIncrease,
  provenanceBlockingReasonsFor,
  provenanceIsValidForRiskIncrease,
  provenanceReasonToGateReason,
  type CausalityReport,
  type IntegrityReport,
  type MarketInputIntegrityReport,
  type ProvenanceHealthReport
} from "../../integrity/integrity-report.js";

type CompatActionRequest = ActionRequest & {
  actionType?: ActionType;
  actionId?: string;
};

export interface ActionGateOptions {
  enforceFreshness?: boolean;
  now?: string | Date;
  freshnessConfig?: Partial<FreshnessConfig>;
  freshness?: FreshnessReport;
  integrity?: IntegrityReport;
  causality?: CausalityReport;
  provenance?: ProvenanceHealthReport;
  marketInput?: MarketInputIntegrityReport;
}

const GATE_VERSION = "action-gate-v2" as const;

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function classifyAction(actionType: ActionType): ActionClass {
  switch (actionType) {
    case ACTION_TYPE.PLACE_ORDER:
      return "NORMAL";
    case ACTION_TYPE.CANCEL_ORDER:
      return "RISK_REDUCING";
    case ACTION_TYPE.RECONCILE_ORDER:
    case ACTION_TYPE.RECONCILE_POSITION:
    case ACTION_TYPE.PAUSE_RUNTIME:
      return "RECOVERY";
    case ACTION_TYPE.RESUME_RUNTIME:
      return "ADMIN";
    default:
      return "DIAGNOSTIC";
  }
}

function severityFor(actionClass: ActionClass, blocked: boolean): GateSeverity {
  if (!blocked) return "info";
  if (actionClass === "NORMAL") return "critical";
  if (actionClass === "ADMIN") return "warning";
  return "warning";
}

function kernelTrustState(snapshot: RuntimeSnapshot, freshness?: FreshnessReport): KernelTrustState {
  const trusted =
    snapshot.bootstrap.status === "reconciled" &&
    snapshot.exchangeTruth.status === "fresh" &&
    snapshot.position.status !== "unknown" &&
    snapshot.risk.status === "clear" &&
    snapshot.system.status === "healthy" &&
    (!freshness || freshness.okForNormalTrading);

  if (trusted) return "TRUSTED";
  if (snapshot.system.status === "halted") return "HALTED";
  if (snapshot.exchangeTruth.status === "conflicted") return "COMPROMISED";
  if (snapshot.system.status === "degraded") return "RECOVERABLE";
  if (snapshot.bootstrap.status === "cold" || snapshot.exchangeTruth.status === "unknown" || snapshot.position.status === "unknown") return "UNCERTAIN";
  return "RECOVERABLE";
}

function exchangeTruthReason(snapshot: RuntimeSnapshot) {
  if (snapshot.exchangeTruth.status === "fresh") return undefined;
  if (snapshot.exchangeTruth.status === "stale") return "exchange_truth_stale";
  if (snapshot.exchangeTruth.status === "conflicted") return "exchange_truth_conflicted";
  if (snapshot.exchangeTruth.status === "unavailable") return "exchange_truth_unavailable";
  return "exchange_truth_unknown";
}

function bootstrapReason(snapshot: RuntimeSnapshot) {
  if (snapshot.bootstrap.status === "reconciled") return undefined;
  if (snapshot.bootstrap.status === "failed") return "bootstrap_failed";
  if (snapshot.bootstrap.status === "awaiting_exchange_truth") return "bootstrap_awaiting_exchange_truth";
  return "bootstrap_not_reconciled";
}

function relatedInvariantsFor(reasons: string[]): string[] {
  const invariants: string[] = [];
  for (const reason of reasons) {
    if (reason.startsWith("bootstrap_")) invariants.push("bootstrap_must_be_reconciled_before_normal_action");
    if (reason.startsWith("exchange_truth_")) invariants.push("exchange_truth_must_be_fresh_before_normal_action");
    if (reason === "market_data_stale" || reason === "freshness_unknown") invariants.push("market_data_must_be_fresh_before_normal_action");
    if (reason === "connection_state_unknown" || reason === "health_truth_partial" || reason === "ws_status_unknown") invariants.push("health_truth_must_be_known_before_normal_action");
    if (reason === "position_unknown" || reason === "bootstrap_position_not_reconciled") invariants.push("position_must_be_known_before_normal_action");
    if (reason === "risk_blocked") invariants.push("risk_must_be_clear_before_normal_action");
    if (reason === "order_uncertain_requires_reconcile") invariants.push("uncertain_orders_require_reconcile");
    if (reason === "system_halted" || reason === "system_degraded") invariants.push("system_must_be_healthy_before_normal_action");
    if (reason === "integrity_broken" || reason === "integrity_tampered") invariants.push("integrity_chain_must_be_valid_before_normal_action");
    if (reason === "causality_contradiction") invariants.push("causality_trace_must_not_contradict_transition");
    if (reason.startsWith("provenance_")) invariants.push("risk_increasing_actions_require_valid_provenance");
    if (reason.startsWith("MARKET_INPUT_")) invariants.push("risk_increasing_actions_require_valid_market_input");
  }
  return unique(invariants);
}

function allowedAlternativesFor(actionClass: ActionClass, blocked: boolean): ActionType[] {
  if (!blocked) return [];
  if (actionClass === "NORMAL") {
    return [
      ACTION_TYPE.RECONCILE_POSITION,
      ACTION_TYPE.RECONCILE_ORDER,
      ACTION_TYPE.PAUSE_RUNTIME
    ];
  }
  if (actionClass === "ADMIN") {
    return [
      ACTION_TYPE.RECONCILE_POSITION,
      ACTION_TYPE.RECONCILE_ORDER
    ];
  }
  return [];
}

function primaryReason(reasons: string[]): string | undefined {
  const priority = [
    "invalid_action_type",
    "bootstrap_failed",
    "bootstrap_awaiting_exchange_truth",
    "bootstrap_not_reconciled",
    "exchange_truth_conflicted",
    "exchange_truth_unknown",
    "exchange_truth_unavailable",
    "exchange_truth_stale",
    "market_data_stale",
    "connection_state_unknown",
    "freshness_unknown",
    "order_uncertain_requires_reconcile",
    "position_unknown",
    "bootstrap_position_not_reconciled",
    "risk_blocked",
    "provenance_replay_mismatch",
    "provenance_inconsistent",
    "provenance_parent_missing",
    "provenance_unverifiable",
    "provenance_incomplete",
    "provenance_missing",
    "MARKET_INPUT_CHECKSUM_MISMATCH",
    "MARKET_INPUT_INVALID",
    "MARKET_INPUT_GAP",
    "MARKET_INPUT_STALE",
    "MARKET_INPUT_UNVERIFIABLE",
    "MARKET_INPUT_DUPLICATE",
    "MARKET_INPUT_MISSING_PROVENANCE",
    "MARKET_INPUT_UNKNOWN",
    "system_halted",
    "system_degraded",
    "market_not_open",
    "cannot_resume_until_recovered",
    "unsafe_state_requires_reconcile"
  ];
  return priority.find((reason) => reasons.includes(reason)) ?? reasons[0];
}

export class ActionGate {
  evaluate(action: CompatActionRequest, snapshot: RuntimeSnapshot, options: ActionGateOptions = {}): GateDecision {
    const actionType = (action.type ?? action.actionType) as ActionType;
    const actionId = action.actionId ?? `probe:${actionType}`;
    const actionClass = classifyAction(actionType);
    const blockingStates: string[] = [];
    const blockingReasons: string[] = [];

    const integrity = options.integrity;
    const causality = options.causality;
    const provenance = options.provenance;
    const marketInput = options.marketInput;
    const marketInputPolicyActive = options.marketInput !== undefined;
    const provenanceBlockingReasons = provenanceBlockingReasonsFor(provenance?.status ?? "missing", provenance?.blockingReasons ?? []);
    const marketInputBlockingReasons = marketInputBlockingReasonsFor(marketInput?.status ?? "unknown", marketInput?.blockingReasons ?? []);
    const freshness =
      options.enforceFreshness || options.freshness
        ? options.freshness ?? calculateSnapshotFreshness(snapshot, {
            now: options.now ?? new Date(),
            config: options.freshnessConfig
          })
        : undefined;

    const bootstrapBlock = bootstrapReason(snapshot);
    if (bootstrapBlock) {
      blockingReasons.push(bootstrapBlock);
      blockingStates.push("bootstrap");
    }

    const exchangeBlock = exchangeTruthReason(snapshot);
    if (exchangeBlock) {
      blockingReasons.push(exchangeBlock);
      blockingStates.push("exchangeTruth");
    }

    if (snapshot.order.status === "uncertain") {
      blockingReasons.push("order_uncertain_requires_reconcile");
      blockingStates.push("order");
    }

    if (snapshot.position.status === "unknown") {
      blockingReasons.push("position_unknown");
      blockingStates.push("position");
    }

    if (snapshot.risk.reasons.includes("bootstrap_position_not_reconciled")) {
      blockingReasons.push("bootstrap_position_not_reconciled");
      blockingStates.push("risk");
    } else if (snapshot.risk.status === "blocked") {
      blockingReasons.push("risk_blocked");
      blockingStates.push("risk");
    }

    if (snapshot.system.status === "halted") {
      blockingReasons.push("system_halted");
      blockingStates.push("system");
    } else if (snapshot.system.status === "degraded") {
      blockingReasons.push("system_degraded");
      blockingStates.push("system");
    }

    if (freshness && !freshness.okForNormalTrading) {
      blockingReasons.push(...freshness.blockingReasons);
      if (freshness.marketDataFreshness.status !== "fresh") blockingStates.push("market", "freshness");
      if (freshness.exchangeTruthFreshness.status !== "fresh") blockingStates.push("exchangeTruth", "freshness");
      if (freshness.connectionFreshness.status !== "fresh") blockingStates.push("connection", "freshness");
    }

    if (integrity?.status === "broken" || integrity?.status === "tampered") {
      blockingReasons.push(integrity.status === "tampered" ? "integrity_tampered" : "integrity_broken");
      blockingStates.push("integrity");
    }

    if (causality?.traceAvailable && typeof causality.revisionBefore === "number" && typeof causality.revisionAfter === "number" && causality.revisionAfter !== causality.revisionBefore + 1) {
      blockingReasons.push("causality_contradiction");
      blockingStates.push("causality");
    }

    const provenanceValidForRisk = provenanceIsValidForRiskIncrease(provenance);
    if (actionClass === "NORMAL" && !provenanceValidForRisk) {
      for (const reason of provenanceBlockingReasons) {
        blockingReasons.push(provenanceReasonToGateReason(reason));
      }
      blockingStates.push("provenance");
    }

    const marketInputValidForRisk = marketInputIsValidForRiskIncrease(marketInput);
    if (actionClass === "NORMAL" && marketInputPolicyActive && !marketInputValidForRisk) {
      blockingReasons.push(...marketInputBlockingReasons);
      blockingStates.push("marketInput");
    }

    const normalRuntimeBlocked = blockingReasons.length > 0;
    const isRecoveryAction = actionClass === "RECOVERY" || actionClass === "RISK_REDUCING" || actionClass === "DIAGNOSTIC";

    if (!actionType) {
      blockingReasons.push("invalid_action_type");
      blockingStates.push("action");
    }

    if (actionType === ACTION_TYPE.PLACE_ORDER && snapshot.market.status !== "open") {
      blockingReasons.push("market_not_open");
      blockingStates.push("market");
    }

    if (actionType === ACTION_TYPE.RESUME_RUNTIME && (snapshot.system.status === "degraded" || snapshot.risk.status === "blocked")) {
      blockingReasons.push("cannot_resume_until_recovered");
      blockingStates.push("system", "risk");
    }

    const uniqueBlockingReasons = unique(blockingReasons);
    const blocked =
      !actionType ||
      (normalRuntimeBlocked && !isRecoveryAction) ||
      actionType === ACTION_TYPE.PLACE_ORDER && uniqueBlockingReasons.length > 0 ||
      actionType === ACTION_TYPE.RESUME_RUNTIME && uniqueBlockingReasons.includes("cannot_resume_until_recovered");

    const reason = blocked ? primaryReason(uniqueBlockingReasons) ?? "action_gate_denied" : undefined;
    const allowed = !blocked;

    return {
      action: {
        actionId,
        actionType,
        request: {
          type: actionType,
          symbol: action.symbol,
          side: action.side,
          quantity: action.quantity,
          price: action.price
        }
      },
      allowed,
      actionClass,
      severity: severityFor(actionClass, blocked),
      snapshotRevision: snapshot.revision,
      kernelTrustState: kernelTrustState(snapshot, freshness),
      blockingReasons: blocked ? uniqueBlockingReasons : [],
      allowedAlternatives: allowedAlternativesFor(actionClass, blocked),
      relatedInvariants: blocked ? relatedInvariantsFor(uniqueBlockingReasons) : [],
      gateVersion: GATE_VERSION,
      integrityStatus: integrity?.status,
      traceId: causality?.lastTraceId,
      provenanceStatus: provenance?.status ?? "missing",
      provenanceBlockingReasons,
      provenanceTraceId: provenance?.traceId,
      marketInputStatus: marketInput?.status ?? "unknown",
      marketInputBlockingReasons,
      marketInputEventId: marketInput?.eventId,
      actionId,
      actionType,
      decision: allowed ? "allow" : "deny",
      reason,
      blockingStates: blocked && blockingStates.length ? unique(blockingStates) : undefined
    };
  }

  evaluateAll(snapshot: RuntimeSnapshot, options: ActionGateOptions = {}): Record<string, GateDecision> {
    const actions = [
      { type: ACTION_TYPE.PLACE_ORDER },
      { type: ACTION_TYPE.CANCEL_ORDER },
      { type: ACTION_TYPE.RECONCILE_ORDER },
      { type: ACTION_TYPE.RECONCILE_POSITION },
      { type: ACTION_TYPE.PAUSE_RUNTIME },
      { type: ACTION_TYPE.RESUME_RUNTIME }
    ];
    return Object.fromEntries(actions.map(a => [a.type, this.evaluate(a as any, snapshot, options)]));
  }
}
