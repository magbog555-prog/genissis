import { z } from "zod";
import type { IntegrityStatus, MarketInputBlockingReason, MarketInputStatus, ProvenanceBlockingReason, ProvenanceStatus } from "../../integrity/integrity-report.js";

export const ACTION_TYPE = {
  PLACE_ORDER: "place_order",
  CANCEL_ORDER: "cancel_order",
  RECONCILE_ORDER: "reconcile_order",
  RECONCILE_POSITION: "reconcile_position",
  PAUSE_RUNTIME: "pause_runtime",
  RESUME_RUNTIME: "resume_runtime"
} as const;

export type ActionType = typeof ACTION_TYPE[keyof typeof ACTION_TYPE];

export type ActionClass = "NORMAL" | "RISK_REDUCING" | "RECOVERY" | "DIAGNOSTIC" | "ADMIN";
export type GateSeverity = "info" | "warning" | "critical";
export type KernelTrustState = "TRUSTED" | "RECOVERABLE" | "UNCERTAIN" | "COMPROMISED" | "HALTED" | "PANIC";

export const ActionRequestSchema = z.object({
  type: z.enum([
    ACTION_TYPE.PLACE_ORDER,
    ACTION_TYPE.CANCEL_ORDER,
    ACTION_TYPE.RECONCILE_ORDER,
    ACTION_TYPE.RECONCILE_POSITION,
    ACTION_TYPE.PAUSE_RUNTIME,
    ACTION_TYPE.RESUME_RUNTIME
  ]),
  symbol: z.string().optional(),
  side: z.enum(["buy", "sell"]).optional(),
  quantity: z.number().positive().optional(),
  price: z.number().positive().optional()
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export interface ActionGateVerdict {
  action: {
    actionId: string;
    actionType: ActionType;
    request: ActionRequest;
  };
  allowed: boolean;
  actionClass: ActionClass;
  severity: GateSeverity;
  snapshotRevision: number;
  kernelTrustState: KernelTrustState;
  blockingReasons: string[];
  allowedAlternatives: ActionType[];
  relatedInvariants: string[];
  gateVersion: "action-gate-v2";
  integrityStatus?: IntegrityStatus;
  traceId?: string;
  provenanceStatus?: ProvenanceStatus;
  provenanceBlockingReasons?: ProvenanceBlockingReason[];
  provenanceTraceId?: string;
  marketInputStatus?: MarketInputStatus;
  marketInputBlockingReasons?: MarketInputBlockingReason[];
  marketInputEventId?: string;
}

export interface GateDecision extends ActionGateVerdict {
  actionId: string;
  actionType: ActionType;
  decision: "allow" | "deny";
  reason?: string;
  blockingStates?: string[];
}
