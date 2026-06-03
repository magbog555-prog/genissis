export type TrustState = "TRUSTED" | "UNCERTAIN" | "UNTRUSTED" | "BLOCKED";

export type Verdict = "allowed" | "prohibited" | "observe_only";

export type RuntimeMode = "OBSERVE_ONLY" | "MOCK" | "RUNTIME_READONLY" | "UNKNOWN";

export interface RuntimeSnapshot {
  meta: {
    schemaVersion: "runtime-snapshot/v1";
    source: "mock" | "scenario" | "core-readonly" | "runtime";
    scenarioId: string | null;
    generatedAt: string;
    deterministic: boolean;
    readOnly: boolean;
  };

  machine: {
    status: string;
    mode: RuntimeMode;
    phase: string;
  };

  trust: {
    state: TrustState;
    score: number | null;
    reasons: string[];
  };

  verdict: {
    result: Verdict;
    action: string | null;
    reason: string;
    blockedBy: string[];
  };

  kernelAuthority: RuntimeAuthoritySummary;

  actionGate: RuntimeAuthoritySummary;

  panels: {
    rules: RuntimeRule[];
    pipeline: RuntimePipelineStep[];
    decisionTrace: RuntimeDecisionStep[];
    quarantine: RuntimePanelStatus;
    recovery: RuntimePanelStatus;
    marketIntegrity: RuntimePanelStatus;
    provenance: RuntimePanelStatus;
    revisionTimeline: RuntimeRevisionItem[];
  };

  raw?: unknown;

  rawSummary?: {
    present: boolean;
    omittedForUiSafety: boolean;
    reason: string;
  };

  semantic?: RuntimeSemanticSummary;
}

export interface RuntimeSemanticSummary {
  exchangeTruth: {
    present: boolean;
    status: "present" | "absent" | "stale" | "unknown" | "pending" | "unverified";
    proof: "valid" | "missing" | "invalid" | "unverified";
  };
  adapter: {
    adapterMode: "api" | "mock" | "runtime" | "unknown";
    sourceMode: "live" | "simulated" | "local-dto" | "runtime-readonly" | "unknown";
    providerFormat: string;
    liveExchangeConnected: boolean;
  };
  provenance: {
    localProvenanceValid: boolean;
    exchangeProofValid: boolean;
    exchangeTruthStatus: string;
    payloadHash: string | null;
    hashType: "demo" | "cryptographic" | "unknown";
    hashStrength: "non_cryptographic_demo" | "sha256" | "unknown";
  };
  marketFreshness: {
    status: "fresh" | "stale" | "unknown";
    ageMs: number | null;
    thresholdMs: number | null;
    note: string;
  };
  recovery: {
    systemRecoveryRequired: boolean;
    trustRecoverySuggested: boolean;
    trustRecoveryReason: string;
    autoRecoveryEnabled: boolean;
    mode: "OBSERVE_ONLY" | "UNKNOWN";
    hints: string[];
  };
  counters: {
    eventCounter: number | null;
    snapshotRevision: number | null;
    ledgerCounter: number | null;
    ledgerRevision: number | null;
    currentDecisionId: string | null;
  };
  snapshotDiff: {
    blockingReasonsBefore: string[];
    blockingReasonsAfter: string[];
  };
  failureMatrix: {
    renderGuardTriggered: boolean;
    renderFallbackActive: boolean;
    adapterMode: string;
    dataMode: string;
    finalSafetyState: string;
    executionSurface: "closed" | "unknown";
  };
}

export interface RuntimeAuthoritySummary {
  passed: number;
  total: number;
  failed: number;
  status: "pass" | "fail" | "partial" | "unknown";
}

export interface RuntimeRule {
  id: string;
  label: string;
  condition: string;
  fact: string;
  effect: string;
  severity: "info" | "warning" | "block" | "critical" | "unknown";
  passed: boolean | null;
}

export interface RuntimePipelineStep {
  id: string;
  label: string;
  status: "passed" | "failed" | "blocked" | "pending" | "unknown";
  message: string;
}

export interface RuntimeDecisionStep {
  id: string;
  label: string;
  status: "passed" | "failed" | "blocked" | "pending" | "unknown";
  message: string;
}

export interface RuntimePanelStatus {
  status: "ok" | "warning" | "blocked" | "pending" | "unknown";
  message: string;
  data?: unknown;
}

export interface RuntimeRevisionItem {
  id: string;
  label: string;
  status: string;
  timestamp: string | null;
}

