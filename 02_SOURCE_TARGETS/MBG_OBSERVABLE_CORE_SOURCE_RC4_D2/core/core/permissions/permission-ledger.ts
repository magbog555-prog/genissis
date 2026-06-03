import crypto from "node:crypto";
import type {
  ActionClass,
  ActionType,
  GateDecision,
  KernelTrustState
} from "../contracts/src/actions.js";

export interface PermissionRecord {
  permissionId: string;
  action: GateDecision["action"];
  allowed: boolean;
  decision: GateDecision["decision"];
  actionClass: ActionClass;
  snapshotRevision: number;
  kernelTrustState: KernelTrustState;
  blockingReasons: string[];
  allowedAlternatives: ActionType[];
  gateVersion: GateDecision["gateVersion"];
  requestedBy: string;
  decidedAt: string;
  decisionHash: string;
}

export interface PermissionLedgerRecordOptions {
  requestedBy?: string;
  decidedAt?: string | Date;
  permissionId?: string;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stable(nested)])
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

export function hashPermissionDecision(input: Omit<PermissionRecord, "permissionId" | "decisionHash">): string {
  return crypto
    .createHash("sha256")
    .update(stableJson(input))
    .digest("hex");
}

export function createPermissionRecord(
  verdict: GateDecision,
  options: PermissionLedgerRecordOptions = {}
): PermissionRecord {
  const decidedAt =
    options.decidedAt instanceof Date
      ? options.decidedAt.toISOString()
      : options.decidedAt ?? new Date().toISOString();

  const base = {
    action: verdict.action,
    allowed: verdict.allowed,
    decision: verdict.decision,
    actionClass: verdict.actionClass,
    snapshotRevision: verdict.snapshotRevision,
    kernelTrustState: verdict.kernelTrustState,
    blockingReasons: [...verdict.blockingReasons],
    allowedAlternatives: [...verdict.allowedAlternatives],
    gateVersion: verdict.gateVersion,
    requestedBy: options.requestedBy ?? "unknown",
    decidedAt
  };

  const decisionHash = hashPermissionDecision(base);
  const permissionId = options.permissionId ?? `permission:${decisionHash.slice(0, 16)}`;

  return {
    permissionId,
    ...base,
    decisionHash
  };
}

export class PermissionLedger {
  private records: PermissionRecord[] = [];

  record(verdict: GateDecision, options: PermissionLedgerRecordOptions = {}): PermissionRecord {
    const record = createPermissionRecord(verdict, options);
    this.records.push(record);
    return record;
  }

  last(limit = 100): PermissionRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 100;
    return this.records.slice(-safeLimit).map((record) => ({
      ...record,
      action: {
        ...record.action,
        request: { ...record.action.request }
      },
      blockingReasons: [...record.blockingReasons],
      allowedAlternatives: [...record.allowedAlternatives]
    }));
  }

  all(): PermissionRecord[] {
    return this.last(this.records.length);
  }

  clear(): void {
    this.records = [];
  }

  count(): number {
    return this.records.length;
  }
}
