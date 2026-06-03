# MBG Core v0.1 Alpha5 — Core API Map

**Translation:** Core API Map = карта API ядра / карта публичных поверхностей ядра.

**Canonical base:** `mbg-core-v0.1-alpha5`.

This document describes the public surfaces that future layers may read. It is intentionally documentation-only: it does not change runtime logic, ActionGate logic, state reducers, event validation, idempotency, strategy logic, UI, V1, V2, or live trading.

## Non-negotiable API laws

1. **CoreTrustReport is the main trust output.** Future layers read it; they do not recompute trust independently.
2. **Kernel Authority is the source of `trustState`.** V1, V2, UI, strategy, adapters, and scripts do not calculate trust state.
3. **ActionGate remains the action authority.** Strategy logic, UI, runtime API, recovery flows, and future orchestration layers must not bypass ActionGate.
4. **V1 does not compute trust.** V1 may only consume explicit core outputs if an adapter is introduced later.
5. **UI does not compute trust.** UI may display CoreTrustReport, ActionGate verdicts, RecoveryPlan, Quarantine summary, Permission Ledger records, and scenario audit evidence.
6. **Strategy does not bypass ActionGate.** A strategy may request an action in a future layer, but the core must deny or allow through ActionGate.
7. **Recovery Planner only advises.** Recovery actions must still pass through ActionGate and must not execute automatically.
8. **Quarantine isolates bad data.** Quarantine does not mutate the trusted snapshot and does not append bad data to the main journal.
9. **Permission Ledger records decisions.** It does not authorize actions by itself.
10. **Event Validation and Event Idempotency are mandatory ingress protections.** Invalid or conflicting events must not mutate the trusted state.

## Public surface table

| Surface | Primary files | Public output | Who may read it later |
|---|---|---|---|
| CoreTrustReport | `core/kernel/core-trust-report.ts` | `CoreTrustReport` | runtime API, UI, audit, future orchestration, future adapters |
| Kernel Authority | `core/kernel/kernel-authority.ts` | `KernelAuthorityVerdict` / `trustState` | CoreTrustReport builder, audit, future orchestration |
| ActionGate Verdict | `core/gates/src/action-gate.ts`, `core/contracts/src/actions.ts` | `GateDecision` / `ActionGateVerdict` | runtime API, Permission Ledger, UI, audit, recovery orchestration |
| Recovery Planner | `core/recovery/recovery-planner.ts` | `RecoveryPlan` | runtime API, UI, audit, future manual recovery tooling |
| Quarantine | `core/quarantine/quarantine.ts` | `QuarantineRecord`, `QuarantineSummary`, `QuarantineStoreView` | CoreTrustReport, Recovery Planner, audit, UI |
| Permission Ledger | `core/permissions/permission-ledger.ts` | `PermissionRecord[]` / summary | audit, runtime API, UI |
| ExchangeTruth | `core/state/src/types.ts`, `core/contracts/src/events.ts`, `core/transitions/src/reducers.ts` | `ExchangeTruthState` | Kernel Authority, CoreTrustReport, ActionGate, Freshness, Recovery Planner |
| Freshness | `core/runtime/src/freshness.ts` | `FreshnessReport` | Kernel Authority, CoreTrustReport, ActionGate, Recovery Planner, audit |
| HealthTruth | `core/runtime/src/runtime-engine.ts` | `HealthTruthSnapshot` | Kernel Authority, CoreTrustReport, ActionGate, Recovery Planner, audit |
| Event Validation | `core/events/validate-domain-event.ts`, `core/contracts/src/events.ts` | `DomainEventValidationResult` | runtime engine, quarantine, audit |
| Event Idempotency | `core/runtime/src/idempotency.ts` | `IdempotencyDiagnostic` | runtime engine, quarantine, audit |
| Bootstrap FSM | `core/state/src/types.ts`, `core/contracts/src/events.ts`, `core/transitions/src/reducers.ts` | `BootstrapState` | Kernel Authority, CoreTrustReport, ActionGate, Recovery Planner, audit |

---

## 1. CoreTrustReport — отчёт доверия ядра

### Location

- `core/kernel/core-trust-report.ts`
- Produced by runtime integration in `core/runtime/src/runtime-engine.ts`.

### What it does

CoreTrustReport is the **main trust output of the core**. It aggregates the state snapshot and evidence into a single machine-readable trust report. It is the canonical output for future layers that need to know whether the core can be trusted right now and why.

It combines:

- Kernel Authority trust verdict;
- blocking reasons;
- allowed action classes;
- runtime mode;
- freshness report;
- health truth snapshot;
- exchange truth;
- replay evidence;
- invariant evidence;
- ActionGate evidence when available;
- quarantine and permission evidence when available.

### What it must not do

CoreTrustReport must not:

- mutate runtime state;
- write events;
- call an exchange;
- perform recovery;
- authorize actions directly;
- compute strategy decisions;
- connect V1/V2;
- enable live trading.

### Public methods / exports

- `buildCoreTrustReport(input: CoreTrustReportInput): CoreTrustReport`
- `CoreTrustReport`
- `CoreTrustReportInput`
- `BlockingReason`
- `BlockingReasonSeverity`
- `RuntimeMode`
- `AllowedActionClass`

### Returned data

The public return is `CoreTrustReport`. It includes the trust state produced by Kernel Authority plus evidence and block reasons suitable for UI, audit, runtime API, recovery planning, and future orchestration.

### Tests

- `tests/scenarios/core-trust-report.ts`
- `tests/scenarios/wave4-scenario-audit.ts`
- `tests/scenarios/wave5-scenario-audit.ts`

### Future readers allowed

- runtime API;
- UI display layer;
- audit/reporting layer;
- future orchestration layer;
- Recovery Planner;
- future adapters that need read-only trust evidence.

Future readers must not recompute trust independently.

---

## 2. Kernel Authority — орган доверия ядра

### Location

- `core/kernel/kernel-authority.ts`

### What it does

Kernel Authority is the **source of `trustState`**. It is a pure evaluator that reads current state and evidence and returns a trust verdict.

Trust states:

- `TRUSTED`
- `RECOVERABLE`
- `UNCERTAIN`
- `COMPROMISED`
- `HALTED`
- `PANIC`

It evaluates bootstrap, position, orders, risk, system, exchangeTruth, freshness, healthTruth, replay, invariants, and optional ActionGate evidence.

### What it must not do

Kernel Authority must not:

- mutate snapshot/state;
- write events;
- append journals;
- call exchange APIs;
- call runtime APIs;
- execute recovery;
- authorize trading by itself;
- connect V1/V2;
- run strategy logic.

### Public methods / exports

- `evaluateKernelTrust(input: KernelAuthorityInput): KernelAuthorityVerdict`
- `KernelAuthority.evaluate(input: KernelAuthorityInput): KernelAuthorityVerdict`
- `KernelAuthorityInput`
- `KernelAuthorityVerdict`
- `TrustBlocker`
- `TrustBlockerSeverity`
- `TrustBlockerDomain`
- `ReplayStatusInput`
- `InvariantStatusInput`
- `ActionGateStatusInput`

### Returned data

The public return is `KernelAuthorityVerdict`, including:

- `trustState`;
- blockers / reasons;
- recovery hints;
- evidence summary;
- generated timestamp/version metadata if provided by implementation.

### Tests

- `tests/scenarios/kernel-authority.ts`
- `tests/scenarios/core-trust-report.ts`
- `tests/scenarios/wave4-scenario-audit.ts`

### Future readers allowed

- CoreTrustReport builder;
- scenario audit;
- runtime API as read-only output;
- UI as display-only output;
- future orchestration as read-only input.

V1, UI, and strategy must not calculate `trustState`.

---

## 3. ActionGate Verdict — вердикт ворот действия

### Location

- `core/gates/src/action-gate.ts`
- `core/contracts/src/actions.ts`

### What it does

ActionGate is the only core authority that allows or denies action requests. It evaluates an `ActionRequest` against the snapshot, trust inputs, bootstrap status, exchangeTruth, freshness, health truth, risk state, position/order state, and existing gate rules.

ActionGate Verdict v2 provides a machine-readable explanation of an action decision.

### What it must not do

ActionGate must not:

- execute the action;
- place orders;
- call an exchange;
- mutate state directly;
- write strategy decisions;
- bypass Kernel Authority;
- replace CoreTrustReport;
- become a UI or Decision Engine.

### Public methods / exports

- `new ActionGate(options?: ActionGateOptions)`
- `ActionGate.evaluate(action, snapshot, context?)` or the current `evaluate` signature in `core/gates/src/action-gate.ts`
- `ActionGateOptions`
- From `core/contracts/src/actions.ts`:
  - `ActionGateVerdict`
  - `GateDecision`
  - `ActionRequest`
  - `ACTION_TYPE`
  - `ActionClass`
  - `KernelTrustState`

### Returned data

Public output is `GateDecision` / `ActionGateVerdict`, including:

- `allowed`;
- `decision`;
- `reason`;
- `blockingReasons`;
- `blockingStates`;
- `allowedAlternatives`;
- `relatedInvariants`;
- `kernelTrustState`;
- `snapshotRevision`;
- action metadata;
- `gateVersion`.

### Tests

- `tests/scenarios/gate-scenarios.ts`
- `tests/scenarios/core-action-gate-verdict.ts`
- `tests/scenarios/bootstrap-fsm.ts`
- `tests/scenarios/exchange-truth.ts`
- `tests/scenarios/core-freshness.ts`
- `tests/scenarios/core-health-truth.ts`
- `tests/scenarios/core-permission-ledger.ts`

### Future readers allowed

- runtime API;
- Permission Ledger;
- UI display layer;
- audit/reporting;
- future recovery orchestration.

Strategies may request intent in future layers but must not bypass ActionGate.

---

## 4. Recovery Planner — планировщик восстановления

### Location

- `core/recovery/recovery-planner.ts`

### What it does

Recovery Planner reads CoreTrustReport and related evidence, then proposes safe recovery steps. It tells operators or future orchestration what should be checked next.

Supported recovery actions include:

- `RECONCILE_POSITION`
- `RECONCILE_ORDERS`
- `SYNC_FILLS`
- `REFRESH_MARKET_DATA`
- `CHECK_HEALTH`
- `RUN_REPLAY_CHECK`
- `INSPECT_QUARANTINE`
- `HALT_RUNTIME`
- `MANUAL_REVIEW`

### What it must not do

Recovery Planner must not:

- execute recovery actions;
- write events;
- mutate snapshot;
- call exchange APIs;
- call runtime APIs;
- enable live trading;
- bypass ActionGate;
- become a Recovery Executor.

### Public methods / exports

- `planRecovery(input: RecoveryPlannerInput): RecoveryPlan`
- `RecoveryPlanner.plan(input: RecoveryPlannerInput): RecoveryPlan`
- `RecoveryPlan`
- `RecoveryPlannerInput`
- `RecoveryActionType`
- `RECOVERY_ACTION_TYPE`
- `RecoveryMode`
- `RecoveryPriority`
- `ForbiddenRecoveryAction`
- `QuarantineSummary`
- `RECOVERY_PLANNER_VERSION`

### Returned data

Public output is `RecoveryPlan`, including:

- `required`;
- `mode`;
- `reasons`;
- `nextActions`;
- `forbiddenActions`;
- `priority`;
- `manualReviewRequired`;
- `plannerVersion`.

### Tests

- `tests/scenarios/recovery-planner.ts`
- `tests/scenarios/wave5-scenario-audit.ts`

### Future readers allowed

- runtime API;
- UI display layer;
- manual recovery tools;
- audit/reporting;
- future recovery orchestration, provided every action still passes ActionGate.

---

## 5. Quarantine — карантин плохих данных

### Location

- `core/quarantine/quarantine.ts`
- Integrated from runtime validation/idempotency paths in `core/runtime/src/runtime-engine.ts`.

### What it does

Quarantine stores bad or unsafe data outside the trusted main journal. It provides isolation and evidence for invalid events, conflicting duplicates, corrupted inputs, or other unsafe payloads.

### What it must not do

Quarantine must not:

- mutate the trusted snapshot;
- append quarantined data to the main journal as applied events;
- authorize or deny actions by itself;
- repair data automatically;
- call exchange APIs;
- run strategy logic.

### Public methods / exports

- `QuarantineStore`
- `QuarantineStore.add(record)`
- `QuarantineStore.fromValidation(input)`
- `QuarantineStore.fromIdempotency(input)`
- `QuarantineStore.list()`
- `QuarantineStore.summary()`
- `quarantinePayloadHash(payload)`
- `QuarantineRecord`
- `QuarantineSummary`
- `QuarantineStoreView`
- `QuarantineSource`
- `QuarantineSeverity`
- `QuarantineFromValidationInput`
- `QuarantineFromIdempotencyInput`

### Returned data

Public outputs include:

- quarantined records;
- quarantine summary;
- counts by severity/source;
- payload hashes/evidence.

### Tests

- `tests/scenarios/core-quarantine.ts`
- `tests/scenarios/core-event-validation.ts`
- `tests/scenarios/core-idempotency.ts`
- `tests/scenarios/wave5-scenario-audit.ts`

### Future readers allowed

- CoreTrustReport;
- Recovery Planner;
- audit/reporting;
- runtime API;
- UI display layer.

Quarantine consumers must treat records as untrusted evidence, not as applied events.

---

## 6. Permission Ledger — журнал разрешений и отказов

### Location

- `core/permissions/permission-ledger.ts`
- Integrated by runtime/ActionGate decision flow in `core/runtime/src/runtime-engine.ts`.

### What it does

Permission Ledger records allow/deny decisions and their evidence. It provides auditability for action permissions and denials.

### What it must not do

Permission Ledger must not:

- authorize actions by itself;
- override ActionGate;
- mutate domain state;
- write trading events;
- call exchange APIs;
- execute actions;
- compute strategy decisions.

### Public methods / exports

- `PermissionLedger`
- `PermissionLedger.record(options)`
- `PermissionLedger.list()`
- `PermissionLedger.summary()`
- `createPermissionRecord(options)`
- `hashPermissionDecision(record)`
- `PermissionRecord`
- `PermissionLedgerRecordOptions`

### Returned data

Public outputs include:

- permission records;
- decision hashes;
- allow/deny counts;
- action type and blocking evidence.

### Tests

- `tests/scenarios/core-permission-ledger.ts`
- `tests/scenarios/core-action-gate-verdict.ts`
- `tests/scenarios/wave5-scenario-audit.ts`

### Future readers allowed

- audit/reporting;
- runtime API;
- UI display layer;
- compliance/export tooling.

The ledger is evidence, not an authorization engine.

---

## 7. ExchangeTruth — биржевая истина

### Location

- State type: `core/state/src/types.ts`
- Event contract: `core/contracts/src/events.ts`
- Reducer: `core/transitions/src/reducers.ts`
- Runtime integration: `core/runtime/src/runtime-engine.ts`
- ActionGate integration: `core/gates/src/action-gate.ts`

### What it does

ExchangeTruth describes whether local core state is confirmed by exchange-derived truth.

Statuses:

- `unknown`
- `fresh`
- `stale`
- `conflicted`
- `unavailable`

It records:

- `lastAccountReconcileAt`;
- `lastPositionReconcileAt`;
- `lastOrderReconcileAt`;
- `lastFillSyncAt`;
- `source`;
- `drift`;
- `conflicts`;
- `reason`.

### What it must not do

ExchangeTruth must not:

- call the real exchange;
- store real API keys;
- bypass Bootstrap FSM;
- bypass ActionGate;
- execute trading;
- mutate unrelated domains outside reducers;
- become a live exchange adapter.

### Public methods / exports

Types and contracts:

- `ExchangeTruthState`
- `ExchangeTruthStatus`
- `ExchangeTruthDrift`
- `ExchangeTruthConflict`
- `ExchangeTruthPayloadSchema`
- `ExchangeTruthPayload`
- `ExchangeTruthConflictSchema`
- `ExchangeTruthDriftSchema`

Events:

- `exchange_truth.reconcile_started`
- `exchange_truth.reconcile_succeeded`
- `exchange_truth.reconcile_failed`
- `exchange_truth.stale_detected`
- `exchange_truth.conflict_detected`
- `exchange_truth.unavailable_detected`

Reducer:

- `reduceExchangeTruthState(prev, event, ctx?)`

### Returned data

Public output is `snapshot.exchangeTruth`, an `ExchangeTruthState` inside `RuntimeSnapshot`.

### Tests

- `tests/scenarios/exchange-truth.ts`
- `tests/scenarios/core-freshness.ts`
- `tests/scenarios/core-action-gate-verdict.ts`
- `tests/scenarios/kernel-authority.ts`
- `tests/scenarios/core-trust-report.ts`
- `tests/scenarios/wave3-scenario-audit.ts`

### Future readers allowed

- Kernel Authority;
- CoreTrustReport;
- ActionGate;
- Freshness Guard;
- Recovery Planner;
- runtime API;
- UI display layer;
- audit/reporting.

Fresh ExchangeTruth is necessary but not sufficient to allow normal trading.

---

## 8. Freshness — свежесть данных

### Location

- `core/runtime/src/freshness.ts`
- Runtime integration in `core/runtime/src/runtime-engine.ts`.
- ActionGate integration in `core/gates/src/action-gate.ts`.

### What it does

Freshness evaluates whether market data, exchange truth, and connection evidence are recent enough for normal action. It prevents the core from acting on stale, unknown, expired, or unavailable data.

Statuses:

- `unknown`
- `fresh`
- `stale`
- `expired`
- `unavailable`

### What it must not do

Freshness must not:

- fetch data;
- call exchanges;
- mutate snapshot;
- write events;
- authorize actions directly;
- replace HealthTruth;
- replace ExchangeTruth;
- bypass ActionGate.

### Public methods / exports

- `calculateFreshness(inputs, config?)`
- `calculateSnapshotFreshness(snapshot, config?)`
- `collectFreshnessInputs(snapshot)`
- `FreshnessReport`
- `FreshnessInputs`
- `FreshnessCheck`
- `FreshnessStatus`
- `FreshnessDenyReason`
- `FreshnessConfig`
- `DEFAULT_FRESHNESS_CONFIG`

### Returned data

Public output is `FreshnessReport`, including:

- market data freshness;
- exchange truth freshness;
- connection freshness;
- blocking reasons;
- `okForNormalTrading`.

### Tests

- `tests/scenarios/core-freshness.ts`
- `tests/scenarios/wave3-scenario-audit.ts`
- `tests/scenarios/kernel-authority.ts`
- `tests/scenarios/core-trust-report.ts`
- `tests/scenarios/core-action-gate-verdict.ts`

### Future readers allowed

- Kernel Authority;
- CoreTrustReport;
- ActionGate;
- Recovery Planner;
- audit/reporting;
- runtime API;
- UI display layer.

---

## 9. HealthTruth — честное здоровье системы

### Location

- `core/runtime/src/runtime-engine.ts`

### What it does

HealthTruth provides honest system health evidence. It prevents fake healthy states, including fake `wsConnected = true`, and distinguishes unknown, stale, partial, or incomplete connection/health evidence.

It includes:

- system state;
- websocket connection truth;
- health completeness;
- diagnostics;
- reconcile freshness;
- position/fill consistency;
- open/unknown order evidence;
- drift indicators;
- reconnect and latency evidence;
- timestamp.

### What it must not do

HealthTruth must not:

- fake a healthy state;
- infer connection truth without evidence;
- call exchange APIs;
- mutate state;
- authorize actions directly;
- replace Kernel Authority;
- replace ActionGate.

### Public methods / exports

- `HealthTruthSnapshot`
- runtime methods that expose runtime view / health truth evidence, including the current runtime engine public surface in `core/runtime/src/runtime-engine.ts`.

### Returned data

Public output is a `HealthTruthSnapshot`, used by Kernel Authority, CoreTrustReport, ActionGate, Recovery Planner, and audit.

### Tests

- `tests/scenarios/core-health-truth.ts`
- `tests/scenarios/wave3-scenario-audit.ts`
- `tests/scenarios/kernel-authority.ts`
- `tests/scenarios/core-trust-report.ts`
- `tests/scenarios/core-action-gate-verdict.ts`

### Future readers allowed

- Kernel Authority;
- CoreTrustReport;
- ActionGate;
- Recovery Planner;
- audit/reporting;
- runtime API;
- UI display layer.

Future work should move `HealthTruthSnapshot` into a dedicated contract file if the type becomes a cross-package public contract.

---

## 10. Event Validation — проверка событий

### Location

- `core/events/validate-domain-event.ts`
- Event schemas in `core/contracts/src/events.ts`
- Runtime commit integration in `core/runtime/src/runtime-engine.ts`.

### What it does

Event Validation protects the core event ingress. Events must pass envelope and payload validation before they can mutate the trusted snapshot. Invalid events are rejected and may be sent to quarantine.

### What it must not do

Event Validation must not:

- apply events;
- mutate snapshot;
- write to the main journal as accepted events;
- silently coerce unsafe payloads into valid events;
- call exchange APIs;
- authorize actions;
- execute recovery.

### Public methods / exports

- `validateDomainEvent(event): DomainEventValidationResult`
- `DomainEventValidationResult`
- `DomainEventValidationAccepted`
- `DomainEventValidationRejected`
- `DomainEventValidationIssue`
- `DomainEventValidationCode`
- Event schemas from `core/contracts/src/events.ts`, including:
  - `MarketTickPayloadSchema`
  - `SignalPayloadSchema`
  - `BootstrapPayloadSchema`
  - `ExchangeTruthPayloadSchema`

### Returned data

Public output is `DomainEventValidationResult`:

- accepted: `{ ok: true, eventId, eventType }`;
- rejected: `{ ok: false, eventId?, eventType?, issues }`.

### Tests

- `tests/scenarios/core-event-validation.ts`
- `tests/scenarios/core-quarantine.ts`
- `tests/scenarios/wave2-scenario-audit.ts`
- `tests/scenarios/wave5-scenario-audit.ts`

### Future readers allowed

- runtime engine;
- quarantine;
- audit/reporting;
- future adapter ingress validation.

Adapters may submit events, but validation remains inside Core.

---

## 11. Event Idempotency — защита от повторного применения событий

### Location

- `core/runtime/src/idempotency.ts`
- Runtime commit integration in `core/runtime/src/runtime-engine.ts`.

### What it does

Event Idempotency prevents duplicate application of the same event and detects conflicting duplicates. It ensures that repeated valid events do not increment the snapshot revision or apply side effects twice.

### What it must not do

Event Idempotency must not:

- mutate domain state directly;
- apply events;
- silently accept conflicting duplicates;
- authorize actions;
- call exchange APIs;
- repair journals automatically.

### Public methods / exports

- `EventIdempotencyIndex`
- `EventIdempotencyIndex.evaluate(event)`
- `EventIdempotencyIndex.markAccepted(event)`
- `EventIdempotencyIndex.clear()`
- `canonicalEventFingerprint(event)`
- `IdempotencyDiagnostic`
- `IdempotencyDecision`
- `IdempotencyScope`

### Returned data

Public output is `IdempotencyDiagnostic`, indicating whether an event is new, duplicate/no-op, or conflicting. Conflicts are unsafe evidence and may be routed to quarantine.

### Tests

- `tests/scenarios/core-idempotency.ts`
- `tests/scenarios/core-quarantine.ts`
- `tests/scenarios/wave2-scenario-audit.ts`
- `tests/scenarios/wave5-scenario-audit.ts`

### Future readers allowed

- runtime engine;
- quarantine;
- audit/reporting;
- future replay/integrity tooling.

---

## 12. Bootstrap FSM — конечный автомат запуска

### Location

- State type: `core/state/src/types.ts`
- Event contract: `core/contracts/src/events.ts`
- Reducer: `core/transitions/src/reducers.ts`
- Runtime integration: `core/runtime/src/runtime-engine.ts`
- ActionGate integration: `core/gates/src/action-gate.ts`

### What it does

Bootstrap FSM makes startup explicit. It prevents the core from treating cold start or partial recovery as a trusted runtime.

Statuses:

- `cold`
- `loading_snapshot`
- `replaying_tail`
- `awaiting_exchange_truth`
- `reconciled`
- `failed`

Optional flag:

- `quarantineRequired`

Main law: normal trading is forbidden until `bootstrap.status === "reconciled"`.

### What it must not do

Bootstrap FSM must not:

- skip required lifecycle steps;
- transition directly from `failed` to `reconciled`;
- authorize trading by itself;
- bypass ActionGate;
- fake exchange truth;
- mutate state outside events/reducers;
- call exchanges.

### Public methods / exports

Types and contracts:

- `BootstrapState`
- `BootstrapStatus`
- `BootstrapPayloadSchema`
- `BootstrapPayload`

Events:

- `bootstrap.loading_snapshot`
- `bootstrap.replaying_tail`
- `bootstrap.awaiting_exchange_truth`
- `bootstrap.reconciled`
- `bootstrap.failed`
- `bootstrap.recovery_started`

Reducer:

- `reduceBootstrapState(prev, event)`

### Returned data

Public output is `snapshot.bootstrap`, a `BootstrapState` inside `RuntimeSnapshot`.

### Tests

- `tests/scenarios/bootstrap-fsm.ts`
- `tests/scenarios/cold-start-unknown.ts`
- `tests/scenarios/gate-scenarios.ts`
- `tests/scenarios/core-action-gate-verdict.ts`
- `tests/scenarios/kernel-authority.ts`
- `tests/scenarios/core-trust-report.ts`

### Future readers allowed

- Kernel Authority;
- CoreTrustReport;
- ActionGate;
- Recovery Planner;
- scenario audit;
- runtime API;
- UI display layer.

---

## Future layer read permissions

| Future layer | May read | Must not do |
|---|---|---|
| V1 adapter, if ever introduced | CoreTrustReport, ActionGate verdicts, RecoveryPlan, snapshot view | compute trust, bypass ActionGate, mutate core state directly |
| V2 adapter, if ever introduced | Same as V1 adapter | compute trust, bypass ActionGate, mutate core state directly |
| UI | read-only display of reports, verdicts, plans, quarantine, ledger, audits | compute trust, authorize actions, execute recovery |
| Strategy layer | may submit future action intent only through a sanctioned API | bypass ActionGate, compute trust, write core state |
| Runtime API | expose read-only trust surfaces and submit validated events/actions through core entry points | compute trust outside Kernel Authority, mutate state outside events |
| Audit/reporting | read all evidence surfaces | authorize actions or perform recovery |
| Recovery orchestration, if ever introduced | read RecoveryPlan and request recovery actions | execute without ActionGate, auto-trade, mutate snapshot directly |

## Release note

This map is documentation-only for Wave 6. It adds no runtime code and intentionally leaves all existing alpha5 logic unchanged.
