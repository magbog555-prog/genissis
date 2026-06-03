export const KERNEL_TRUST_STATE = {
  TRUSTED: "TRUSTED",
  RECOVERABLE: "RECOVERABLE",
  UNCERTAIN: "UNCERTAIN",
  COMPROMISED: "COMPROMISED",
  HALTED: "HALTED",
  PANIC: "PANIC"
} as const;

export type KernelTrustState = typeof KERNEL_TRUST_STATE[keyof typeof KERNEL_TRUST_STATE];

export const KERNEL_AUTHORITY_EXCLUSION = {
  FRONTEND: "frontend",
  UI_STATE: "ui_state",
  V1: "v1",
  STRATEGY: "strategy",
  SIGNAL_LAYER: "signal_layer",
  DECISION_ENGINE: "decision_engine",
  LOCAL_MEMORY_OVER_EXCHANGE_TRUTH: "local_memory_over_exchange_truth"
} as const;

export type KernelAuthorityExclusion =
  typeof KERNEL_AUTHORITY_EXCLUSION[keyof typeof KERNEL_AUTHORITY_EXCLUSION];

export const CORE_LAW_ID = {
  NO_EVENT_NO_STATE_CHANGE: "LAW-001",
  NO_TRUSTED_STATE_NO_TRADING_ACTION: "LAW-002",
  UNKNOWN_OVER_FAKE_CONFIDENCE: "LAW-003",
  POSITION_UNKNOWN_BLOCKS_RISK: "LAW-004",
  ORDER_UNCERTAIN_BLOCKS_RISK: "LAW-005",
  BOOTSTRAP_NOT_RECONCILED_FORBIDS_TRADING: "LAW-006",
  EXCHANGE_TRUTH_NOT_FRESH_FORBIDS_TRADING: "LAW-007",
  REPLAY_MISMATCH_BREAKS_TRUST: "LAW-008",
  INVALID_EVENT_NOT_JOURNALED: "LAW-009",
  DUPLICATE_EVENT_NO_STATE_CHANGE: "LAW-010",
  NO_FILL_NO_PNL: "LAW-011",
  LIVE_ORDER_WITHOUT_METADATA_FORBIDDEN: "LAW-012",
  EXCHANGE_TRUTH_OVER_LOCAL_MEMORY: "LAW-013",
  FRONTEND_NOT_AUTHORITY: "LAW-014",
  V1_NOT_AUTHORITY: "LAW-015",
  BOOTSTRAP_FSM_GOVERNS_TRADING_READINESS: "LAW-016",
  EVENT_VALIDATION_IS_CORE_RESPONSIBILITY: "LAW-017",
  IDEMPOTENCY_INDEX_RECOVERABLE_FROM_JOURNAL: "LAW-018",
  REDUCERS_REMAIN_PURE: "LAW-019",
  DUPLICATE_EVENT_CANNOT_MUTATE_STATE: "LAW-020",
  INVALID_EVENT_NEVER_ENTERS_CANONICAL_JOURNAL: "LAW-021",
  BOOTSTRAP_FAILED_REQUIRES_RECOVERY_EVENT: "LAW-022",
  EXCHANGE_TRUTH_UNKNOWN_FORBIDS_NORMAL_TRADING: "LAW-023",
  EXCHANGE_TRUTH_STALE_FORBIDS_NORMAL_TRADING: "LAW-024",
  EXCHANGE_TRUTH_CONFLICTED_FORBIDS_NORMAL_TRADING: "LAW-025",
  MARKET_DATA_STALE_FORBIDS_NORMAL_TRADING: "LAW-026",
  HEALTH_MUST_NOT_REPORT_FAKE_TRUTH: "LAW-027",
  UNKNOWN_CONNECTION_STATE_IS_NOT_CONNECTED: "LAW-028",
  LOCAL_FLAT_POSITION_REQUIRES_FRESH_EXCHANGE_RECONCILE: "LAW-029",
  FRESHNESS_UNKNOWN_IS_STALE_FOR_NORMAL_TRADING: "LAW-030",
  KERNEL_AUTHORITY_CANONICAL_TRUST_EVALUATOR: "LAW-031",
  KERNEL_AUTHORITY_MUST_BE_PURE: "LAW-032",
  CORE_TRUST_REPORT_CANONICAL_TRUST_OUTPUT: "LAW-033",
  FRONTEND_MUST_NOT_CALCULATE_TRUST: "LAW-034",
  V1_MUST_NOT_CALCULATE_CORE_TRUST: "LAW-035",
  DENIED_ACTION_REQUIRES_MACHINE_READABLE_REASONS: "LAW-036",
  TRUST_STATE_MUST_BE_EXPLAINABLE: "LAW-037",
  ACTION_GATE_MUST_USE_KERNEL_TRUST_STATE: "LAW-038",
  INVALID_OR_SUSPICIOUS_DATA_NOT_CANONICAL: "LAW-039",
  QUARANTINED_DATA_NO_STATE_MUTATION: "LAW-040",
  QUARANTINE_DIAGNOSTIC_NOT_CANONICAL_HISTORY: "LAW-041",
  ACTION_GATE_VERDICT_MUST_BE_AUDITABLE: "LAW-042",
  PERMISSION_LEDGER_RECORDS_ALLOW_AND_DENY: "LAW-043",
  RECOVERY_PLANNER_SUGGESTS_DOES_NOT_EXECUTE: "LAW-044",
  RECOVERY_ACTIONS_STILL_PASS_ACTION_GATE: "LAW-045",
  NORMAL_TRADING_FORBIDDEN_UNTIL_RECOVERY_SATISFIED: "LAW-046",
  PERMISSION_LEDGER_NO_TRADING_STATE_MUTATION: "LAW-047",
  QUARANTINE_PRESERVES_REJECTED_EVIDENCE: "LAW-048",
  COMMITTED_EVENT_STABLE_EVENT_HASH: "LAW-049",
  PRODUCED_SNAPSHOT_DETERMINISTIC_HASH: "LAW-050",
  TRANSITION_LINKS_BEFORE_EVENT_AFTER: "LAW-051",
  SNAPSHOT_REVISION_MATCHES_APPLIED_EVENT_REVISION: "LAW-052",
  HASH_CHAIN_DISCONTINUITY_CORRUPTION_SIGNAL: "LAW-053",
  CAUSALITY_TRACE_EXPLAINS_STATE_TRANSITION: "LAW-054",
  TRUST_STATE_CHANGES_CAUSALLY_EXPLAINABLE: "LAW-055",
  ACTION_GATE_REFERENCES_REVISION_AND_CAUSALITY: "LAW-056",
  REPLAY_HASH_MISMATCH_COMPROMISED_OR_PANIC: "LAW-057",
  UNKNOWN_HASH_NOT_CORRUPTION_PROVEN_MISMATCH_IS: "LAW-058",
  EXPLICIT_PROVENANCE_PRINCIPLE: "LAW-059",
  REPLAY_IS_SACRED: "LAW-060",
  OBSERVABLE_FIRST: "LAW-061",
  METADATA_AS_EVENTS: "LAW-062",
  METADATA_IS_PROVENANCE_EVIDENCE: "LAW-063",
  MISSING_PROVENANCE_BLOCKS_RISK: "LAW-064",
  UNKNOWN_PROVENANCE_NOT_CORRUPTION: "LAW-065"
} as const;

export type CoreLawId = typeof CORE_LAW_ID[keyof typeof CORE_LAW_ID];

export type CoreLawSeverity = "blocking" | "panic";

export interface CoreLawDefinition {
  id: CoreLawId;
  title: string;
  statement: string;
  severity: CoreLawSeverity;
  currentModules: readonly string[];
  futureModules: readonly string[];
  testModules: readonly string[];
}

const SCENARIO_TESTS = ["tests/scenarios/*"] as const;

export const CORE_LAWS: readonly CoreLawDefinition[] = [
  {
    id: CORE_LAW_ID.NO_EVENT_NO_STATE_CHANGE,
    title: "No event, no state change",
    statement: "State changes only as a consequence of an accepted event applied through a reducer.",
    severity: "panic",
    currentModules: [
      "core/contracts/src/events.ts",
      "core/transitions/src/reducers.ts",
      "core/state/src/types.ts",
      "core/invariants/engine.invariants.ts"
    ],
    futureModules: ["core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.NO_TRUSTED_STATE_NO_TRADING_ACTION,
    title: "No trusted state, no trading action",
    statement: "A trading action is forbidden unless the kernel can prove the current state is trusted.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts", "core/contracts/src/actions.ts"],
    futureModules: ["core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.UNKNOWN_OVER_FAKE_CONFIDENCE,
    title: "Unknown is safer than fake confidence",
    statement: "When the kernel cannot prove a fact, it must report unknown, uncertain, or an equivalent blocked state.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts"],
    futureModules: ["core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.POSITION_UNKNOWN_BLOCKS_RISK,
    title: "Position unknown blocks risk",
    statement: "If position is unknown, risk is blocked.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.ORDER_UNCERTAIN_BLOCKS_RISK,
    title: "Order uncertain blocks risk",
    statement: "If order state is uncertain, risk is blocked.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.BOOTSTRAP_NOT_RECONCILED_FORBIDS_TRADING,
    title: "Bootstrap not reconciled forbids trading",
    statement: "During bootstrap, trading is forbidden until required recovery, replay, journal, snapshot, exchange truth, and freshness checks pass.",
    severity: "blocking",
    currentModules: [
      "core/state/src/types.ts",
      "core/transitions/src/reducers.ts",
      "core/gates/src/action-gate.ts"
    ],
    futureModules: ["core/bootstrap/bootstrap-fsm.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.EXCHANGE_TRUTH_NOT_FRESH_FORBIDS_TRADING,
    title: "Stale exchange truth forbids trading",
    statement: "Trading is forbidden when exchange truth is absent, stale, or not reconciled.",
    severity: "blocking",
    currentModules: ["application/exchange/*"],
    futureModules: ["core/exchange/exchange-truth.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.REPLAY_MISMATCH_BREAKS_TRUST,
    title: "Replay mismatch breaks trust",
    statement: "If replayed state does not match the expected snapshot/hash, trust is broken.",
    severity: "panic",
    currentModules: ["core/system/journal.ts", "core/system/state-hash.ts"],
    futureModules: ["core/replay/replay-check.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.INVALID_EVENT_NOT_JOURNALED,
    title: "Invalid event never enters journal",
    statement: "Invalid events are rejected before journal append and before reducer execution.",
    severity: "panic",
    currentModules: ["core/contracts/src/events.ts", "core/system/journal.ts"],
    futureModules: ["core/events/validate-domain-event.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.DUPLICATE_EVENT_NO_STATE_CHANGE,
    title: "Duplicate event does not change state",
    statement: "An event already applied by identity is idempotent; conflicting duplicate identity is an integrity failure.",
    severity: "panic",
    currentModules: ["core/contracts/src/events.ts", "core/system/journal.ts"],
    futureModules: ["core/runtime/event-index.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.NO_FILL_NO_PNL,
    title: "No fill, no PnL",
    statement: "PnL may only be derived from proven execution/fill data.",
    severity: "panic",
    currentModules: ["core/pnl/pnl-engine.ts", "core/contracts/src/events.ts"],
    futureModules: ["core/invariants/pnl.invariants.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.LIVE_ORDER_WITHOUT_METADATA_FORBIDDEN,
    title: "Live order without metadata is forbidden",
    statement: "A live order must carry required metadata for traceability and recovery.",
    severity: "blocking",
    currentModules: [
      "core/strategy/order-metadata-store.ts",
      "core/strategy/trade-metadata.ts",
      "engine/execution/execution.service.ts"
    ],
    futureModules: ["core/orders/order-metadata-contract.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.EXCHANGE_TRUTH_OVER_LOCAL_MEMORY,
    title: "Exchange truth outranks local memory",
    statement: "When exchange truth conflicts with local memory, the kernel must prefer exchange truth and block until reconciled.",
    severity: "panic",
    currentModules: ["application/exchange/*", "tests/scenarios/position-reconcile.ts"],
    futureModules: ["core/exchange/exchange-truth.ts", "core/kernel/reconcile-policy.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.FRONTEND_NOT_AUTHORITY,
    title: "Frontend is not authority",
    statement: "Frontend may display state and request actions; it may not certify trust, mutate snapshot, bypass gates, override replay, or override exchange truth.",
    severity: "blocking",
    currentModules: ["apps/runtime-api/*"],
    futureModules: ["core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.V1_NOT_AUTHORITY,
    title: "V1 is not authority",
    statement: "V1 may not define MBG Core v0.1 trust.",
    severity: "blocking",
    currentModules: [],
    futureModules: ["core/kernel/kernel-authority.ts", "core/adapters/v1-input-adapter.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.BOOTSTRAP_FSM_GOVERNS_TRADING_READINESS,
    title: "Bootstrap FSM governs trading readiness",
    statement: "Trading readiness is governed by Bootstrap FSM evidence and ActionGate, not by uptime, API availability, frontend state, V1, or manual flags.",
    severity: "blocking",
    currentModules: [
      "core/state/src/types.ts",
      "core/transitions/src/reducers.ts",
      "core/gates/src/action-gate.ts"
    ],
    futureModules: ["core/bootstrap/bootstrap-fsm.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.EVENT_VALIDATION_IS_CORE_RESPONSIBILITY,
    title: "Event validation is core responsibility",
    statement: "API validation is an early filter only; canonical domain-event validation belongs inside core before journal append or reducer execution.",
    severity: "panic",
    currentModules: ["core/contracts/src/events.ts"],
    futureModules: ["core/events/validate-domain-event.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.IDEMPOTENCY_INDEX_RECOVERABLE_FROM_JOURNAL,
    title: "Idempotency index is recoverable from journal",
    statement: "The idempotency index must be rebuildable from the canonical journal so restart or replay cannot forget applied events.",
    severity: "panic",
    currentModules: ["core/system/journal.ts"],
    futureModules: ["core/runtime/event-index.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.REDUCERS_REMAIN_PURE,
    title: "Reducers remain pure",
    statement: "Reducers are deterministic functions of prior snapshot and accepted event; they must not perform side effects or consult external authority.",
    severity: "panic",
    currentModules: ["core/transitions/src/reducers.ts"],
    futureModules: ["core/kernel/reducer-contract.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.DUPLICATE_EVENT_CANNOT_MUTATE_STATE,
    title: "Duplicate event cannot mutate state",
    statement: "A duplicate event identity cannot mutate snapshot, advance revision, recalculate PnL, create orders, unblock risk, or change trust state.",
    severity: "panic",
    currentModules: ["core/contracts/src/events.ts", "core/system/journal.ts"],
    futureModules: ["core/runtime/event-index.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.INVALID_EVENT_NEVER_ENTERS_CANONICAL_JOURNAL,
    title: "Invalid event never enters canonical journal",
    statement: "Invalid events may be rejected or recorded only in a non-canonical audit channel; they must not become replay input for trusted state.",
    severity: "panic",
    currentModules: ["core/contracts/src/events.ts", "core/system/journal.ts"],
    futureModules: ["core/events/validate-domain-event.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.BOOTSTRAP_FAILED_REQUIRES_RECOVERY_EVENT,
    title: "Bootstrap failed cannot transition to reconciled without recovery event",
    statement: "A failed bootstrap state may leave failure only through an accepted recovery event that is validated, journaled, reduced, replayable, and auditable.",
    severity: "blocking",
    currentModules: [
      "core/state/src/types.ts",
      "core/transitions/src/reducers.ts",
      "core/gates/src/action-gate.ts"
    ],
    futureModules: ["core/bootstrap/bootstrap-fsm.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.EXCHANGE_TRUTH_UNKNOWN_FORBIDS_NORMAL_TRADING,
    title: "ExchangeTruth unknown forbids normal trading",
    statement: "Normal trading is forbidden when exchange truth is unknown, missing, or otherwise unproven.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts", "core/transitions/src/reducers.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/exchange/exchange-truth.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.EXCHANGE_TRUTH_STALE_FORBIDS_NORMAL_TRADING,
    title: "ExchangeTruth stale forbids normal trading",
    statement: "Normal trading is forbidden when exchange truth is stale or has unknown freshness.",
    severity: "blocking",
    currentModules: ["core/runtime/src/runtime-engine.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/exchange/exchange-truth.ts", "core/freshness/freshness-guard.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.EXCHANGE_TRUTH_CONFLICTED_FORBIDS_NORMAL_TRADING,
    title: "ExchangeTruth conflicted forbids normal trading",
    statement: "Normal trading is forbidden when exchange truth conflicts with local memory or other accepted evidence.",
    severity: "panic",
    currentModules: ["core/state/src/types.ts", "core/transitions/src/reducers.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/exchange/exchange-truth.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.MARKET_DATA_STALE_FORBIDS_NORMAL_TRADING,
    title: "Market data stale forbids normal trading",
    statement: "Normal trading is forbidden when required market data is stale, missing, or of unknown age.",
    severity: "blocking",
    currentModules: ["application/market/*", "core/runtime/src/runtime-engine.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/freshness/freshness-guard.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.HEALTH_MUST_NOT_REPORT_FAKE_TRUTH,
    title: "Health must not report fake truth",
    statement: "Runtime health and API health must report only what the core can prove.",
    severity: "blocking",
    currentModules: ["core/runtime/src/runtime-engine.ts", "apps/runtime-api/src/app.ts"],
    futureModules: ["core/health/runtime-health-snapshot.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.UNKNOWN_CONNECTION_STATE_IS_NOT_CONNECTED,
    title: "Unknown connection state is not connected",
    statement: "Unknown connection state must not be treated as connected or used to authorize normal trading.",
    severity: "blocking",
    currentModules: ["application/exchange/*", "core/runtime/src/runtime-engine.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/health/runtime-health-snapshot.ts", "core/freshness/freshness-guard.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.LOCAL_FLAT_POSITION_REQUIRES_FRESH_EXCHANGE_RECONCILE,
    title: "Local flat position is not trusted without fresh exchange reconcile",
    statement: "A local flat position is not trusted for normal trading unless fresh exchange reconcile proves it.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts", "core/transitions/src/reducers.ts", "core/gates/src/action-gate.ts", "tests/scenarios/position-reconcile.ts"],
    futureModules: ["core/exchange/exchange-truth.ts", "core/freshness/freshness-guard.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.FRESHNESS_UNKNOWN_IS_STALE_FOR_NORMAL_TRADING,
    title: "Freshness unknown is stale for normal trading",
    statement: "Unknown freshness is not fresh; normal trading is forbidden until fresh evidence is proven.",
    severity: "blocking",
    currentModules: ["core/runtime/src/runtime-engine.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/freshness/freshness-guard.ts", "core/health/runtime-health-snapshot.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.KERNEL_AUTHORITY_CANONICAL_TRUST_EVALUATOR,
    title: "Kernel Authority is the canonical trust evaluator",
    statement: "Kernel Authority is the canonical evaluator of core trust; frontend, V1/V2, strategies, signals, decision engines, API fields, and local shortcuts cannot calculate or override trust.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.KERNEL_AUTHORITY_MUST_BE_PURE,
    title: "Kernel Authority must be pure",
    statement: "Kernel Authority reads accepted evidence and returns trust evaluation; it must not mutate snapshot, journal, bootstrap, exchange truth, freshness, health, or gate state.",
    severity: "panic",
    currentModules: ["core/state/src/types.ts", "core/system/journal.ts", "core/transitions/src/reducers.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.CORE_TRUST_REPORT_CANONICAL_TRUST_OUTPUT,
    title: "CoreTrustReport is the canonical trust output",
    statement: "CoreTrustReport is the single canonical output explaining current trust state, reasons, allowed actions, denied actions, and recovery hints.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts", "core/runtime/src/runtime-engine.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.FRONTEND_MUST_NOT_CALCULATE_TRUST,
    title: "Frontend must not calculate trust",
    statement: "Frontend may display core reports and verdicts, but must not calculate, infer, cache, override, or invent core trust.",
    severity: "blocking",
    currentModules: ["apps/runtime-api/src/app.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.V1_MUST_NOT_CALCULATE_CORE_TRUST,
    title: "V1 must not calculate core trust",
    statement: "V1 and V2 must not calculate, certify, override, or backfill MBG Core v0.1 trust; future integrations stay downstream of kernel trust.",
    severity: "blocking",
    currentModules: [],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts", "core/adapters/v1-input-adapter.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.DENIED_ACTION_REQUIRES_MACHINE_READABLE_REASONS,
    title: "Every denied action must have machine-readable reasons",
    statement: "Every denied action must return stable machine-readable reason codes; human text alone is not an acceptable kernel verdict.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.TRUST_STATE_MUST_BE_EXPLAINABLE,
    title: "Trust state must be explainable",
    statement: "Every trust state must be justified by accepted evidence and machine-readable reasons; unknown evidence cannot become fake TRUSTED.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts", "core/invariants/engine.invariants.ts", "core/system/state-hash.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.ACTION_GATE_MUST_USE_KERNEL_TRUST_STATE,
    title: "ActionGate must use kernel trust state",
    statement: "ActionGate must consume kernel trust state or equivalent canonical trust evaluation when evaluating unsafe actions.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts", "core/state/src/types.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.INVALID_OR_SUSPICIOUS_DATA_NOT_CANONICAL,
    title: "Invalid or suspicious data must not enter canonical journal",
    statement: "Invalid, suspicious, conflicted, malformed, poison, or unverifiable data must be rejected or quarantined outside canonical runtime history.",
    severity: "blocking",
    currentModules: ["core/events/validate-domain-event.ts", "core/runtime/event-index.ts", "core/system/journal.ts"],
    futureModules: ["core/quarantine/quarantine.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.QUARANTINED_DATA_NO_STATE_MUTATION,
    title: "Quarantined data must not mutate runtime state",
    statement: "Quarantined evidence is diagnostic and must not increment revision, update snapshot, change PnL, positions, orders, or trust state.",
    severity: "blocking",
    currentModules: ["core/transitions/src/reducers.ts", "core/runtime/src/runtime-engine.ts"],
    futureModules: ["core/quarantine/quarantine.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.QUARANTINE_DIAGNOSTIC_NOT_CANONICAL_HISTORY,
    title: "Quarantine is diagnostic, not canonical history",
    statement: "Quarantine records preserve rejected evidence for diagnosis but are not accepted domain events and are not canonical replay history.",
    severity: "blocking",
    currentModules: ["core/system/journal.ts", "core/events/validate-domain-event.ts", "core/runtime/event-index.ts"],
    futureModules: ["core/quarantine/quarantine.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.ACTION_GATE_VERDICT_MUST_BE_AUDITABLE,
    title: "Every ActionGate verdict must be auditable",
    statement: "Every ActionGate allow or deny verdict must preserve structured decision, action identity, trust state, and machine-readable reasons.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts"],
    futureModules: ["core/permissions/permission-ledger.ts", "core/kernel/core-trust-report.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.PERMISSION_LEDGER_RECORDS_ALLOW_AND_DENY,
    title: "Permission Ledger records allow and deny decisions",
    statement: "The Permission Ledger is an audit trail that records both allowed and denied ActionGate decisions with stable reason codes.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts"],
    futureModules: ["core/permissions/permission-ledger.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.RECOVERY_PLANNER_SUGGESTS_DOES_NOT_EXECUTE,
    title: "Recovery Planner suggests actions but does not execute them",
    statement: "Recovery Planner produces safe next-action suggestions but must not mutate state, append canonical events, submit orders, or call exchanges.",
    severity: "blocking",
    currentModules: [],
    futureModules: ["core/recovery/recovery-planner.ts", "core/kernel/core-trust-report.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.RECOVERY_ACTIONS_STILL_PASS_ACTION_GATE,
    title: "Recovery actions must still pass ActionGate",
    statement: "Recovery suggestions are not self-authorizing; any recovery action request must still receive an ActionGate verdict.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts"],
    futureModules: ["core/recovery/recovery-planner.ts", "core/permissions/permission-ledger.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.NORMAL_TRADING_FORBIDDEN_UNTIL_RECOVERY_SATISFIED,
    title: "Normal trading remains forbidden until recovery conditions are satisfied",
    statement: "A recovery plan does not make the kernel trusted; normal trading remains forbidden until accepted recovery evidence satisfies trust conditions.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts"],
    futureModules: ["core/recovery/recovery-planner.ts", "core/kernel/core-trust-report.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.PERMISSION_LEDGER_NO_TRADING_STATE_MUTATION,
    title: "Permission Ledger must not mutate trading state",
    statement: "Permission Ledger records are audit evidence and must not change positions, orders, PnL, bootstrap, exchange truth, freshness, health, or snapshot state.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts", "core/transitions/src/reducers.ts"],
    futureModules: ["core/permissions/permission-ledger.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.QUARANTINE_PRESERVES_REJECTED_EVIDENCE,
    title: "Quarantine must preserve rejected evidence",
    statement: "Quarantine must retain rejected, suspicious, malformed, duplicate-conflict, or conflicted evidence with diagnostic metadata outside canonical history.",
    severity: "blocking",
    currentModules: ["core/events/validate-domain-event.ts", "core/runtime/event-index.ts"],
    futureModules: ["core/quarantine/quarantine.ts", "core/recovery/recovery-planner.ts", "core/permissions/permission-ledger.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.COMMITTED_EVENT_STABLE_EVENT_HASH,
    title: "Every committed event must have a stable event hash",
    statement: "Every accepted canonical event must have a stable hash derived from its canonical event representation.",
    severity: "blocking",
    currentModules: ["core/contracts/src/events.ts", "core/system/journal.ts", "core/runtime/src/runtime-engine.ts"],
    futureModules: ["core/hash/event-hash.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.PRODUCED_SNAPSHOT_DETERMINISTIC_HASH,
    title: "Every produced snapshot must have a deterministic snapshot hash",
    statement: "Every produced runtime snapshot must have a deterministic hash derived from its canonical snapshot representation.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts", "core/system/state-hash.ts", "core/runtime/src/runtime-engine.ts"],
    futureModules: ["core/hash/snapshot-hash.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.TRANSITION_LINKS_BEFORE_EVENT_AFTER,
    title: "Every transition must link before snapshot, event, and after snapshot",
    statement: "Each transition must link prior snapshot evidence, accepted event evidence, transition identity, and resulting snapshot evidence.",
    severity: "blocking",
    currentModules: ["core/transitions/src/reducers.ts", "core/runtime/src/runtime-engine.ts", "core/kernel/core-trust-report.ts"],
    futureModules: ["core/causality/transition-trace.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.SNAPSHOT_REVISION_MATCHES_APPLIED_EVENT_REVISION,
    title: "Snapshot revision must match applied event revision",
    statement: "Snapshot revision must advance only when an accepted canonical event is applied and must match the applied event revision.",
    severity: "blocking",
    currentModules: ["core/state/src/types.ts", "core/system/journal.ts", "core/runtime/event-index.ts", "core/runtime/src/runtime-engine.ts"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.HASH_CHAIN_DISCONTINUITY_CORRUPTION_SIGNAL,
    title: "Hash chain discontinuity is a corruption signal",
    statement: "A proven break in event, snapshot, or transition hash continuity is corruption evidence and must block trusted state.",
    severity: "panic",
    currentModules: ["core/system/journal.ts", "core/system/state-hash.ts", "core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    futureModules: ["core/integrity/snapshot-hash-chain.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.CAUSALITY_TRACE_EXPLAINS_STATE_TRANSITION,
    title: "Causality trace must explain every state transition",
    statement: "Every accepted state transition must be explainable from prior snapshot through event and reducer to resulting snapshot.",
    severity: "blocking",
    currentModules: ["core/transitions/src/reducers.ts", "core/kernel/core-trust-report.ts", "core/kernel/kernel-authority.ts"],
    futureModules: ["core/trace/causality-trace.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.TRUST_STATE_CHANGES_CAUSALLY_EXPLAINABLE,
    title: "Trust state changes must be causally explainable",
    statement: "Trust state upgrades and downgrades must cite machine-readable evidence and must not change silently.",
    severity: "blocking",
    currentModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/trace/causality-trace.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.ACTION_GATE_REFERENCES_REVISION_AND_CAUSALITY,
    title: "ActionGate verdict must reference snapshot revision and causality trace when available",
    statement: "ActionGate verdicts must reference evaluated snapshot revision and causality trace evidence when available.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts", "core/permissions/permission-ledger.ts", "core/kernel/core-trust-report.ts"],
    futureModules: ["core/trace/causality-trace.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.REPLAY_HASH_MISMATCH_COMPROMISED_OR_PANIC,
    title: "Replay mismatch with hash evidence marks kernel COMPROMISED or PANIC",
    statement: "Replay mismatch supported by hash evidence must break trust and mark the kernel COMPROMISED or PANIC depending on severity.",
    severity: "panic",
    currentModules: ["core/system/journal.ts", "core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    futureModules: ["core/integrity/snapshot-hash-chain.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.UNKNOWN_HASH_NOT_CORRUPTION_PROVEN_MISMATCH_IS,
    title: "Unknown hash is not corruption; proven mismatch is corruption",
    statement: "Unknown hash evidence must be represented as unknown; proven hash mismatch is corruption evidence.",
    severity: "blocking",
    currentModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts", "core/system/state-hash.ts"],
    futureModules: ["core/integrity/snapshot-hash-chain.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.EXPLICIT_PROVENANCE_PRINCIPLE,
    title: "Explicit Provenance Principle",
    statement: "Every action must have provenance represented as kernel evidence.",
    severity: "blocking",
    currentModules: ["core/contracts/src/actions.ts", "core/gates/src/action-gate.ts", "core/kernel/core-trust-report.ts", "core/trace/causality-trace.ts"],
    futureModules: ["core/provenance/provenance.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.REPLAY_IS_SACRED,
    title: "Replay Is Sacred",
    statement: "Replay determinism is sacred and metadata/provenance must not introduce nondeterminism.",
    severity: "panic",
    currentModules: ["core/system/journal.ts", "core/runtime/src/runtime-engine.ts", "core/integrity/snapshot-hash-chain.ts", "core/trace/causality-trace.ts"],
    futureModules: ["core/provenance/provenance.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.OBSERVABLE_FIRST,
    title: "Observable First",
    statement: "Observability comes before execution and provenance must be visible before action.",
    severity: "blocking",
    currentModules: ["core/kernel/core-trust-report.ts", "core/gates/src/action-gate.ts", "core/trace/causality-trace.ts"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.METADATA_AS_EVENTS,
    title: "Metadata as Events",
    statement: "Metadata changes only through canonical events.",
    severity: "panic",
    currentModules: ["core/contracts/src/events.ts", "core/transitions/src/reducers.ts", "core/state/src/types.ts", "core/runtime/src/idempotency.ts"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.METADATA_IS_PROVENANCE_EVIDENCE,
    title: "Metadata is Provenance Evidence",
    statement: "Metadata is provenance evidence and must be linked to causality and integrity evidence.",
    severity: "blocking",
    currentModules: ["core/contracts/src/events.ts", "core/trace/causality-trace.ts", "core/integrity/integrity-report.ts"],
    futureModules: ["core/provenance/provenance.ts"],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.MISSING_PROVENANCE_BLOCKS_RISK,
    title: "Missing Provenance Blocks Risk",
    statement: "Risk-increasing actions require valid provenance; missing provenance blocks risk.",
    severity: "blocking",
    currentModules: ["core/gates/src/action-gate.ts", "core/kernel/core-trust-report.ts"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  },
  {
    id: CORE_LAW_ID.UNKNOWN_PROVENANCE_NOT_CORRUPTION,
    title: "Unknown provenance is not corruption by default",
    statement: "Unknown provenance must not be treated as corruption by default, although proven mismatch can affect trust.",
    severity: "blocking",
    currentModules: ["core/integrity/integrity-report.ts", "core/kernel/core-trust-report.ts", "core/gates/src/action-gate.ts"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  }


] as const;

export const CORE_REVIEW_RULE =
  "Every change must strengthen or preserve kernel provability; convenience must not create false confidence." as const;

export const WAVE2_CONSTITUTION_SCOPE = {
  IMPLEMENTS_RUNTIME_BEHAVIOR: false,
  IMPLEMENTS_CORE_TRUST_REPORT: false,
  IMPLEMENTS_EXCHANGE_TRUTH: false,
  IMPLEMENTS_FRESHNESS_GUARD: false,
  IMPLEMENTS_METADATA_AS_EVENTS: false,
  CONNECTS_V1: false,
  TOUCHES_SIGNAL_LAYER: false,
  TOUCHES_DECISION_ENGINE: false,
  TOUCHES_STRATEGIES: false,
  TOUCHES_UI: false,
  ENABLES_LIVE_TRADING: false
} as const;

export const WAVE2_MODULE_MAPPING = {
  BOOTSTRAP: {
    currentModules: [
      "core/state/src/types.ts",
      "core/transitions/src/reducers.ts",
      "core/gates/src/action-gate.ts"
    ],
    futureModules: ["core/bootstrap/bootstrap-fsm.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  EVENT_VALIDATION: {
    currentModules: ["core/contracts/src/events.ts"],
    futureModules: ["core/events/validate-domain-event.ts"],
    testModules: SCENARIO_TESTS
  },
  IDEMPOTENCY: {
    currentModules: ["core/system/journal.ts"],
    futureModules: ["core/runtime/event-index.ts"],
    testModules: SCENARIO_TESTS
  }
} as const;


export const WAVE3_CONSTITUTION_SCOPE = {
  IMPLEMENTS_RUNTIME_BEHAVIOR: false,
  IMPLEMENTS_KERNEL_AUTHORITY: false,
  IMPLEMENTS_CORE_TRUST_REPORT: false,
  CONNECTS_V1: false,
  CONNECTS_V2: false,
  TOUCHES_SIGNAL_LAYER: false,
  TOUCHES_DECISION_ENGINE: false,
  TOUCHES_STRATEGIES: false,
  TOUCHES_UI: false,
  ENABLES_LIVE_TRADING: false,
  ADDS_REAL_EXCHANGE_KEYS: false
} as const;

export const WAVE3_MODULE_MAPPING = {
  EXCHANGE_TRUTH: {
    currentModules: [
      "core/state/src/types.ts",
      "core/transitions/src/reducers.ts",
      "core/gates/src/action-gate.ts"
    ],
    futureModules: ["core/exchange/exchange-truth.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  FRESHNESS: {
    currentModules: ["core/runtime/src/runtime-engine.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/freshness/freshness-guard.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  HEALTH_TRUTH: {
    currentModules: ["core/runtime/src/runtime-engine.ts", "apps/runtime-api/src/app.ts"],
    futureModules: ["core/health/runtime-health-snapshot.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  SCENARIO_AUDIT: {
    currentModules: ["tests/scenarios/*"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  }
} as const;

export const EXCHANGE_TRUTH_STATUS = {
  UNKNOWN: "unknown",
  FRESH: "fresh",
  STALE: "stale",
  CONFLICTED: "conflicted"
} as const;

export const FRESHNESS_STATUS = {
  UNKNOWN: "unknown",
  FRESH: "fresh",
  STALE: "stale",
  CONFLICTED: "conflicted"
} as const;

export const HEALTH_TRUTH_RULE = {
  UNKNOWN_CONNECTION_IS_NOT_CONNECTED: "unknown_connection_is_not_connected",
  LOCAL_FLAT_REQUIRES_FRESH_EXCHANGE_RECONCILE: "local_flat_requires_fresh_exchange_reconcile",
  HEALTH_MUST_NOT_REPORT_UNPROVEN_TRUTH: "health_must_not_report_unproven_truth"
} as const;



export const WAVE4_CONSTITUTION_SCOPE = {
  IMPLEMENTS_RUNTIME_BEHAVIOR: false,
  IMPLEMENTS_KERNEL_AUTHORITY_CODE: false,
  IMPLEMENTS_CORE_TRUST_REPORT_CODE: false,
  IMPLEMENTS_RECOVERY_PLANNER: false,
  CONNECTS_V1: false,
  CONNECTS_V2: false,
  TOUCHES_SIGNAL_LAYER: false,
  TOUCHES_DECISION_ENGINE: false,
  TOUCHES_STRATEGIES: false,
  TOUCHES_UI: false,
  ENABLES_LIVE_TRADING: false,
  ADDS_REAL_EXCHANGE_KEYS: false
} as const;

export const WAVE4_MODULE_MAPPING = {
  KERNEL_AUTHORITY: {
    currentModules: ["core/state/src/types.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  CORE_TRUST_REPORT: {
    currentModules: ["core/gates/src/action-gate.ts", "core/runtime/src/runtime-engine.ts"],
    futureModules: ["core/kernel/core-trust-report.ts", "core/kernel/kernel-authority.ts"],
    testModules: SCENARIO_TESTS
  },
  ACTION_GATE_VERDICT_V2: {
    currentModules: ["core/gates/src/action-gate.ts"],
    futureModules: ["core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    testModules: SCENARIO_TESTS
  },
  SCENARIO_AUDIT: {
    currentModules: ["tests/scenarios/*"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  }
} as const;

export const ACTION_GATE_VERDICT_V2_REQUIREMENT = {
  DENIED_ACTION_REQUIRES_MACHINE_READABLE_REASONS: "denied_action_requires_machine_readable_reasons",
  DENIED_ACTION_IDENTIFIES_TRUST_STATE: "denied_action_identifies_trust_state",
  DENIED_ACTION_IDENTIFIES_BLOCKING_DOMAIN: "denied_action_identifies_blocking_domain",
  HUMAN_TEXT_IS_NOT_AUTHORITY: "human_text_is_not_authority"
} as const;

export const CORE_TRUST_REPORT_REQUIREMENT = {
  CANONICAL_TRUST_OUTPUT: "canonical_trust_output",
  MUST_INCLUDE_TRUST_STATE: "must_include_trust_state",
  MUST_INCLUDE_MACHINE_READABLE_REASONS: "must_include_machine_readable_reasons",
  MUST_INCLUDE_ALLOWED_AND_DENIED_ACTIONS: "must_include_allowed_and_denied_actions",
  MUST_NOT_HIDE_UNKNOWN_STALE_CONFLICTED_OR_UNRECONCILED_EVIDENCE: "must_not_hide_unknown_stale_conflicted_or_unreconciled_evidence"
} as const;

export const KERNEL_AUTHORITY_REQUIREMENT = {
  CANONICAL_TRUST_EVALUATOR: "canonical_trust_evaluator",
  PURE_EVALUATOR_NO_STATE_MUTATION: "pure_evaluator_no_state_mutation",
  FRONTEND_NOT_TRUST_CALCULATOR: "frontend_not_trust_calculator",
  V1_NOT_TRUST_CALCULATOR: "v1_not_trust_calculator",
  ACTION_GATE_USES_KERNEL_TRUST_STATE: "action_gate_uses_kernel_trust_state"
} as const;


export const WAVE5_CONSTITUTION_SCOPE = {
  IMPLEMENTS_RUNTIME_BEHAVIOR: false,
  IMPLEMENTS_RECOVERY_PLANNER_CODE: false,
  IMPLEMENTS_QUARANTINE_CODE: false,
  IMPLEMENTS_PERMISSION_LEDGER_CODE: false,
  EXECUTES_AUTOMATIC_RECOVERY: false,
  CONNECTS_V1: false,
  CONNECTS_V2: false,
  TOUCHES_SIGNAL_LAYER: false,
  TOUCHES_DECISION_ENGINE: false,
  TOUCHES_STRATEGIES: false,
  TOUCHES_UI: false,
  ENABLES_LIVE_TRADING: false,
  ADDS_REAL_EXCHANGE_KEYS: false
} as const;

export const WAVE5_MODULE_MAPPING = {
  QUARANTINE: {
    currentModules: ["core/events/validate-domain-event.ts", "core/runtime/event-index.ts", "core/quarantine/quarantine.ts"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  },
  PERMISSION_LEDGER: {
    currentModules: ["core/gates/src/action-gate.ts", "core/permissions/permission-ledger.ts"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  },
  RECOVERY_PLANNER: {
    currentModules: ["core/kernel/core-trust-report.ts", "core/recovery/recovery-planner.ts", "core/kernel/kernel-authority.ts"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  },
  SCENARIO_AUDIT: {
    currentModules: ["tests/scenarios/*"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  }
} as const;

export const QUARANTINE_REQUIREMENT = {
  DIAGNOSTIC_NOT_CANONICAL_HISTORY: "diagnostic_not_canonical_history",
  MUST_NOT_MUTATE_RUNTIME_STATE: "must_not_mutate_runtime_state",
  MUST_PRESERVE_REJECTED_EVIDENCE: "must_preserve_rejected_evidence",
  CANONICAL_REPLAY_MUST_IGNORE_QUARANTINE: "canonical_replay_must_ignore_quarantine"
} as const;

export const PERMISSION_LEDGER_REQUIREMENT = {
  RECORDS_ALLOW_DECISIONS: "records_allow_decisions",
  RECORDS_DENY_DECISIONS: "records_deny_decisions",
  MUST_BE_AUDITABLE: "must_be_auditable",
  MUST_NOT_MUTATE_TRADING_STATE: "must_not_mutate_trading_state"
} as const;

export const RECOVERY_PLANNER_REQUIREMENT = {
  SUGGESTS_ACTIONS_ONLY: "suggests_actions_only",
  MUST_NOT_EXECUTE_ACTIONS: "must_not_execute_actions",
  RECOVERY_ACTIONS_STILL_PASS_ACTION_GATE: "recovery_actions_still_pass_action_gate",
  NORMAL_TRADING_REMAINS_FORBIDDEN_UNTIL_RECOVERY_CONDITIONS_ARE_SATISFIED: "normal_trading_remains_forbidden_until_recovery_conditions_are_satisfied"
} as const;


export const WAVE7_CONSTITUTION_SCOPE = {
  IMPLEMENTS_RUNTIME_BEHAVIOR: false,
  IMPLEMENTS_HASH_CHAIN_CODE: false,
  IMPLEMENTS_CAUSALITY_TRACE_CODE: false,
  CONNECTS_V1: false,
  CONNECTS_V2: false,
  TOUCHES_SIGNAL_LAYER: false,
  TOUCHES_DECISION_ENGINE: false,
  TOUCHES_STRATEGIES: false,
  TOUCHES_UI: false,
  ENABLES_LIVE_TRADING: false,
  ADDS_REAL_EXCHANGE_KEYS: false
} as const;

export const WAVE7_MODULE_MAPPING = {
  SNAPSHOT_HASH_CHAIN: {
    currentModules: ["core/state/src/types.ts", "core/runtime/src/runtime-engine.ts", "core/system/journal.ts", "core/system/state-hash.ts"],
    futureModules: ["core/hash/event-hash.ts", "core/hash/snapshot-hash.ts", "core/integrity/snapshot-hash-chain.ts"],
    testModules: SCENARIO_TESTS
  },
  CAUSALITY_TRACE: {
    currentModules: ["core/transitions/src/reducers.ts", "core/kernel/core-trust-report.ts", "core/gates/src/action-gate.ts"],
    futureModules: ["core/causality/transition-trace.ts", "core/trace/causality-trace.ts"],
    testModules: SCENARIO_TESTS
  },
  REPLAY_HASH_EVIDENCE: {
    currentModules: ["core/system/journal.ts", "core/system/state-hash.ts", "core/kernel/kernel-authority.ts", "core/kernel/core-trust-report.ts"],
    futureModules: ["core/integrity/snapshot-hash-chain.ts"],
    testModules: SCENARIO_TESTS
  },
  SCENARIO_AUDIT: {
    currentModules: ["tests/scenarios/*"],
    futureModules: [],
    testModules: SCENARIO_TESTS
  }
} as const;

export const HASH_CHAIN_REQUIREMENT = {
  STABLE_EVENT_HASH: "stable_event_hash",
  DETERMINISTIC_SNAPSHOT_HASH: "deterministic_snapshot_hash",
  TRANSITION_LINKS_BEFORE_EVENT_AFTER: "transition_links_before_event_after",
  SNAPSHOT_REVISION_MATCHES_APPLIED_EVENT_REVISION: "snapshot_revision_matches_applied_event_revision",
  DISCONTINUITY_IS_CORRUPTION_SIGNAL: "discontinuity_is_corruption_signal",
  UNKNOWN_HASH_IS_NOT_CORRUPTION: "unknown_hash_is_not_corruption",
  PROVEN_MISMATCH_IS_CORRUPTION: "proven_mismatch_is_corruption"
} as const;

export const CAUSALITY_TRACE_REQUIREMENT = {
  EXPLAINS_EVERY_STATE_TRANSITION: "explains_every_state_transition",
  TRUST_STATE_CHANGES_ARE_EXPLAINABLE: "trust_state_changes_are_explainable",
  ACTION_GATE_REFERENCES_SNAPSHOT_REVISION_WHEN_AVAILABLE: "action_gate_references_snapshot_revision_when_available",
  ACTION_GATE_REFERENCES_CAUSALITY_TRACE_WHEN_AVAILABLE: "action_gate_references_causality_trace_when_available"
} as const;



export function getCoreLaw(id: CoreLawId): CoreLawDefinition {
  const law = CORE_LAWS.find((candidate) => candidate.id === id);
  if (!law) {
    throw new Error(`Unknown core law id: ${id}`);
  }
  return law;
}

export function listCoreLawIds(): CoreLawId[] {
  return CORE_LAWS.map((law) => law.id);
}
