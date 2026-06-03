import type { GateDecision } from "../contracts/src/actions.js";
import type { DomainEvent } from "../contracts/src/events.js";
import type { FreshnessReport } from "../runtime/src/freshness.js";
import type { HealthTruthSnapshot, InvariantCheck, TransitionTrace } from "../runtime/src/runtime-engine.js";
import {
  buildCausalityReport,
  buildIntegrityReport,
  buildMarketInputIntegrityReport,
  buildProvenanceHealthReport,
  type CausalityReport,
  type IntegrityReport,
  type MarketInputBlockingReason,
  type MarketInputIntegrityReport,
  type MarketInputStatus,
  type ProvenanceBlockingReason,
  type ProvenanceHealthReport,
  type ProvenanceStatus
} from "../integrity/integrity-report.js";
import type { RuntimeSnapshot } from "../state/src/types.js";
import { KERNEL_TRUST_STATE, type KernelTrustState } from "./kernel-constitution.js";
import { evaluateKernelTrust, type KernelAuthorityVerdict, type TrustBlocker } from "./kernel-authority.js";

export type RuntimeMode = "bootstrapping" | "readonly" | "normal" | "degraded" | "halted";

export type AllowedActionClass =
  | "NORMAL"
  | "RISK_REDUCING"
  | "RECOVERY"
  | "DIAGNOSTIC"
  | "ADMIN"
  | "NONE";

export type BlockingReasonSeverity = "info" | "warning" | "blocking" | "critical" | "panic";

export interface BlockingReason {
  code: string;
  domain: string;
  severity: BlockingReasonSeverity;
  message: string;
  evidence?: Record<string, unknown>;
}

export interface CoreTrustReport {
  [key: string]: unknown;
  revision: number;
  trustState: KernelTrustState;
  runtimeMode: RuntimeMode;
  tradingAllowed: boolean;
  allowedActionClasses: AllowedActionClass[];
  blockingReasons: BlockingReason[];
  nextRecoveryActions: string[];
  recoveryHints: string[];
  recoveryActions: string[];
  bootstrap: RuntimeSnapshot["bootstrap"];
  exchangeTruth: RuntimeSnapshot["exchangeTruth"];
  freshness: FreshnessReport;
  healthTruth: HealthTruthSnapshot;
  replay: Record<string, unknown>;
  invariants: InvariantCheck[];
  actionVerdicts: Record<string, GateDecision>;
  actions: Record<string, GateDecision>;
  allowedActions: GateDecision[];
  deniedActions: GateDecision[];
  kernelAuthority: KernelAuthorityVerdict;
  metadata?: Record<string, unknown>;
  lastEvent?: DomainEvent;
  lastTransition?: TransitionTrace;
  integrity?: IntegrityReport;
  causality?: CausalityReport;
  provenanceStatus: ProvenanceStatus;
  provenanceBlockingReasons: ProvenanceBlockingReason[];
  provenance?: ProvenanceHealthReport;
  marketInputStatus: MarketInputStatus;
  marketInputBlockingReasons: MarketInputBlockingReason[];
  marketInput?: MarketInputIntegrityReport;
}

export interface CoreTrustReportInput {
  snapshot: RuntimeSnapshot;
  permissions: {
    tradingAllowed: boolean;
    actions: Record<string, GateDecision>;
  };
  freshness: FreshnessReport;
  healthTruth: HealthTruthSnapshot;
  replay: Record<string, unknown> & { ok?: boolean };
  invariants: InvariantCheck[];
  lastEvent?: DomainEvent;
  lastTransition?: TransitionTrace;
  metadata?: Record<string, unknown>;
  integrity?: IntegrityReport;
  causality?: CausalityReport;
  provenance?: ProvenanceHealthReport;
  marketInput?: MarketInputIntegrityReport;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function toBlockingReason(blocker: TrustBlocker): BlockingReason {
  return {
    code: blocker.reasonCode,
    domain: blocker.domain,
    severity: blocker.severity,
    message: blocker.explanation,
    evidence: blocker.recoveryHint ? { recoveryHint: blocker.recoveryHint } : undefined
  };
}

function uniqueActionClasses(classes: AllowedActionClass[]): AllowedActionClass[] {
  const ordered: AllowedActionClass[] = ["NORMAL", "RISK_REDUCING", "RECOVERY", "DIAGNOSTIC", "ADMIN", "NONE"];
  const set = new Set(classes);
  if (set.size === 0) set.add("NONE");
  if (set.size > 1) set.delete("NONE");
  return ordered.filter((value) => set.has(value));
}

function runtimeMode(snapshot: RuntimeSnapshot, healthTruth: HealthTruthSnapshot, trustState: KernelTrustState): RuntimeMode {
  if (trustState === KERNEL_TRUST_STATE.HALTED || snapshot.system.status === "halted") return "halted";
  if (snapshot.bootstrap.status !== "reconciled") return "bootstrapping";
  if (snapshot.system.status === "degraded" || !healthTruth.healthTruthComplete) return "degraded";
  if (snapshot.risk.status === "blocked") return "readonly";
  return "normal";
}

function actionClassFromDecision(decision: GateDecision): AllowedActionClass {
  return decision.actionClass ?? (
    decision.actionType === "place_order"
      ? "NORMAL"
      : decision.actionType === "cancel_order"
        ? "RISK_REDUCING"
        : decision.actionType === "resume_runtime"
          ? "ADMIN"
          : "RECOVERY"
  );
}

function allowedClasses(actions: Record<string, GateDecision>, tradingAllowed: boolean): AllowedActionClass[] {
  const classes: AllowedActionClass[] = ["DIAGNOSTIC"];
  if (tradingAllowed) classes.push("NORMAL");
  for (const decision of Object.values(actions)) {
    if (decision.decision === "allow") classes.push(actionClassFromDecision(decision));
  }
  return uniqueActionClasses(classes);
}

export function buildCoreTrustReport(input: CoreTrustReportInput): CoreTrustReport {
  const actions = input.permissions.actions;
  const placeOrderDecision = actions.place_order;
  const provenance = input.provenance ?? buildProvenanceHealthReport({ status: "missing" });
  const marketInput = input.marketInput ?? buildMarketInputIntegrityReport({ status: "unknown" });
  const integrity = input.integrity ?? buildIntegrityReport({
    snapshot: input.snapshot,
    lastEvent: input.lastEvent,
    lastTransition: input.lastTransition,
    provenance,
    marketInput
  });
  const causality = input.causality ?? buildCausalityReport({
    lastEvent: input.lastEvent,
    lastTransition: input.lastTransition,
    gateVerdict: placeOrderDecision
  });
  const authority = evaluateKernelTrust({
    snapshot: input.snapshot,
    freshness: input.freshness,
    healthTruth: input.healthTruth,
    replay: typeof input.replay.ok === "boolean" ? input.replay as any : undefined,
    invariants: input.invariants,
    actionGate: {
      placeOrder: placeOrderDecision,
      actions
    },
    integrity,
    causality,
    provenance,
    marketInput
  });

  const blockingReasons = authority.blockers.map(toBlockingReason);
  const tradingAllowed = authority.trustState === KERNEL_TRUST_STATE.TRUSTED && placeOrderDecision?.decision === "allow";
  const recoveryHints = unique(authority.recoveryHints);
  const decisions = Object.values(actions);
  const allowedActions = decisions.filter((decision) => decision.decision === "allow");
  const deniedActions = decisions.filter((decision) => decision.decision === "deny");

  return {
    revision: input.snapshot.revision,
    trustState: authority.trustState,
    runtimeMode: runtimeMode(input.snapshot, input.healthTruth, authority.trustState),
    tradingAllowed,
    allowedActionClasses: allowedClasses(actions, tradingAllowed),
    blockingReasons,
    nextRecoveryActions: recoveryHints.length ? recoveryHints : ["continue_monitoring"],
    recoveryHints: recoveryHints.length ? recoveryHints : ["continue_monitoring"],
    recoveryActions: recoveryHints.length ? recoveryHints : ["continue_monitoring"],
    bootstrap: input.snapshot.bootstrap,
    exchangeTruth: input.snapshot.exchangeTruth,
    freshness: input.freshness,
    healthTruth: input.healthTruth,
    replay: typeof input.replay.ok === "boolean" ? input.replay as any : undefined,
    invariants: input.invariants,
    actionVerdicts: actions,
    actions,
    allowedActions,
    deniedActions,
    kernelAuthority: authority,
    integrity,
    causality,
    provenanceStatus: provenance.status,
    provenanceBlockingReasons: provenance.blockingReasons,
    provenance,
    marketInputStatus: marketInput.status,
    marketInputBlockingReasons: marketInput.blockingReasons,
    marketInput,
    metadata: input.metadata,
    lastEvent: input.lastEvent,
    lastTransition: input.lastTransition
  };
}
