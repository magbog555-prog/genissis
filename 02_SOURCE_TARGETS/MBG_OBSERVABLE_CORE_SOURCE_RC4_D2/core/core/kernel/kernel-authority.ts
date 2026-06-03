import type { GateDecision } from "../contracts/src/actions.js";
import type { RuntimeSnapshot } from "../state/src/types.js";
import type { FreshnessReport } from "../runtime/src/freshness.js";
import type { HealthTruthSnapshot } from "../runtime/src/runtime-engine.js";
import {
  MARKET_INPUT_BLOCKING_REASON,
  PROVENANCE_BLOCKING_REASON,
  type CausalityReport,
  type IntegrityReport,
  type MarketInputBlockingReason,
  type MarketInputIntegrityReport,
  type ProvenanceBlockingReason,
  type ProvenanceHealthReport
} from "../integrity/integrity-report.js";
import { KERNEL_TRUST_STATE, type KernelTrustState } from "./kernel-constitution.js";
export { KERNEL_TRUST_STATE };

export type TrustBlockerSeverity = "info" | "warning" | "blocking" | "critical" | "panic";

export type TrustBlockerDomain =
  | "bootstrap"
  | "position"
  | "order"
  | "risk"
  | "system"
  | "exchangeTruth"
  | "freshness"
  | "healthTruth"
  | "replay"
  | "invariants"
  | "actionGate"
  | "integrity"
  | "causality"
  | "provenance"
  | "marketInput";

export interface ReplayStatusInput {
  ok: boolean;
  mismatch?: unknown;
  conflictCount?: number;
  eventCount?: number;
  currentRevision?: number;
  replayRevision?: number;
  currentCommittedAt?: string;
  replayCommittedAt?: string;
  reason?: string;
}

export interface InvariantStatusInput {
  ok: boolean;
  name?: string;
  severity?: TrustBlockerSeverity;
  details?: string;
}

export interface ActionGateStatusInput {
  placeOrder?: GateDecision;
  actions?: Record<string, GateDecision>;
}

export interface KernelAuthorityInput {
  snapshot: RuntimeSnapshot;
  freshness?: FreshnessReport;
  healthTruth?: HealthTruthSnapshot;
  replay?: ReplayStatusInput;
  invariants?: InvariantStatusInput[];
  actionGate?: ActionGateStatusInput;
  criticalCorruption?: boolean;
  integrity?: IntegrityReport;
  causality?: CausalityReport;
  provenance?: ProvenanceHealthReport;
  marketInput?: MarketInputIntegrityReport;
}

export interface TrustBlocker {
  domain: TrustBlockerDomain;
  reasonCode: string;
  explanation: string;
  severity: TrustBlockerSeverity;
  recoveryHint?: string;
}

export interface KernelAuthorityVerdict {
  trustState: KernelTrustState;
  trusted: boolean;
  snapshotRevision: number;
  evaluatedAt: string;
  blockers: TrustBlocker[];
  allowedActions: string[];
  deniedActions: string[];
  recoveryHints: string[];
  evidence: {
    bootstrapStatus: RuntimeSnapshot["bootstrap"]["status"];
    exchangeTruthStatus: RuntimeSnapshot["exchangeTruth"]["status"];
    freshnessOkForNormalTrading?: boolean;
    healthTruthComplete?: boolean;
    replayOk?: boolean;
    invariantFailures: number;
    systemStatus: RuntimeSnapshot["system"]["status"];
    integrityStatus?: IntegrityReport["status"];
    causalityTraceAvailable?: boolean;
    provenanceStatus?: ProvenanceHealthReport["status"];
    provenanceBlockingReasons?: ProvenanceBlockingReason[];
    marketInputStatus?: MarketInputIntegrityReport["status"];
    marketInputBlockingReasons?: MarketInputBlockingReason[];
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function pushBlocker(blockers: TrustBlocker[], blocker: TrustBlocker) {
  blockers.push(blocker);
}


function provenanceExplanation(reason: ProvenanceBlockingReason): string {
  switch (reason) {
    case PROVENANCE_BLOCKING_REASON.MISSING:
      return "Action provenance is missing; risk-increasing actions require valid provenance.";
    case PROVENANCE_BLOCKING_REASON.INCOMPLETE:
      return "Action provenance is incomplete; parent/source evidence is not complete.";
    case PROVENANCE_BLOCKING_REASON.INCONSISTENT:
      return "Action provenance is inconsistent with evidence.";
    case PROVENANCE_BLOCKING_REASON.UNVERIFIABLE:
      return "Action provenance cannot be verified.";
    case PROVENANCE_BLOCKING_REASON.PARENT_MISSING:
      return "Action provenance parent is missing.";
    case PROVENANCE_BLOCKING_REASON.REPLAY_MISMATCH:
      return "Action provenance does not replay deterministically.";
  }
}

function provenanceSeverity(reason: ProvenanceBlockingReason): TrustBlockerSeverity {
  if (
    reason === PROVENANCE_BLOCKING_REASON.INCONSISTENT ||
    reason === PROVENANCE_BLOCKING_REASON.PARENT_MISSING ||
    reason === PROVENANCE_BLOCKING_REASON.REPLAY_MISMATCH
  ) {
    return "critical";
  }
  return "blocking";
}

function provenanceRecoveryHint(reason: ProvenanceBlockingReason): string {
  if (reason === PROVENANCE_BLOCKING_REASON.MISSING) return "Attach provenance before retrying risk-increasing actions.";
  if (reason === PROVENANCE_BLOCKING_REASON.INCOMPLETE) return "Repair metadata chain and attach missing provenance parents.";
  if (reason === PROVENANCE_BLOCKING_REASON.UNVERIFIABLE) return "Run replay check and manual review before trusting provenance.";
  if (reason === PROVENANCE_BLOCKING_REASON.PARENT_MISSING) return "Repair metadata chain or quarantine inconsistent metadata.";
  if (reason === PROVENANCE_BLOCKING_REASON.REPLAY_MISMATCH) return "Run replay check and quarantine inconsistent metadata.";
  return "Quarantine inconsistent metadata and perform manual review.";
}

function marketInputExplanation(reason: MarketInputBlockingReason): string {
  switch (reason) {
    case MARKET_INPUT_BLOCKING_REASON.UNKNOWN:
      return "Market input integrity is unknown; risk-increasing actions require valid market observation evidence.";
    case MARKET_INPUT_BLOCKING_REASON.MISSING_PROVENANCE:
      return "Market input is missing provenance linkage.";
    case MARKET_INPUT_BLOCKING_REASON.STALE:
      return "Market input is stale.";
    case MARKET_INPUT_BLOCKING_REASON.GAP:
      return "Market input sequence gap was detected.";
    case MARKET_INPUT_BLOCKING_REASON.DUPLICATE:
      return "Market input duplicate was detected and cannot grant permission.";
    case MARKET_INPUT_BLOCKING_REASON.INVALID:
      return "Market input failed validation.";
    case MARKET_INPUT_BLOCKING_REASON.CHECKSUM_MISMATCH:
      return "Market input checksum mismatch was proven.";
    case MARKET_INPUT_BLOCKING_REASON.UNVERIFIABLE:
      return "Market input cannot be verified.";
  }
}

function marketInputSeverity(reason: MarketInputBlockingReason): TrustBlockerSeverity {
  if (reason === MARKET_INPUT_BLOCKING_REASON.CHECKSUM_MISMATCH) return "critical";
  return "blocking";
}

function marketInputRecoveryHint(reason: MarketInputBlockingReason): string {
  if (reason === MARKET_INPUT_BLOCKING_REASON.STALE || reason === MARKET_INPUT_BLOCKING_REASON.UNKNOWN) {
    return "Wait for fresh market input and resync market observation lineage.";
  }
  if (reason === MARKET_INPUT_BLOCKING_REASON.GAP || reason === MARKET_INPUT_BLOCKING_REASON.DUPLICATE) {
    return "Run market replay check and resync market input sequence.";
  }
  if (reason === MARKET_INPUT_BLOCKING_REASON.INVALID || reason === MARKET_INPUT_BLOCKING_REASON.CHECKSUM_MISMATCH) {
    return "Quarantine invalid market input, run market replay check and perform manual review.";
  }
  if (reason === MARKET_INPUT_BLOCKING_REASON.MISSING_PROVENANCE) {
    return "Attach provenance to market input before trusting it.";
  }
  return "Run market replay check and manual review before trusting market input.";
}


function hasProvenReplayMismatch(replay: ReplayStatusInput): boolean {
  if (replay.ok) return false;

  const conflictCount = replay.conflictCount ?? 0;
  const eventCount = replay.eventCount ?? 0;
  const currentRevision = replay.currentRevision ?? 0;
  const replayRevision = replay.replayRevision ?? 0;

  if (conflictCount > 0) return true;
  if (currentRevision !== replayRevision) return true;
  if (eventCount > 0 || currentRevision > 0 || replayRevision > 0) return true;

  const reason = replay.reason?.toLowerCase() ?? "";
  if (
    reason.includes("corrupt") ||
    reason.includes("journal gap") ||
    reason.includes("impossible revision") ||
    reason.includes("mismatch proved") ||
    reason.includes("replay mismatch")
  ) {
    return true;
  }

  return false;
}


function classifyNonTerminal(blockers: TrustBlocker[]): KernelTrustState {
  const hasCritical = blockers.some((b) => b.severity === "critical");
  if (hasCritical) return KERNEL_TRUST_STATE.COMPROMISED;

  const hasUnknownTruth = blockers.some((b) => {
    const code = b.reasonCode.toLowerCase();
    return code.includes("unknown") ||
      code === "freshness_unknown" ||
      code === "health_truth_unknown" ||
      code === "position_unknown";
  });
  if (hasUnknownTruth) return KERNEL_TRUST_STATE.UNCERTAIN;

  const recoverableReasons = new Set([
    "exchange_truth_stale",
    "exchange_truth_unavailable",
    "freshness_stale",
    "freshness_expired",
    "health_truth_partial",
    "bootstrap_not_reconciled",
    "risk_blocked",
    MARKET_INPUT_BLOCKING_REASON.STALE,
    MARKET_INPUT_BLOCKING_REASON.GAP,
    MARKET_INPUT_BLOCKING_REASON.DUPLICATE,
    MARKET_INPUT_BLOCKING_REASON.INVALID,
    MARKET_INPUT_BLOCKING_REASON.MISSING_PROVENANCE,
    MARKET_INPUT_BLOCKING_REASON.UNVERIFIABLE
  ]);

  const hasRecoverable = blockers.some((b) => recoverableReasons.has(b.reasonCode));
  return hasRecoverable ? KERNEL_TRUST_STATE.RECOVERABLE : KERNEL_TRUST_STATE.UNCERTAIN;
}

export function evaluateKernelTrust(input: KernelAuthorityInput, now: string | Date = new Date()): KernelAuthorityVerdict {
  const { snapshot } = input;
  const blockers: TrustBlocker[] = [];

  if (input.criticalCorruption) {
    pushBlocker(blockers, {
      domain: "system",
      reasonCode: "critical_corruption",
      explanation: "Critical corruption was reported by an upstream check.",
      severity: "panic",
      recoveryHint: "Stop normal actions and enter manual recovery/quarantine."
    });
  }

  if (input.integrity) {
    if (input.integrity.status === "tampered") {
      pushBlocker(blockers, {
        domain: "integrity",
        reasonCode: "integrity_tampered",
        explanation: input.integrity.mismatchReason ?? "Snapshot hash chain is tampered.",
        severity: "panic",
        recoveryHint: "Run replay check, halt unsafe actions and perform manual forensic review."
      });
    } else if (input.integrity.status === "broken") {
      pushBlocker(blockers, {
        domain: "integrity",
        reasonCode: "integrity_broken",
        explanation: input.integrity.mismatchReason ?? "Snapshot hash chain continuity is broken.",
        severity: "critical",
        recoveryHint: "Run replay check, inspect chain continuity and require manual review."
      });
    }
    // integrity unknown on legacy/cold state is evidence gap, not automatic corruption.
  }

  if (input.causality) {
    const contradiction =
      input.causality.traceAvailable &&
      typeof input.causality.revisionBefore === "number" &&
      typeof input.causality.revisionAfter === "number" &&
      input.causality.revisionAfter !== input.causality.revisionBefore + 1;

    if (contradiction) {
      pushBlocker(blockers, {
        domain: "causality",
        reasonCode: "causality_contradiction",
        explanation: "Causality trace contradicts revision transition.",
        severity: "critical",
        recoveryHint: "Run replay check and inspect causality trace before continuing."
      });
    }
    // causality unavailable on legacy data is not corruption by itself.
  }

  if (input.provenance) {
    for (const reason of input.provenance.blockingReasons) {
      pushBlocker(blockers, {
        domain: "provenance",
        reasonCode: reason,
        explanation: provenanceExplanation(reason),
        severity: provenanceSeverity(reason),
        recoveryHint: provenanceRecoveryHint(reason)
      });
    }
    // Missing/partial/unverifiable provenance is an evidence gap for risk-increasing actions,
    // not automatic corruption. Proven mismatch/inconsistency becomes critical evidence.
  } else {
    pushBlocker(blockers, {
      domain: "provenance",
      reasonCode: PROVENANCE_BLOCKING_REASON.MISSING,
      explanation: "Provenance report was not supplied to Kernel Authority.",
      severity: "blocking",
      recoveryHint: "Attach provenance before allowing risk-increasing actions."
    });
  }

  if (input.marketInput) {
    for (const reason of input.marketInput.blockingReasons) {
      pushBlocker(blockers, {
        domain: "marketInput",
        reasonCode: reason,
        explanation: marketInputExplanation(reason),
        severity: marketInputSeverity(reason),
        recoveryHint: marketInputRecoveryHint(reason)
      });
    }
    // Unknown/stale/gap market input blocks risk but is not corruption by default.
    // A proven checksum mismatch is critical evidence.
  } else {
    pushBlocker(blockers, {
      domain: "marketInput",
      reasonCode: MARKET_INPUT_BLOCKING_REASON.UNKNOWN,
      explanation: "Market input integrity report was not supplied to Kernel Authority.",
      severity: "blocking",
      recoveryHint: "Wait for fresh market input and attach provenance before risk-increasing actions."
    });
  }

  if (snapshot.system.status === "halted") {
    pushBlocker(blockers, {
      domain: "system",
      reasonCode: "system_halted",
      explanation: "System state is halted.",
      severity: "critical",
      recoveryHint: "Resolve halt reason before evaluating normal trading."
    });
  }

  const provenReplayMismatch = input.replay ? hasProvenReplayMismatch(input.replay) : false;
  if (input.replay && !input.replay.ok && provenReplayMismatch) {
    pushBlocker(blockers, {
      domain: "replay",
      reasonCode: "replay_mismatch",
      explanation: input.replay.reason ?? "Replay status does not match the current snapshot.",
      severity: "critical",
      recoveryHint: "Quarantine runtime state and rebuild from canonical journal/snapshot."
    });
  }

  for (const invariant of input.invariants ?? []) {
    if (!invariant.ok) {
      pushBlocker(blockers, {
        domain: "invariants",
        reasonCode: invariant.name ? `invariant_failed:${invariant.name}` : "invariant_failed",
        explanation: invariant.details ?? "An invariant failed.",
        severity: invariant.severity ?? "blocking",
        recoveryHint: "Inspect failed invariant and block unsafe actions until resolved."
      });
    }
  }

  if (snapshot.bootstrap.status !== "reconciled") {
    pushBlocker(blockers, {
      domain: "bootstrap",
      reasonCode: snapshot.bootstrap.status === "failed" ? "bootstrap_failed" : "bootstrap_not_reconciled",
      explanation: `Bootstrap status is ${snapshot.bootstrap.status}; reconciled is required for TRUSTED state.`,
      severity: snapshot.bootstrap.status === "failed" ? "critical" : "blocking",
      recoveryHint: "Complete bootstrap lifecycle and exchange reconciliation."
    });
  }

  if (snapshot.exchangeTruth.status !== "fresh") {
    const reasonCode =
      snapshot.exchangeTruth.status === "stale"
        ? "exchange_truth_stale"
        : snapshot.exchangeTruth.status === "conflicted"
          ? "exchange_truth_conflicted"
          : snapshot.exchangeTruth.status === "unavailable"
            ? "exchange_truth_unavailable"
            : "exchange_truth_unknown";
    pushBlocker(blockers, {
      domain: "exchangeTruth",
      reasonCode,
      explanation: `ExchangeTruth status is ${snapshot.exchangeTruth.status}; fresh is required for TRUSTED state.`,
      severity: snapshot.exchangeTruth.status === "conflicted" ? "critical" : "blocking",
      recoveryHint: "Refresh exchange reconciliation and resolve any exchange/local drift."
    });
  }

  if (input.freshness) {
    if (!input.freshness.okForNormalTrading) {
      for (const reason of input.freshness.blockingReasons.length > 0 ? input.freshness.blockingReasons : ["freshness_unknown"]) {
        pushBlocker(blockers, {
          domain: "freshness",
          reasonCode: reason,
          explanation: "Freshness report is not valid for normal trading.",
          severity: reason.includes("unknown") ? "blocking" : "blocking",
          recoveryHint: "Refresh market, exchange and connection observations."
        });
      }
    }
  } else {
    pushBlocker(blockers, {
      domain: "freshness",
      reasonCode: "freshness_unknown",
      explanation: "Freshness report was not supplied to Kernel Authority.",
      severity: "blocking",
      recoveryHint: "Calculate freshness before claiming TRUSTED state."
    });
  }

  if (input.healthTruth) {
    if (!input.healthTruth.healthTruthComplete || input.healthTruth.systemState === "degraded") {
      const diagnostics = input.healthTruth.healthTruthDiagnostics.length > 0
        ? input.healthTruth.healthTruthDiagnostics
        : ["health_truth_partial"];
      for (const diagnostic of diagnostics) {
        pushBlocker(blockers, {
          domain: "healthTruth",
          reasonCode: diagnostic,
          explanation: "Health truth is incomplete, partial, stale, unknown or degraded.",
          severity: input.healthTruth.systemState === "halted" ? "critical" : "blocking",
          recoveryHint: "Provide fresh and explicit health observations; unknown connection is not healthy."
        });
      }
    }
    if (input.healthTruth.systemState === "halted") {
      pushBlocker(blockers, {
        domain: "healthTruth",
        reasonCode: "health_truth_halted",
        explanation: "Health truth reports halted system state.",
        severity: "critical",
        recoveryHint: "Resolve halted health state before normal actions."
      });
    }
  } else {
    pushBlocker(blockers, {
      domain: "healthTruth",
      reasonCode: "health_truth_unknown",
      explanation: "Health truth report was not supplied to Kernel Authority.",
      severity: "blocking",
      recoveryHint: "Calculate health truth before claiming TRUSTED state."
    });
  }

  if (snapshot.position.status === "unknown") {
    pushBlocker(blockers, {
      domain: "position",
      reasonCode: "position_unknown",
      explanation: "Position is unknown.",
      severity: "blocking",
      recoveryHint: "Reconcile position from exchange truth."
    });
  }

  if (snapshot.order.status === "uncertain") {
    pushBlocker(blockers, {
      domain: "order",
      reasonCode: "order_uncertain",
      explanation: "Order state is uncertain.",
      severity: "blocking",
      recoveryHint: "Reconcile open orders before normal actions."
    });
  }

  if (snapshot.risk.status === "blocked") {
    pushBlocker(blockers, {
      domain: "risk",
      reasonCode: "risk_blocked",
      explanation: `Risk is blocked: ${snapshot.risk.reasons.join(", ") || "no reason supplied"}.`,
      severity: "blocking",
      recoveryHint: "Clear risk block only through accepted reconciliation events and reducers."
    });
  }

  const placeOrder = input.actionGate?.placeOrder ?? input.actionGate?.actions?.place_order;
  const allowedActions: string[] = [];
  const deniedActions: string[] = [];
  if (placeOrder) {
    if (placeOrder.decision === "allow") allowedActions.push(placeOrder.actionType);
    else {
      deniedActions.push(placeOrder.actionType);
      pushBlocker(blockers, {
        domain: "actionGate",
        reasonCode: placeOrder.reason ?? "action_gate_denied",
        explanation: `ActionGate denied ${placeOrder.actionType}.`,
        severity: "blocking",
        recoveryHint: "Do not bypass ActionGate; resolve its blocking states."
      });
    }
  }

  let trustState: KernelTrustState;
  if (blockers.some((b) => b.severity === "panic")) trustState = KERNEL_TRUST_STATE.PANIC;
  else if (snapshot.system.status === "halted" || blockers.some((b) => b.reasonCode === "health_truth_halted")) trustState = KERNEL_TRUST_STATE.HALTED;
  else if (provenReplayMismatch) trustState = KERNEL_TRUST_STATE.COMPROMISED;
  else if (blockers.some((b) => b.reasonCode === MARKET_INPUT_BLOCKING_REASON.CHECKSUM_MISMATCH)) trustState = KERNEL_TRUST_STATE.COMPROMISED;
  else if (blockers.some((b) => b.reasonCode === "exchange_truth_conflicted")) trustState = KERNEL_TRUST_STATE.COMPROMISED;
  else if (blockers.length === 0) trustState = KERNEL_TRUST_STATE.TRUSTED;
  else trustState = classifyNonTerminal(blockers);

  return {
    trustState,
    trusted: trustState === KERNEL_TRUST_STATE.TRUSTED,
    snapshotRevision: snapshot.revision,
    evaluatedAt: typeof now === "string" ? now : now.toISOString(),
    blockers,
    allowedActions: unique(allowedActions),
    deniedActions: unique(deniedActions),
    recoveryHints: unique(blockers.map((b) => b.recoveryHint ?? "")),
    evidence: {
      bootstrapStatus: snapshot.bootstrap.status,
      exchangeTruthStatus: snapshot.exchangeTruth.status,
      freshnessOkForNormalTrading: input.freshness?.okForNormalTrading,
      healthTruthComplete: input.healthTruth?.healthTruthComplete,
      replayOk: input.replay?.ok,
      invariantFailures: (input.invariants ?? []).filter((invariant) => !invariant.ok).length,
      systemStatus: snapshot.system.status,
      integrityStatus: input.integrity?.status,
      causalityTraceAvailable: input.causality?.traceAvailable,
      provenanceStatus: input.provenance?.status,
      provenanceBlockingReasons: input.provenance?.blockingReasons,
      marketInputStatus: input.marketInput?.status,
      marketInputBlockingReasons: input.marketInput?.blockingReasons
    }
  };
}

export const KernelAuthority = {
  evaluate: evaluateKernelTrust
} as const;
