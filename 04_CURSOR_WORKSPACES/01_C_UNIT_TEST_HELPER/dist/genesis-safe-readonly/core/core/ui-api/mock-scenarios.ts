import type { ComputationTraceDTO, MarketInputIntegrityDTO } from "../contracts/ui/index.js";
import { UI_DTO_VERSION, validateComputationTraceDTO } from "../contracts/ui/index.js";

export const MOCK_CORE_SCENARIO_ID = {
  HEALTHY_TRUSTED_READY: "HEALTHY_TRUSTED_READY",
  EXCHANGE_TRUTH_UNKNOWN_DENY: "EXCHANGE_TRUTH_UNKNOWN_DENY",
  MARKET_INPUT_UNKNOWN_DENY: "MARKET_INPUT_UNKNOWN_DENY",
  MARKET_INPUT_STALE_DENY: "MARKET_INPUT_STALE_DENY",
  MARKET_INPUT_GAP_DENY: "MARKET_INPUT_GAP_DENY",
  DUPLICATE_EVENT_IDEMPOTENT: "DUPLICATE_EVENT_IDEMPOTENT",
  INVALID_EVENT_QUARANTINE: "INVALID_EVENT_QUARANTINE",
  MISSING_PROVENANCE_DENY: "MISSING_PROVENANCE_DENY",
  PROVENANCE_MISMATCH_COMPROMISE: "PROVENANCE_MISMATCH_COMPROMISE",
  SNAPSHOT_HASH_MISMATCH: "SNAPSHOT_HASH_MISMATCH",
  REPLAY_MISMATCH_BLOCK: "REPLAY_MISMATCH_BLOCK",
  RECOVERY_ONLY_MODE: "RECOVERY_ONLY_MODE",
  CANCEL_REDUCE_ONLY_ALLOWED: "CANCEL_REDUCE_ONLY_ALLOWED",
  VALID_OBSERVATION_NO_PERMISSION: "VALID_OBSERVATION_NO_PERMISSION",
  FULL_READY_GATE_DECIDES: "FULL_READY_GATE_DECIDES"
} as const;

export type MockCoreScenarioId = typeof MOCK_CORE_SCENARIO_ID[keyof typeof MOCK_CORE_SCENARIO_ID];

export const MOCK_CORE_SCENARIO_IDS: MockCoreScenarioId[] = Object.values(MOCK_CORE_SCENARIO_ID);

const BASE_TIME = "2026-01-01T00:00:00.000Z";

interface ScenarioShape {
  trustState: ComputationTraceDTO["pulse"]["trustState"];
  tradingAllowed: boolean;
  blocked: boolean;
  blockingReasons: string[];
  marketInputStatus?: MarketInputIntegrityDTO["status"];
  quarantine?: boolean;
  ledgerDecision?: "allow" | "deny";
  recoveryAction?: string;
  summary: string;
}

const scenarioShape: Record<MockCoreScenarioId, ScenarioShape> = {
  HEALTHY_TRUSTED_READY: {
    trustState: "TRUSTED",
    tradingAllowed: true,
    blocked: false,
    blockingReasons: [],
    marketInputStatus: "valid",
    ledgerDecision: "allow",
    summary: "Core is trusted and ready; UI may display readiness but still must not decide trust."
  },
  EXCHANGE_TRUTH_UNKNOWN_DENY: {
    trustState: "UNCERTAIN",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["exchange_truth_unknown"],
    marketInputStatus: "valid",
    ledgerDecision: "deny",
    recoveryAction: "RECONCILE_POSITION",
    summary: "Exchange truth is unknown; normal actions are denied."
  },
  MARKET_INPUT_UNKNOWN_DENY: {
    trustState: "UNCERTAIN",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["MARKET_INPUT_UNKNOWN"],
    marketInputStatus: "unknown",
    ledgerDecision: "deny",
    recoveryAction: "WAIT_FOR_FRESH_MARKET_INPUT",
    summary: "Market input status is unknown; UI observes a denial."
  },
  MARKET_INPUT_STALE_DENY: {
    trustState: "RECOVERABLE",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["MARKET_INPUT_STALE"],
    marketInputStatus: "stale",
    ledgerDecision: "deny",
    recoveryAction: "RESYNC_MARKET_INPUT",
    summary: "Market input is stale and must be refreshed."
  },
  MARKET_INPUT_GAP_DENY: {
    trustState: "RECOVERABLE",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["MARKET_INPUT_GAP"],
    marketInputStatus: "gap_detected",
    ledgerDecision: "deny",
    recoveryAction: "RUN_MARKET_REPLAY_CHECK",
    summary: "Market input sequence gap blocks unsafe action."
  },
  DUPLICATE_EVENT_IDEMPOTENT: {
    trustState: "RECOVERABLE",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["DUPLICATE_EVENT"],
    marketInputStatus: "duplicate",
    ledgerDecision: "deny",
    summary: "Duplicate event is idempotent and does not bump revision."
  },
  INVALID_EVENT_QUARANTINE: {
    trustState: "RECOVERABLE",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["INVALID_EVENT_QUARANTINED"],
    marketInputStatus: "invalid",
    quarantine: true,
    ledgerDecision: "deny",
    recoveryAction: "INSPECT_QUARANTINE",
    summary: "Invalid event is quarantined outside trusted journal."
  },
  MISSING_PROVENANCE_DENY: {
    trustState: "UNCERTAIN",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["PROVENANCE_MISSING"],
    marketInputStatus: "unverifiable",
    ledgerDecision: "deny",
    recoveryAction: "ATTACH_PROVENANCE",
    summary: "Action or observation is missing provenance."
  },
  PROVENANCE_MISMATCH_COMPROMISE: {
    trustState: "COMPROMISED",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["PROVENANCE_REPLAY_MISMATCH"],
    marketInputStatus: "unverifiable",
    ledgerDecision: "deny",
    recoveryAction: "MANUAL_REVIEW",
    summary: "Provenance mismatch compromises trust."
  },
  SNAPSHOT_HASH_MISMATCH: {
    trustState: "COMPROMISED",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["SNAPSHOT_HASH_MISMATCH"],
    marketInputStatus: "valid",
    ledgerDecision: "deny",
    recoveryAction: "RUN_REPLAY_CHECK",
    summary: "Snapshot hash mismatch is a corruption signal."
  },
  REPLAY_MISMATCH_BLOCK: {
    trustState: "COMPROMISED",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["REPLAY_MISMATCH"],
    marketInputStatus: "valid",
    ledgerDecision: "deny",
    recoveryAction: "RUN_REPLAY_CHECK",
    summary: "Replay mismatch blocks unsafe actions."
  },
  RECOVERY_ONLY_MODE: {
    trustState: "RECOVERABLE",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["RECOVERY_ONLY_MODE"],
    marketInputStatus: "valid",
    ledgerDecision: "deny",
    recoveryAction: "MANUAL_REVIEW",
    summary: "Core is in recovery-only mode."
  },
  CANCEL_REDUCE_ONLY_ALLOWED: {
    trustState: "RECOVERABLE",
    tradingAllowed: false,
    blocked: false,
    blockingReasons: [],
    marketInputStatus: "valid",
    ledgerDecision: "allow",
    recoveryAction: "RECONCILE_ORDERS",
    summary: "Risk-reducing cancel path is allowed while normal trading is denied."
  },
  VALID_OBSERVATION_NO_PERMISSION: {
    trustState: "RECOVERABLE",
    tradingAllowed: false,
    blocked: true,
    blockingReasons: ["ACTION_GATE_DENY"],
    marketInputStatus: "valid",
    ledgerDecision: "deny",
    summary: "A valid observation does not grant trading permission by itself."
  },
  FULL_READY_GATE_DECIDES: {
    trustState: "TRUSTED",
    tradingAllowed: true,
    blocked: false,
    blockingReasons: [],
    marketInputStatus: "valid",
    ledgerDecision: "allow",
    summary: "All core proofs are ready; ActionGate still decides the action."
  }
};

function marketInputIntegrityFor(id: MockCoreScenarioId, shape: ScenarioShape): MarketInputIntegrityDTO {
  return {
    status: shape.marketInputStatus ?? "unknown",
    observationId: `observation-${id}`,
    eventId: `event-${id}`,
    symbol: "BTCUSDT",
    channel: "ticker",
    sourceName: "mock-market-source",
    sequence: 42,
    payloadHash: `payload-hash-${id}`,
    provenanceId: shape.marketInputStatus === "unverifiable" ? undefined : `provenance-${id}`,
    exchangeTruthPresent: true,
    exchangeTruthStatus: "unknown",
    exchangeTruthProof: "missing",
    blockingReasons: shape.blockingReasons.filter((reason) => reason.startsWith("MARKET_INPUT") || reason.startsWith("PROVENANCE")),
    checkedAtFromEvent: BASE_TIME
  };
}

export function buildMockComputationTraceDTO(id: MockCoreScenarioId): ComputationTraceDTO {
  const shape = scenarioShape[id];
  const afterRevision = id === "DUPLICATE_EVENT_IDEMPOTENT" ? 12 : 13;
  const beforeRevision = id === "DUPLICATE_EVENT_IDEMPOTENT" ? 12 : 12;
  const allowed = shape.ledgerDecision === "allow";

  const dto: ComputationTraceDTO = {
    dtoVersion: UI_DTO_VERSION,
    traceId: `trace-${id}`,
    scenarioId: id,
    title: id.replaceAll("_", " ").toLowerCase(),
    description: shape.summary,
    createdAtFromEvent: BASE_TIME,
    pulse: {
      dtoVersion: UI_DTO_VERSION,
      pulseId: `pulse-${id}`,
      scenarioId: id,
      emittedAtFromEvent: BASE_TIME,
      snapshotRevision: afterRevision,
      snapshotHash: `snapshot-hash-${id}`,
      trustState: shape.trustState,
      runtimeMode: shape.trustState === "TRUSTED" ? "normal" : "readonly",
      tradingAllowed: shape.tradingAllowed,
      summary: shape.summary,
      blocked: shape.blocked,
      blockingReasons: shape.blockingReasons
    },
    pipeline: [
      {
        stepId: "event-validation",
        label: "Event validation",
        status: shape.quarantine ? "failed" : "passed",
        inputRefs: [`event-${id}`],
        outputRefs: shape.quarantine ? [`quarantine-${id}`] : [`validated-event-${id}`],
        completedAtFromEvent: BASE_TIME,
        rules: [
          {
            ruleId: "provenance-required",
            label: "Provenance required",
            passed: !shape.blockingReasons.includes("PROVENANCE_MISSING"),
            severity: shape.blockingReasons.includes("PROVENANCE_MISSING") ? "blocking" : "info",
            reasonCode: shape.blockingReasons.includes("PROVENANCE_MISSING") ? "PROVENANCE_MISSING" : undefined,
            evidence: { scenarioId: id }
          }
        ],
        formulas: [
          {
            formulaId: "trust-read-only",
            label: "UI observes core trust",
            expression: "trustState = coreTrustReport.trustState",
            inputs: { trustState: shape.trustState },
            result: shape.trustState,
            deterministic: true
          }
        ]
      },
      {
        stepId: "action-gate",
        label: "ActionGate verdict",
        status: allowed ? "passed" : "blocked",
        inputRefs: [`trust-report-${id}`],
        outputRefs: [`gate-verdict-${id}`],
        completedAtFromEvent: BASE_TIME,
        rules: [
          {
            ruleId: "core-decides",
            label: "Core decides; UI observes",
            passed: true,
            severity: "info",
            evidence: { noFrontendCalculations: true }
          }
        ],
        formulas: []
      }
    ],
    snapshotDiff: {
      beforeRevision,
      afterRevision,
      beforeHash: `before-hash-${id}`,
      afterHash: `after-hash-${id}`,
      changedPaths: beforeRevision === afterRevision ? [] : ["marketInput.status", "system.meta"],
      addedPaths: [],
      removedPaths: []
    },
    gateVerdict: {
      actionId: `action-${id}`,
      actionType: id === "CANCEL_REDUCE_ONLY_ALLOWED" ? "cancel_order" : "place_order",
      allowed,
      actionClass: id === "CANCEL_REDUCE_ONLY_ALLOWED" ? "RISK_REDUCING" : "NORMAL",
      kernelTrustState: shape.trustState,
      severity: allowed ? "info" : "critical",
      blockingReasons: shape.blockingReasons,
      allowedAlternatives: allowed ? [] : ["reconcile_position"],
      gateVersion: "action-gate-v2"
    },
    ledgerRecords: [
      {
        recordId: `ledger-${id}`,
        decision: shape.ledgerDecision ?? "deny",
        actionType: id === "CANCEL_REDUCE_ONLY_ALLOWED" ? "cancel_order" : "place_order",
        reasonCodes: shape.blockingReasons,
        recordedAtFromEvent: BASE_TIME,
        sourceEventId: `event-${id}`
      }
    ],
    quarantineRecords: shape.quarantine
      ? [
          {
            quarantineId: `quarantine-${id}`,
            reason: "invalid_event",
            source: "schema_violation",
            eventId: `event-${id}`,
            eventType: "market.input.rejected",
            payloadHash: `payload-hash-${id}`,
            severity: "blocking",
            detectedAtFromEvent: BASE_TIME,
            recoverable: true
          }
        ]
      : [],
    recoveryHints: shape.recoveryAction
      ? [
          {
            hintId: `recovery-${id}`,
            actionType: shape.recoveryAction,
            reason: shape.summary,
            priority: shape.trustState === "COMPROMISED" ? "critical" : "medium",
            manualReviewRequired: shape.recoveryAction === "MANUAL_REVIEW",
            mode: "OBSERVE_ONLY",
            systemRecoveryRequired: false,
            trustRecoverySuggested: true,
            trustRecoveryReason: "exchange_truth_unknown",
            autoRecoveryEnabled: false,
            hints: ["reconcile_exchange_truth", "check_market_data_source"]
          }
        ]
      : [],
    failureVisualization: {
      dto: "FailureMatrixDTO",
      scenario: id,
      renderGuardTriggered: false,
      renderFallbackActive: false,
      adapterMode: "mock",
      dataMode: "simulated",
      finalSafetyState: allowed ? "allowed" : "prohibited",
      executionSurface: "closed",
      severity: allowed ? "info" : "warning",
      blocks: [
        { block: "market", state: shape.marketInputStatus ?? "unknown" },
        {
          block: "provenance",
          state: !shape.blockingReasons.includes("PROVENANCE_REPLAY_MISMATCH") && !shape.blockingReasons.includes("PROVENANCE_MISSING")
            ? "valid"
            : "invalid"
        },
        { block: "replay", state: shape.blockingReasons.includes("PROVENANCE_REPLAY_MISMATCH") ? "mismatch" : "matched" },
        { block: "gate", state: allowed ? "allow" : "deny" }
      ]
    },
    marketInputIntegrity: marketInputIntegrityFor(id, shape),
    provenance: [
      {
        provenanceId: `provenance-${id}`,
        originType: "observation",
        originEventId: `event-${id}`,
        targetId: `observation-${id}`,
        parentProvenanceIds: [],
        source: "mock-scenario",
        adapterMode: "mock",
        sourceMode: "simulated",
        providerFormat: "binance-like",
        liveExchangeConnected: false,
        localProvenanceValid: !shape.blockingReasons.includes("PROVENANCE_REPLAY_MISMATCH") && !shape.blockingReasons.includes("PROVENANCE_MISSING"),
        exchangeProofValid: false,
        exchangeTruthStatus: "unknown",
        confidence: shape.blockingReasons.includes("PROVENANCE_REPLAY_MISMATCH") ? 0.25 : 1,
        createdAtFromEvent: BASE_TIME,
        hash: `payload-hash-${id}`,
        payloadHash: `payload-hash-${id}`,
        hashType: "demo",
        hashStrength: "non_cryptographic_demo"
      }
    ],
    causality: {
      eventId: `event-${id}`,
      transitionId: `transition-${id}`,
      previousSnapshotHash: `before-hash-${id}`,
      eventHash: `event-hash-${id}`,
      transitionHash: `transition-hash-${id}`,
      snapshotHash: `after-hash-${id}`
    },
    notes: [
      "Mock-first DTO payload.",
      "No UI layout, theme, websocket, V1, execution or trading authority is encoded here."
    ]
  };

  return validateComputationTraceDTO(dto);
}

export const MOCK_COMPUTATION_TRACE_DTOS: ComputationTraceDTO[] = MOCK_CORE_SCENARIO_IDS.map((id) =>
  buildMockComputationTraceDTO(id)
);

export function buildAdapterSafeCoreUiResponse(id: MockCoreScenarioId) {
  const trace = buildMockComputationTraceDTO(id);
  return {
    dtoVersion: UI_DTO_VERSION,
    scenarioId: id,
    trace,
    machinePulse: trace.pulse
  };
}
