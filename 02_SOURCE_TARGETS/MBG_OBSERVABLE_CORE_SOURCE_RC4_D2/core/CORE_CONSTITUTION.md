# MBG Core v0.1 — Core Constitution

Status: normative draft for Trust Kernel Hardening  
Scope: MBG Core v0.1 only  
Base code: `mbg-core-v0.1-alpha9`

This document defines the non-negotiable laws of the Core Trust Kernel.

The constitution does **not** define strategies, signals, decision logic, UI behavior, or V1 behavior. It defines the minimum rules required for the core to start safely, tell the truth about its state, reject invalid inputs, preserve replayability, and explain why an action is forbidden.

## 1. Authority boundary

The Kernel Authority is the canonical trust evaluator for MBG Core v0.1. It is the only authority allowed to evaluate kernel trust state and produce the canonical trust output.

The following are not authority:

- frontend;
- UI state;
- V1;
- strategy modules;
- signal layer;
- decision engine;
- local memory when it conflicts with exchange truth.

A component outside the kernel may request an action or submit an event. It may not calculate core trust, declare the core trusted, override an invariant, bypass replay, or force a trading action.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/contracts/src/events.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/invariants/engine.invariants.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`

## 2. Kernel state classes

The kernel reports one of the following trust classes.

| State | Meaning | Trading action |
|---|---|---|
| `TRUSTED` | Replay, journal, snapshot, invariants, exchange truth, freshness, and gates agree. | May be allowed by `ActionGate`. |
| `RECOVERABLE` | The core is blocked but has a known recovery path. | Forbidden except recovery/diagnostic actions. |
| `UNCERTAIN` | The core cannot prove the truth of one or more required domains. | Forbidden except recovery/diagnostic actions. |
| `COMPROMISED` | Integrity failed, for example replay mismatch, journal corruption, or conflicting duplicate. | Forbidden. Requires recovery procedure. |
| `HALTED` | Runtime is intentionally stopped. | Forbidden except diagnostic/recovery actions explicitly allowed by policy. |
| `PANIC` | Trust is broken or an impossible condition was observed. | Forbidden. Manual recovery required. |

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/kernel/kernel-constitution.ts`
- current: `core/kernel/core-trust-report.ts`

## 3. Core terms

### Event

An event is the only accepted cause of a state transition.

A valid event has a stable identity, type, timestamp, schema-compatible payload, and enough metadata to make journal/replay/idempotency decisions. Invalid events are rejected before journal append and before reducer execution.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/system/journal.ts`
- future: `core/contracts/src/event-envelope.ts`
- future: `core/events/validate-domain-event.ts`

### Snapshot

A snapshot is the current materialized view of runtime state after applying accepted events through reducers.

A snapshot is not trusted merely because it exists. It becomes usable only when it is consistent with replay, journal integrity, invariants, exchange truth, and freshness.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/system/state-hash.ts`
- current: `core/kernel/core-trust-report.ts`

### Reducer

A reducer is a deterministic state transition function.

Given the same prior snapshot and the same accepted event, it must produce the same next snapshot. Reducers must not read frontend state, V1 state, strategies, wall-clock randomness, live exchange data, or hidden mutable globals.

Current/future modules:

- current: `core/transitions/src/reducers.ts`
- future: `core/kernel/reducer-contract.ts`

### Invariant

An invariant is a testable condition that must hold for the core to remain trusted.

Invariant failure does not get ignored for convenience. Depending on severity, it blocks trading, moves the kernel into recovery, or breaks trust completely.

Current/future modules:

- current: `core/invariants/engine.invariants.ts`
- future: `core/invariants/kernel.invariants.ts`

### ActionGate

`ActionGate` is the policy gate that evaluates whether a requested action is allowed from the current proven core state.

The gate must fail closed. A denial must be explainable with machine-readable reason codes and human-readable recovery guidance.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/contracts/src/actions.ts`
- current: `core/kernel/core-trust-report.ts`

### Kernel Authority

Kernel Authority is the composed authority of event validation, journal append, reducer execution, invariant checking, replay verification, exchange truth verification, freshness checks, and action gating.

It is the only component allowed to declare the trust class of the core.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`

### CoreTrustReport

`CoreTrustReport` is the canonical trust output of MBG Core v0.1.

It must expose enough evidence to show why the core is `TRUSTED`, `RECOVERABLE`, `UNCERTAIN`, `COMPROMISED`, `HALTED`, or `PANIC`. It must include failed checks, forbidden actions, machine-readable reason codes, allowed/forbidden action classes, and available recovery hints.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/system/state-hash.ts`
- current: `core/kernel/core-trust-report.ts`

### Bootstrap FSM

The Bootstrap FSM is the explicit state machine that governs startup and trading readiness.

It is responsible for proving whether the core is still cold, loading, replaying, reconciling, recovered, failed, or ready. It must not infer readiness from API reachability, frontend state, V1 state, or a convenient default.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/bootstrap/bootstrap-fsm.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### Event validation

Event validation is a core responsibility.

API schemas may reject malformed requests early, but the canonical decision that a domain event is valid belongs inside the core before journal append, reducer execution, idempotency recording, or snapshot mutation.

Current/future modules:

- current: `core/contracts/src/events.ts`
- future: `core/events/validate-domain-event.ts`
- tests: `tests/scenarios/*`

### Idempotency index

The idempotency index is the recoverable set of event identities already accepted by the core.

It must be derivable from the canonical journal so a restart or replay cannot forget which events were already applied. It is an acceleration structure, not an independent authority over the journal.

Current/future modules:

- current: `core/system/journal.ts`
- future: `core/runtime/event-index.ts`
- tests: `tests/scenarios/*`

### ExchangeTruth

ExchangeTruth is the core domain that represents what the exchange is known to have reported about account, position, order, execution, and connectivity state.

ExchangeTruth is not a strategy signal and not a trading decision. It is evidence used by the core to decide whether local memory may be trusted for normal trading readiness.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/exchange/exchange-truth.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### Freshness Guard

Freshness Guard is the core rule set that decides whether exchange truth, market data, and connectivity evidence are recent enough to be used for normal trading readiness.

Freshness must fail closed. Missing timestamps, unknown age, stale age, or conflicting clocks cannot be treated as fresh.

Current/future modules:

- current: `core/runtime/src/runtime-engine.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/freshness/freshness-guard.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### Health truth

Health truth is the runtime/API health representation of what the core can prove.

Health may report `unknown`, `uncertain`, `degraded`, `blocked`, or equivalent explicit states. It must not report connected, fresh, reconciled, flat, trusted, or healthy unless that fact is proven by core evidence.

Current/future modules:

- current: `core/runtime/src/runtime-engine.ts`
- current: `apps/runtime-api/src/app.ts`
- future: `core/health/runtime-health-snapshot.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

## 4. Laws of the core

### LAW-001 — No event, no state change

State changes only as a consequence of an accepted event applied through a reducer.

Manual mutation, frontend mutation, strategy mutation, V1 mutation, timer mutation, and convenience mutation are not valid causes of state change.

Required proof:

- accepted event exists;
- reducer was selected by event type;
- snapshot revision changes only after reducer application;
- source event id is recorded in state metadata where applicable.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/state/src/types.ts`
- current: `core/kernel/kernel-authority.ts`

### LAW-002 — No trusted state, no trading action

A trading action is forbidden unless the kernel can prove the current state is trusted.

Required proof:

- trust class is `TRUSTED`;
- `ActionGate` allows the action;
- risk is not blocked;
- system is not bootstrapping, degraded, halted, panic, or unreconciled.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/contracts/src/actions.ts`
- current: `core/kernel/core-trust-report.ts`

### LAW-003 — Unknown is safer than fake confidence

When the kernel cannot prove a fact, it must report `unknown`, `uncertain`, or an equivalent blocked state.

It must not invent `flat`, `clear`, `healthy`, or `trusted` state to make startup or execution easier.

Required proof:

- cold start does not claim trusted position without reconciliation;
- cold start does not claim clear risk without trust checks;
- unknown/uncertain domains are surfaced in `CoreTrustReport`.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/kernel/core-trust-report.ts`

### LAW-004 — Position unknown blocks risk

If position is `unknown`, risk is blocked.

A system that cannot prove current exposure may not approve exposure-changing actions.

Required proof:

- `position.status === "unknown"` produces a risk block or gate denial;
- `place_order` is denied while position is unknown;
- report explains the block.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/core-trust-report.ts`

### LAW-005 — Order uncertain blocks risk

If order state is `uncertain`, risk is blocked.

A system that cannot prove whether an order is pending, filled, canceled, or lost may not approve new trading actions.

Required proof:

- `order.status === "uncertain"` denies trading actions;
- recovery actions may remain available;
- report names order uncertainty as a blocking reason.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/core-trust-report.ts`

### LAW-006 — Bootstrap not reconciled forbids trading

During bootstrap, trading is forbidden until required recovery, replay, journal, snapshot, exchange truth, and freshness checks pass.

`bootstrapping` is not a trusted state.

Required proof:

- `system.status === "bootstrapping"` cannot produce trusted report;
- trading action is denied before reconciliation;
- recovery/diagnostic path is explicit.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/bootstrap/bootstrap-fsm.ts`
- current: `core/kernel/core-trust-report.ts`

### LAW-007 — Exchange truth not fresh forbids trading

Normal trading is forbidden when exchange truth is absent, unknown, stale, conflicted, or not reconciled. Stale exchange truth forbids trading remains part of this law.

Fresh local memory is not a substitute for fresh exchange truth.

Required proof:

- exchange truth freshness check exists;
- stale exchange truth blocks trusted report;
- stale exchange truth denies trading actions.

Current/future modules:

- current: `application/exchange/*`
- future: `core/exchange/exchange-truth.ts`
- current: `core/kernel/core-trust-report.ts`

### LAW-008 — Replay mismatch breaks trust

If replayed state does not match the expected snapshot/hash, trust is broken.

The core must not continue as trusted after replay mismatch.

Required proof:

- replay check compares rebuilt state to expected state/hash;
- mismatch is reported as trust failure;
- trading actions are denied after mismatch.

Current/future modules:

- current: `core/system/journal.ts`
- current: `core/system/state-hash.ts`
- future: `core/replay/replay-check.ts`
- current: `core/kernel/core-trust-report.ts`

### LAW-009 — Invalid event never enters journal

Invalid events are rejected before journal append and before reducer execution.

Required proof:

- event schema validation runs before append;
- rejection result is explicit;
- no journal entry is written for invalid event;
- no state mutation occurs.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/system/journal.ts`
- future: `core/events/validate-domain-event.ts`

### LAW-010 — Duplicate event does not change state

An event already applied by identity is idempotent.

A duplicate with identical content must not change state again. A duplicate identity with different content is an integrity failure.

Required proof:

- applied event identity is checked before reducer execution;
- duplicate identical event returns duplicate/ignored result;
- duplicate identity with conflicting payload blocks or panics;
- snapshot revision does not advance for ignored duplicate.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/system/journal.ts`
- future: `core/runtime/event-index.ts`

### LAW-011 — No fill, no PnL

PnL may only be derived from proven execution/fill data.

Signals, intents, market ticks, UI clicks, strategy claims, or V1 claims do not create PnL.

Required proof:

- PnL mutation has execution/fill origin;
- missing fill origin blocks or rejects PnL mutation;
- CoreTrustReport can expose PnL provenance failure.

Current/future modules:

- current: `core/pnl/pnl-engine.ts`
- current: `core/contracts/src/events.ts`
- future: `core/invariants/pnl.invariants.ts`

### LAW-012 — Live order without metadata is forbidden

A live order must carry required metadata for traceability and recovery.

The kernel must be able to connect a live order to its event, request, client order id, journal entry, and strategy-independent provenance.

Required proof:

- live order request includes metadata;
- missing metadata denies live order action;
- journal can link order to source event/request.

Current/future modules:

- current: `core/strategy/order-metadata-store.ts`
- current: `core/strategy/trade-metadata.ts`
- current: `engine/execution/execution.service.ts`
- future: `core/orders/order-metadata-contract.ts`

Note: current metadata modules are historical PR35 implementation points. They are not strategy authority.

### LAW-013 — Exchange truth outranks local memory

When exchange truth conflicts with local memory, the kernel must prefer exchange truth and block until reconciled.

Local snapshot is not authority over exchange account, position, open order, or execution truth.

Required proof:

- conflict detection exists;
- conflict blocks trusted report;
- reconciliation path is explicit;
- local state is not silently preferred.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- current: `tests/scenarios/position-reconcile.ts`
- future: `core/exchange/exchange-truth.ts`
- current: `core/kernel/kernel-authority.ts`

### LAW-014 — Frontend is not authority

Frontend may display state and request actions. It may not certify trust, mutate snapshot, bypass gates, override replay, or override exchange truth.

Required proof:

- frontend submits actions/events only through kernel interfaces;
- action decision comes from `ActionGate`/Kernel Authority;
- UI state is not accepted as trusted state.

Current/future modules:

- current: `apps/runtime-api/*`
- current: `core/kernel/kernel-authority.ts`

### LAW-015 — V1 is not authority

V1 may not define MBG Core v0.1 trust.

V1 may not certify state, approve trading, override event validation, override replay, override exchange truth, or bypass ActionGate.

Required proof:

- MBG Core v0.1 does not import V1 as authority;
- any future V1 integration is downstream of kernel trust;
- V1 output is treated as untrusted input unless converted into valid kernel events.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- future: `core/adapters/v1-input-adapter.ts`


### LAW-016 — Bootstrap FSM governs trading readiness

Trading readiness is governed by the Bootstrap FSM and `ActionGate`, not by process uptime, API availability, frontend state, V1, or a manually set flag.

Required proof:

- bootstrap state is represented explicitly;
- unreconciled, failed, loading, replaying, or uncertain bootstrap states cannot allow trading;
- only a proven reconciled/ready bootstrap path may participate in trading readiness;
- `ActionGate` consumes bootstrap evidence and fails closed when readiness is not proven.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/bootstrap/bootstrap-fsm.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-017 — Event validation is core responsibility

Event validation is performed inside the core. API validation is allowed as an early filter but is not authority.

Required proof:

- the core validates domain events before journal append;
- the core validates domain events before reducer execution;
- bypassing the API cannot create a canonical event;
- invalid event rejection is explicit and testable.

Current/future modules:

- current: `core/contracts/src/events.ts`
- future: `core/events/validate-domain-event.ts`
- tests: `tests/scenarios/*`

### LAW-018 — Idempotency index is recoverable from journal

The applied-event idempotency index must be rebuildable from the canonical journal.

A restart, replay, or recovery path must not lose duplicate-event knowledge. If the index conflicts with the journal, the journal is the source of reconstruction and the conflict is a trust problem.

Required proof:

- accepted event identities are represented in or derivable from journal entries;
- replay can rebuild the applied-event index;
- duplicate detection works after restart/replay;
- an index-only state is not trusted if it cannot be traced to the journal.

Current/future modules:

- current: `core/system/journal.ts`
- future: `core/runtime/event-index.ts`
- tests: `tests/scenarios/*`

### LAW-019 — Reducers remain pure

Reducers are pure deterministic functions over prior snapshot and accepted event.

Reducers must not perform journal I/O, API calls, exchange calls, clock reads for decisions, random reads, frontend reads, V1 reads, strategy reads, or hidden global mutation.

Required proof:

- reducer output depends only on prior state and accepted event;
- side effects happen outside reducers;
- reducer tests can replay identical inputs and receive identical outputs;
- reducers do not validate authority by consulting external systems.

Current/future modules:

- current: `core/transitions/src/reducers.ts`
- future: `core/kernel/reducer-contract.ts`
- tests: `tests/scenarios/*`

### LAW-020 — Duplicate event cannot mutate state

A duplicate event identity cannot mutate snapshot, advance revision, recalculate PnL, create orders, unblock risk, or change trust state.

A duplicate with identical content may be reported as ignored. A duplicate identity with different content is an integrity failure and must not be reduced.

Required proof:

- duplicate detection runs before reducer execution;
- ignored duplicate keeps snapshot revision unchanged;
- conflicting duplicate is reported as integrity failure;
- duplicate handling is covered by scenario tests.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/system/journal.ts`
- future: `core/runtime/event-index.ts`
- tests: `tests/scenarios/*`

### LAW-021 — Invalid event never enters canonical journal

Invalid events must not be appended to the canonical journal.

They may be returned as explicit rejections or recorded in a separate non-canonical rejection/audit channel, but they must not become replay input for trusted state.

Required proof:

- canonical journal append happens only after core validation succeeds;
- invalid event rejection does not affect snapshot revision;
- replay input excludes invalid rejected events;
- scenario tests prove invalid-event rejection before journal append.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/system/journal.ts`
- future: `core/events/validate-domain-event.ts`
- tests: `tests/scenarios/*`

### LAW-022 — Bootstrap failed cannot transition to reconciled without recovery event

A failed bootstrap state cannot transition to reconciled, ready, or trusted by direct assignment, restart optimism, API request, UI action, V1 output, or strategy output.

It may leave failed state only through an accepted recovery event that is validated, journaled, reduced, replayable, and auditable.

Required proof:

- bootstrap failure is represented explicitly;
- direct failed-to-reconciled transition is forbidden;
- recovery transition requires an accepted recovery event;
- recovery event is present in journal and replay;
- scenario tests cover failed bootstrap recovery gating.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/bootstrap/bootstrap-fsm.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`


### LAW-023 — ExchangeTruth unknown forbids normal trading

Normal trading is forbidden when exchange truth is unknown.

Unknown exchange truth includes missing account truth, missing position truth, missing open-order truth, missing execution truth, unknown connection state, or any equivalent absence of exchange evidence required by the requested action.

Required proof:

- exchange truth state is explicit, not inferred from local snapshot defaults;
- unknown exchange truth blocks normal trading through `ActionGate`;
- diagnostic and recovery actions remain distinguishable from normal trading;
- scenario tests prove unknown exchange truth cannot be treated as trusted.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/exchange/exchange-truth.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-024 — ExchangeTruth stale forbids normal trading

Normal trading is forbidden when exchange truth is stale.

A stale exchange truth record is not fresh evidence. It may remain useful for diagnostics or recovery, but it must not be used to authorize ordinary trading actions.

Required proof:

- exchange truth freshness age or expiry is explicit;
- stale exchange truth blocks normal trading through `ActionGate`;
- stale evidence is not upgraded to fresh by API reachability, frontend state, V1, strategy output, or local memory;
- scenario tests prove stale exchange truth blocks normal trading.

Current/future modules:

- current: `core/runtime/src/runtime-engine.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/exchange/exchange-truth.ts`
- future: `core/freshness/freshness-guard.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-025 — ExchangeTruth conflicted forbids normal trading

Normal trading is forbidden when exchange truth conflicts with local memory, replayed state, order state, position state, or another accepted exchange truth record.

Conflict is an integrity signal. The core must block and expose the conflict for diagnostics or recovery instead of choosing the convenient state.

Required proof:

- exchange truth conflict state is explicit;
- conflicting truth blocks normal trading through `ActionGate`;
- conflict cannot be hidden by local snapshot defaults;
- scenario tests prove conflicted exchange truth blocks normal trading.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/exchange/exchange-truth.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-026 — Market data stale forbids normal trading

Normal trading is forbidden when required market data is stale, missing, or of unknown age.

Market data freshness is not proven by process uptime or websocket connection state alone. The core must have fresh market evidence for actions that depend on market price, spread, liquidity, or risk valuation.

Required proof:

- market data freshness is explicit;
- stale market data blocks normal trading through `ActionGate`;
- unknown market data age is treated as stale for normal trading;
- scenario tests prove stale market data blocks normal trading.

Current/future modules:

- current: `application/market/*`
- current: `core/runtime/src/runtime-engine.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/freshness/freshness-guard.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-027 — Health must not report fake truth

Runtime health and API health must report only what the core can prove.

Health must not report connected, reconciled, fresh, flat, healthy, trusted, or safe when the underlying state is unknown, stale, conflicted, unreconciled, bootstrapping, or blocked.

Required proof:

- health fields distinguish proven facts from unknown facts;
- unknown connection state is not reported as connected;
- local flat position is not reported as trusted without fresh exchange reconcile;
- health cannot become authority over `ActionGate`;
- scenario tests prove health truth cleanup cases.

Current/future modules:

- current: `core/runtime/src/runtime-engine.ts`
- current: `apps/runtime-api/src/app.ts`
- future: `core/health/runtime-health-snapshot.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-028 — Unknown connection state is not connected

Unknown connection state must not be treated as connected.

A missing heartbeat, missing exchange status, uninitialized connector, failed connector probe, or unknown connector lifecycle state is blocked evidence, not a connected state.

Required proof:

- connection state has explicit unknown/not connected semantics;
- unknown connection state prevents normal trading where exchange connectivity is required;
- health does not report unknown connection as connected;
- scenario tests prove unknown connection state is not connected.

Current/future modules:

- current: `application/exchange/*`
- current: `core/runtime/src/runtime-engine.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/health/runtime-health-snapshot.ts`
- future: `core/freshness/freshness-guard.ts`
- tests: `tests/scenarios/*`

### LAW-029 — Local flat position is not trusted without fresh exchange reconcile

A local flat position is not trusted merely because the local snapshot says zero.

Normal trading may rely on a flat position only after a fresh exchange reconcile proves that the exchange position is also flat or otherwise reconciled according to the core policy.

Required proof:

- local flat position and exchange-reconciled flat position are distinct states;
- flat local memory does not unblock risk by itself;
- fresh exchange reconcile is required before normal trading uses flatness;
- scenario tests prove local flat without fresh reconcile remains blocked.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- current: `tests/scenarios/position-reconcile.ts`
- future: `core/exchange/exchange-truth.ts`
- future: `core/freshness/freshness-guard.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-030 — Freshness unknown is stale for normal trading

Unknown freshness is not fresh.

When the core cannot prove the freshness of exchange truth, market data, health inputs, or connection evidence, normal trading must be forbidden until a fresh accepted event or recovery process establishes current evidence.

Required proof:

- freshness state distinguishes fresh, stale, unknown, and conflicted where applicable;
- unknown freshness blocks normal trading through `ActionGate`;
- runtime health does not convert unknown freshness into healthy;
- scenario tests prove unknown freshness blocks normal trading.

Current/future modules:

- current: `core/runtime/src/runtime-engine.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/freshness/freshness-guard.ts`
- future: `core/health/runtime-health-snapshot.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`


### LAW-031 — Kernel Authority is the canonical trust evaluator

The Kernel Authority is the canonical evaluator of MBG Core trust.

No frontend, V1/V2 component, strategy, signal layer, decision engine, API convenience field, or local runtime shortcut may calculate or override core trust.

Required proof:

- trust state is evaluated by Kernel Authority rules;
- other components consume the trust result instead of recalculating it;
- trust inputs are explicit and traceable;
- scenario tests prove external layers cannot act as trust authority.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- tests: `tests/scenarios/*`

### LAW-032 — Kernel Authority must be pure

Kernel Authority must be a pure evaluator.

It may read accepted kernel evidence and return trust evaluation. It must not mutate runtime snapshot, journal, bootstrap state, exchange truth, freshness state, health truth, ActionGate state, or any other core state.

Required proof:

- Kernel Authority has no write path to canonical journal;
- Kernel Authority has no reducer side effects;
- repeated evaluation over the same inputs returns the same report;
- scenario tests or contract tests prove evaluation does not change revision or snapshot.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/system/journal.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- tests: `tests/scenarios/*`

### LAW-033 — CoreTrustReport is the canonical trust output

CoreTrustReport is the canonical output of kernel trust.

It must be the single report used to explain whether the core is trusted now, why it is or is not trusted, which action classes are allowed or denied, and what recovery hints are available.

Required proof:

- report includes kernel trust state;
- report includes failed checks and machine-readable reasons;
- report includes allowed and denied action classes;
- report does not hide unknown, stale, conflicted, or unreconciled evidence.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/runtime/src/runtime-engine.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- tests: `tests/scenarios/*`

### LAW-034 — Frontend must not calculate trust

Frontend must not calculate, infer, cache, override, or display invented core trust.

Frontend may display CoreTrustReport and ActionGate verdicts produced by the core. It may not turn API availability, websocket status, button state, or local UI state into trust.

Required proof:

- frontend is not a trust authority;
- UI state is not a trust input unless represented as a valid accepted kernel event;
- frontend cannot approve a denied action;
- scenario tests prove trust comes from core outputs.

Current/future modules:

- current: `apps/runtime-api/src/app.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- tests: `tests/scenarios/*`

### LAW-035 — V1 must not calculate core trust

V1 must not calculate, certify, override, or backfill MBG Core v0.1 trust.

Any future V1/V2 integration must remain downstream of kernel trust and may only submit valid events or consume core reports through explicit adapters.

Required proof:

- MBG Core v0.1 does not import V1/V2 as trust authority;
- V1/V2 cannot declare `TRUSTED`;
- V1/V2 cannot bypass ActionGate;
- scenario tests prove V1/V2 are not trust sources.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- future: `core/adapters/v1-input-adapter.ts`
- tests: `tests/scenarios/*`

### LAW-036 — Every denied action must have machine-readable reasons

Every denied action must return machine-readable reasons.

A denial without structured reason codes is not an acceptable kernel verdict because it cannot be audited, replayed, tested, or used by recovery tooling.

Required proof:

- denied ActionGate verdicts include stable reason codes;
- denied verdicts identify the blocking law or domain where possible;
- human text is optional, machine-readable reason codes are mandatory;
- scenario tests assert denial reasons, not only boolean denial.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- tests: `tests/scenarios/*`

### LAW-037 — Trust state must be explainable

Every kernel trust state must be explainable from accepted evidence.

The core may not report `TRUSTED`, `RECOVERABLE`, `UNCERTAIN`, `COMPROMISED`, `HALTED`, or `PANIC` without the evidence and reasons that justify that state.

Required proof:

- each trust state has reason codes;
- unknown evidence produces `UNCERTAIN` or stricter state, not fake `TRUSTED`;
- integrity failure produces `COMPROMISED` or `PANIC`;
- halted state is distinguishable from healthy trusted state.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/invariants/engine.invariants.ts`
- current: `core/system/state-hash.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- tests: `tests/scenarios/*`

### LAW-038 — ActionGate must use kernel trust state

ActionGate must use kernel trust state when evaluating unsafe actions.

Normal trading or other unsafe action classes must not be allowed unless Kernel Authority evidence permits the required trust state and the action-specific gate checks also pass.

Required proof:

- ActionGate consumes kernel trust state or equivalent canonical trust evaluation;
- unsafe actions are denied for `RECOVERABLE`, `UNCERTAIN`, `COMPROMISED`, `HALTED`, and `PANIC`;
- ActionGate Verdict v2 includes denial reasons and trust state evidence;
- scenario tests prove unsafe actions cannot bypass Kernel Authority evaluation.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/state/src/types.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- tests: `tests/scenarios/*`



### LAW-039 — Invalid or suspicious data must not enter canonical journal

Invalid or suspicious data must not enter the canonical journal.

A rejected event, malformed payload, idempotency conflict, poison input, or unverifiable exchange/health/freshness evidence may be preserved for diagnosis, but it must not become canonical runtime history.

Required proof:

- event validation rejects invalid data before canonical append;
- suspicious evidence is routed outside the canonical journal;
- rejected evidence cannot be replayed as accepted state history;
- scenario tests prove invalid or suspicious inputs do not become canonical entries.

Current/future modules:

- current: `core/events/validate-domain-event.ts`
- current: `core/runtime/event-index.ts`
- current: `core/system/journal.ts`
- current: `core/quarantine/quarantine.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-040 — Quarantined data must not mutate runtime state

Quarantined data must not mutate runtime state.

Quarantine may preserve rejected evidence for audit and diagnosis. It must not increment runtime revision, update snapshot fields, affect PnL, change positions, change orders, or mark bootstrap/recovery/trust state as complete.

Required proof:

- quarantine writes are outside reducers and canonical snapshot mutation;
- quarantined records do not increment runtime revision;
- quarantined fills do not change PnL or position;
- scenario tests prove quarantine is a no-op for runtime state.

Current/future modules:

- current: `core/transitions/src/reducers.ts`
- current: `core/runtime/src/runtime-engine.ts`
- current: `core/quarantine/quarantine.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-041 — Quarantine is diagnostic, not canonical history

Quarantine is diagnostic storage, not canonical state history.

Quarantine records may explain rejected, suspicious, duplicated, conflicted, or malformed evidence. They are not accepted domain events and must not be used as the source of canonical replay.

Required proof:

- quarantine storage is distinct from canonical journal storage;
- canonical replay ignores quarantine records;
- quarantine records are marked as rejected/suspicious/diagnostic evidence;
- scenario tests prove quarantine cannot backfill trusted state.

Current/future modules:

- current: `core/system/journal.ts`
- current: `core/events/validate-domain-event.ts`
- current: `core/runtime/event-index.ts`
- current: `core/quarantine/quarantine.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-042 — Every ActionGate verdict must be auditable

Every ActionGate verdict must be auditable.

An allowed or denied verdict must preserve enough structured evidence to explain what was requested, what trust state was used, what reasons applied, and which law or domain justified the result.

Required proof:

- ActionGate verdicts include stable action identity, decision, trust state, and reason codes;
- allowed verdicts are auditable, not only denied verdicts;
- verdict audit data is append-only diagnostic/audit evidence;
- scenario tests assert verdict audit records for both allow and deny paths.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-043 — Permission Ledger records allow and deny decisions

Permission Ledger records allow and deny decisions.

The Permission Ledger is an audit trail for ActionGate decisions. It must record both permissions and rejections so that trust decisions can be reviewed, replayed as audit evidence, and correlated with machine-readable reasons.

Required proof:

- allow decisions are recorded;
- deny decisions are recorded;
- ledger records include stable reason codes and action identity;
- scenario tests prove both allow and deny verdicts are present in the ledger.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/kernel/core-trust-report.ts`
- tests: `tests/scenarios/*`

### LAW-044 — Recovery Planner suggests actions but does not execute them

Recovery Planner suggests actions but does not execute them.

A recovery plan is a recommendation derived from trust evidence, blocking reasons, and safe next-action classes. It must not mutate state, submit orders, reconcile automatically, append canonical events, or perform external exchange operations.

Required proof:

- recovery output is a plan, not an executor;
- planner has no write path to runtime snapshot, canonical journal, exchange client, or ActionGate bypass;
- proposed recovery actions are machine-readable and explicit;
- scenario tests prove generating a recovery plan does not change state.

Current/future modules:

- current: `core/recovery/recovery-planner.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-045 — Recovery actions must still pass ActionGate

Recovery actions must still pass ActionGate.

A recovery plan may suggest diagnostic or recovery action classes, but execution of any proposed recovery action remains subject to ActionGate and kernel trust constraints.

Required proof:

- recovery plans cannot bypass ActionGate;
- recovery action requests receive ActionGate Verdict v2;
- denied recovery actions have machine-readable reasons;
- scenario tests prove recovery suggestions are not self-authorizing.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/recovery/recovery-planner.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-046 — Normal trading remains forbidden until recovery conditions are satisfied

Normal trading remains forbidden until recovery conditions are satisfied.

A blocked, uncertain, recoverable, compromised, halted, or panic state must not allow normal trading merely because a recovery plan exists. Normal trading may only be considered after the required recovery evidence has been accepted and the kernel trust evaluation permits it.

Required proof:

- recovery plan presence does not imply `TRUSTED`;
- normal trading remains denied while required recovery evidence is missing;
- accepted recovery evidence must pass validation, journal, replay, freshness, health, and ActionGate requirements;
- scenario tests prove recovery suggestions do not unblock trading by themselves.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/recovery/recovery-planner.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-047 — Permission Ledger must not mutate trading state

Permission Ledger must not mutate trading state.

The Permission Ledger records decisions for audit. It must not change positions, orders, PnL, bootstrap status, exchange truth, freshness, health truth, runtime snapshot, or any trading-related state.

Required proof:

- ledger append is separate from domain reducers;
- ledger records do not increment canonical runtime revision;
- ledger records do not alter snapshot, positions, orders, or PnL;
- scenario tests prove permission audit writes are not trading state mutations.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/kernel/kernel-authority.ts`
- tests: `tests/scenarios/*`

### LAW-048 — Quarantine must preserve rejected evidence

Quarantine must preserve rejected evidence.

Rejected, suspicious, malformed, duplicate-conflict, or conflicted data should be retained as diagnostic evidence with enough metadata to support audit, debugging, and recovery planning without making it canonical history.

Required proof:

- quarantine records preserve original evidence where safe to store;
- quarantine records include rejection reason codes and timestamps;
- duplicate_conflict and validation failures can be diagnosed from quarantine evidence;
- scenario tests prove rejected evidence is retained outside canonical history.

Current/future modules:

- current: `core/events/validate-domain-event.ts`
- current: `core/runtime/event-index.ts`
- current: `core/quarantine/quarantine.ts`
- current: `core/recovery/recovery-planner.ts`
- current: `core/permissions/permission-ledger.ts`
- tests: `tests/scenarios/*`


### LAW-049 — Every committed event must have a stable event hash

Every committed event must have a stable event hash.

An accepted canonical event must be hashable in a deterministic way. The hash must be derived from the canonical event representation, not from transient runtime objects, local formatting, wall-clock reads, UI state, or non-canonical metadata.

Required proof:

- every committed canonical event exposes or can derive a stable event hash;
- the same canonical event produces the same event hash across replay;
- the event hash is recorded or reproducible for transition evidence;
- unknown hash is reported as unknown evidence, not as proof of corruption.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/system/journal.ts`
- current: `core/runtime/src/runtime-engine.ts`
- future: `core/hash/event-hash.ts`
- tests: `tests/scenarios/*`

### LAW-050 — Every produced snapshot must have a deterministic snapshot hash

Every produced snapshot must have a deterministic snapshot hash.

A runtime snapshot hash must be derived from a canonical representation of the snapshot. The same snapshot content must produce the same hash, independent of object key ordering, process memory layout, UI rendering, or local debug formatting.

Required proof:

- produced snapshots have a deterministic snapshot hash or explicitly report hash evidence as unknown;
- replayed snapshots with the same canonical content produce the same hash;
- snapshot hash evidence is not calculated by frontend, V1, strategies, or UI;
- hash unknown is not treated as trusted proof.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/system/state-hash.ts`
- current: `core/runtime/src/runtime-engine.ts`
- future: `core/hash/snapshot-hash.ts`
- tests: `tests/scenarios/*`

### LAW-051 — Every transition must link before snapshot, event, and after snapshot

Every transition must link before snapshot, event, and after snapshot.

A transition is not fully explainable unless it records or can derive the prior snapshot identity, the accepted event identity/hash, the reducer/transition that was executed, and the resulting snapshot identity.

Required proof:

- transition evidence links `beforeSnapshotHash`, `eventHash`, and `afterSnapshotHash` when available;
- transition evidence identifies the reducer or transition name;
- transition links are deterministic under replay;
- missing transition evidence is reported as unknown, not trusted.

Current/future modules:

- current: `core/transitions/src/reducers.ts`
- current: `core/runtime/src/runtime-engine.ts`
- current: `core/kernel/core-trust-report.ts`
- future: `core/causality/transition-trace.ts`
- tests: `tests/scenarios/*`

### LAW-052 — Snapshot revision must match applied event revision

Snapshot revision must match applied event revision.

The snapshot revision must advance only when an accepted canonical event is applied. A snapshot claiming revision `N` must be explainable by the accepted event sequence through revision `N`.

Required proof:

- duplicate events do not advance snapshot revision;
- rejected or quarantined data does not advance snapshot revision;
- applied event revision and resulting snapshot revision are linked in transition evidence;
- revision gaps or impossible jumps are treated as trust failures.

Current/future modules:

- current: `core/state/src/types.ts`
- current: `core/system/journal.ts`
- current: `core/runtime/event-index.ts`
- current: `core/runtime/src/runtime-engine.ts`
- tests: `tests/scenarios/*`

### LAW-053 — Hash chain discontinuity is a corruption signal

Hash chain discontinuity is a corruption signal.

A proven break between event hash, prior snapshot hash, transition evidence, and resulting snapshot hash is evidence of corrupted history. The kernel must not report trusted state when hash chain continuity is proven broken.

Required proof:

- hash chain discontinuity blocks `TRUSTED`;
- proven discontinuity is reported as `COMPROMISED` or `PANIC` according to severity;
- unknown hash evidence is not reported as continuity proof;
- scenario tests distinguish unknown hash evidence from proven mismatch.

Current/future modules:

- current: `core/system/journal.ts`
- current: `core/system/state-hash.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- future: `core/integrity/snapshot-hash-chain.ts`
- tests: `tests/scenarios/*`

### LAW-054 — Causality trace must explain every state transition

Causality trace must explain every state transition.

For every accepted state transition, the kernel must be able to explain the causal path from prior snapshot through accepted event and reducer to resulting snapshot. A state that cannot explain its cause must not be presented as fully trusted.

Required proof:

- every accepted transition has a causality trace or explicit unknown evidence;
- causality trace includes event identity/hash, transition identity, prior revision, and resulting revision;
- reducers remain pure so the trace can be replayed;
- scenario tests prove state transitions are causally explainable.

Current/future modules:

- current: `core/transitions/src/reducers.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/kernel/kernel-authority.ts`
- future: `core/trace/causality-trace.ts`
- tests: `tests/scenarios/*`

### LAW-055 — Trust state changes must be causally explainable

Trust state changes must be causally explainable.

A transition between trust states such as `UNCERTAIN`, `RECOVERABLE`, `COMPROMISED`, `PANIC`, or `TRUSTED` must be explained by evidence. The kernel must not silently upgrade or downgrade trust state without machine-readable causes.

Required proof:

- trust state changes cite the evidence that caused the change;
- upgrades to `TRUSTED` require complete positive evidence;
- downgrades cite replay, hash, freshness, exchangeTruth, health, invariant, quarantine, or permission evidence;
- unknown evidence may cause `UNCERTAIN`, but not fake `TRUSTED`.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/trace/causality-trace.ts`
- tests: `tests/scenarios/*`

### LAW-056 — ActionGate verdict must reference snapshot revision and causality trace when available

ActionGate verdict must reference snapshot revision and causality trace when available.

An ActionGate verdict must be auditable against the state it evaluated. When snapshot revision and causality trace evidence are available, the verdict must reference them so allow/deny decisions can be traced to the evaluated kernel state.

Required proof:

- ActionGate Verdict v2 includes snapshot revision when available;
- ActionGate Verdict v2 references causality trace evidence when available;
- denied verdicts retain machine-readable reasons;
- missing revision or trace evidence is reported as unknown and cannot create fake confidence.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/kernel/core-trust-report.ts`
- future: `core/trace/causality-trace.ts`
- tests: `tests/scenarios/*`

### LAW-057 — Replay mismatch with hash evidence marks kernel COMPROMISED or PANIC

Replay mismatch with hash evidence must mark kernel as `COMPROMISED` or `PANIC` depending on severity.

When replay produces a mismatch supported by event hash, snapshot hash, or hash-chain evidence, the kernel must not remain `TRUSTED`, `RECOVERABLE`, or merely healthy. Severity decides whether the state is `COMPROMISED` or `PANIC`.

Required proof:

- replay mismatch with hash evidence blocks normal trading;
- hash-backed corruption is reported in CoreTrustReport reasons;
- recoverable mismatch is not treated as trusted;
- impossible or unsafe corruption escalates to `PANIC`.

Current/future modules:

- current: `core/system/journal.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- future: `core/integrity/snapshot-hash-chain.ts`
- tests: `tests/scenarios/*`

### LAW-058 — Unknown hash is not corruption; proven mismatch is corruption

Unknown hash is not corruption; proven mismatch is corruption.

The kernel must distinguish lack of hash evidence from contradictory hash evidence. Unknown hash evidence may keep the kernel `UNCERTAIN` or blocked, but it must not be reported as corruption. Proven mismatch is corruption evidence and must break trust.

Required proof:

- unknown hash evidence is represented as unknown;
- unknown hash evidence does not produce fake `TRUSTED`;
- unknown hash evidence does not falsely mark corruption;
- proven mismatch marks trust as broken.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/system/state-hash.ts`
- future: `core/integrity/snapshot-hash-chain.ts`
- tests: `tests/scenarios/*`




### LAW-059 — Explicit Provenance Principle

Every action must have provenance.

An action request is not self-explanatory. The kernel must be able to identify the accepted event evidence, metadata event evidence, causation chain, actor/source context, and trace references that explain why the action exists and why it may be evaluated.

Required proof:

- each action evaluated by ActionGate has provenance evidence or an explicit provenance status of `unknown`;
- provenance is represented as kernel evidence, not frontend decoration;
- provenance links to event, transition, snapshot, trust report, and verdict evidence when available;
- missing provenance blocks risk-increasing actions.

Current/future modules:

- current: `core/contracts/src/actions.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/trace/causality-trace.ts`
- future: `core/provenance/provenance.ts`
- tests: `tests/scenarios/*`

### LAW-060 — Replay Is Sacred

Replay determinism is sacred.

A replay must reproduce the same accepted history and the same derived evidence from the same canonical journal. Metadata and provenance must not introduce nondeterminism through wall-clock reads, random values, process memory, UI state, or mutable side bags.

Required proof:

- metadata/provenance changes are event-sourced;
- replay does not depend on `Date.now()`, random values, runtime memory, UI state, or external mutable caches;
- replay produces the same metadata/provenance evidence from the same canonical event sequence;
- nondeterministic provenance generation is forbidden.

Current/future modules:

- current: `core/system/journal.ts`
- current: `core/runtime/src/runtime-engine.ts`
- current: `core/integrity/snapshot-hash-chain.ts`
- current: `core/trace/causality-trace.ts`
- future: `core/provenance/provenance.ts`
- tests: `tests/scenarios/*`

### LAW-061 — Observable First

Observability first, execution later.

Wave 8 provenance exists to make actions, metadata, replay, and traces observable and auditable before any new execution behavior is allowed. Observability must not be used as a hidden execution path.

Required proof:

- provenance evidence can be inspected without authorizing execution;
- adding observability does not weaken ActionGate, trust logic, integrity checks, or replay checks;
- provenance records explain what happened and why; they do not execute recovery, trading, or strategy behavior;
- no UI control, live trading path, or strategy decision is introduced by provenance work.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/trace/causality-trace.ts`
- future: `core/provenance/provenance.ts`
- tests: `tests/scenarios/*`

### LAW-062 — Metadata as Events

Metadata changes only through events.

Metadata is not a mutable side bag. A metadata change that affects provenance, risk, audit, replay, or action evaluation must enter the kernel as an accepted event and must participate in validation, idempotency, journal, hash-chain, and causality rules.

Required proof:

- metadata changes are represented by accepted canonical events;
- metadata events pass core event validation before entering the canonical journal;
- duplicate metadata events do not mutate state twice;
- metadata events are hashable, replay-safe, and causally traceable;
- metadata side bags are not treated as authority.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/events/validate-domain-event.ts`
- current: `core/runtime/event-index.ts`
- current: `core/system/journal.ts`
- current: `core/integrity/snapshot-hash-chain.ts`
- current: `core/trace/causality-trace.ts`
- future: `core/provenance/provenance.ts`
- tests: `tests/scenarios/*`

### LAW-063 — Metadata is Provenance Evidence

Metadata is not decoration. Metadata is provenance evidence.

Metadata that explains source, causation, actor, request identity, correlation, intent, or action context is part of the evidence used to understand the kernel history. It must be deterministic, auditable, traceable, and replay-safe.

Required proof:

- metadata used for provenance is stored or derivable as accepted event evidence;
- metadata evidence is visible to audit and trace outputs where relevant;
- metadata evidence is not generated by frontend, UI state, random values, wall-clock reads, or runtime-only memory;
- metadata cannot contradict canonical event, hash-chain, or causality evidence without producing a diagnostic conflict.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/trace/causality-trace.ts`
- current: `core/permissions/permission-ledger.ts`
- future: `core/provenance/provenance.ts`
- tests: `tests/scenarios/*`

### LAW-064 — Missing Provenance Blocks Risk

Risk-increasing actions require valid provenance.

A risk-increasing action must not be allowed when its provenance is missing, invalid, stale, conflicted, or not replay-safe. Missing provenance blocks normal risk, but it must be reported honestly as missing or unknown provenance rather than as proven corruption.

Required proof:

- ActionGate denies risk-increasing actions without valid provenance;
- denial verdicts include machine-readable provenance reasons;
- permission ledger records provenance-related allow/deny decisions;
- missing provenance does not bypass trust, integrity, replay, or ActionGate checks.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/permissions/permission-ledger.ts`
- future: `core/provenance/provenance.ts`
- tests: `tests/scenarios/*`

### LAW-065 — Unknown provenance is not corruption by default

Unknown provenance is not corruption by default.

`unknown provenance != corruption`; `proven mismatch == corruption`. Unknown provenance may keep the kernel `UNCERTAIN`, block risk-increasing actions, or require recovery evidence. It must not be escalated to `COMPROMISED` or `PANIC` unless there is contradictory evidence such as hash mismatch, causality conflict, invalid event proof, or provenance mismatch.

Required proof:

- unknown provenance is represented as unknown evidence;
- unknown provenance blocks risk without falsely marking corruption;
- proven provenance mismatch is treated as corruption evidence;
- severity distinguishes `UNCERTAIN`, `COMPROMISED`, and `PANIC`.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/integrity/snapshot-hash-chain.ts`
- current: `core/trace/causality-trace.ts`
- future: `core/provenance/provenance.ts`
- tests: `tests/scenarios/*`

### Wave 8 provenance invariants

The following invariants are required for Metadata as Events / Provenance Layer work:

1. provenance is explicit evidence, not implicit runtime context;
2. metadata that affects trust, risk, audit, replay, or action evaluation changes only through events;
3. metadata/provenance events must be validated before canonical journaling;
4. metadata/provenance events must be idempotent and replay-safe;
5. metadata/provenance evidence must participate in hash-chain and causality trace when available;
6. ActionGate must deny risk-increasing actions with missing or invalid provenance;
7. unknown provenance blocks risk but is not corruption by default;
8. proven provenance mismatch is corruption evidence;
9. provenance observability must not become execution, recovery execution, strategy logic, or UI control;
10. provenance must not become a second source of truth.

### Wave 8 red lines

The kernel must not:

- allow risk-increasing actions without valid provenance;
- treat mutable metadata side bags as authority;
- generate provenance through `Date.now()`, random values, runtime-only memory, UI state, or frontend calculations;
- bypass ActionGate, trust logic, integrity checks, or replay checks through provenance;
- use provenance work to introduce V1, V2, UI controls, strategy logic, execution, live trading, or real exchange keys;
- break Wave 7 hash-chain and causality trace evidence.




### LAW-066 — Market input is not truth by default

Market input is not truth by default.

A market observation is an input to the kernel, not an authority. It cannot declare itself true, fresh, ordered, reconciled, trusted, or sufficient for trading. Market input must be treated as evidence that still requires validation, provenance, freshness lineage, ordering checks, replay safety, and trust evaluation.

Required proof:

- market input is represented as input evidence, not as canonical truth by arrival alone;
- market input cannot override exchange truth, Kernel Authority, CoreTrustReport, ActionGate, replay, or integrity evidence;
- market input cannot mark the kernel `TRUSTED` by itself;
- market input status may be `unknown`, `invalid`, `stale`, `gap_detected`, `mismatch`, or equivalent without becoming trading permission.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/market/market-input.ts`
- tests: `tests/scenarios/*`

### LAW-067 — Market input must be validated before state mutation

Market input must be validated before state mutation.

A market observation must pass core validation before it can produce a canonical journal entry, transition, snapshot update, freshness update, trust evidence, or ActionGate-visible state. Validation is a core responsibility, not an API or UI responsibility.

Required proof:

- invalid market input does not enter the canonical journal;
- invalid market input does not run reducers;
- invalid market input does not increment snapshot revision;
- invalid market input may be observed, rejected, quarantined, or audited outside canonical history;
- validation rules are deterministic and replay-safe.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/events/validate-domain-event.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/quarantine/quarantine.ts`
- future: `core/market/validate-market-input.ts`
- tests: `tests/scenarios/*`

### LAW-068 — Market input must carry provenance

Market input must carry provenance.

A market observation must carry explicit provenance that identifies its source, observation identity, causation/correlation context, ingestion path, and trace linkage when available. Provenance is required evidence for risk evaluation and audit; it is not frontend decoration.

Required proof:

- accepted market input has provenance evidence or an explicit provenance status of `unknown`;
- missing or invalid provenance blocks risk-increasing actions;
- provenance links market input to causality trace and hash-chain evidence when available;
- provenance is event-sourced or derived deterministically from accepted events, not from wall-clock reads, random values, UI state, or mutable runtime memory.

Current/future modules:

- current: `core/trace/causality-trace.ts`
- current: `core/integrity/snapshot-hash-chain.ts`
- current: `core/kernel/core-trust-report.ts`
- future: `core/provenance/provenance.ts`
- future: `core/market/market-input.ts`
- tests: `tests/scenarios/*`

### LAW-069 — Market input freshness is explicit, never assumed

Market input freshness is explicit, never assumed.

Freshness of market input must be represented as evidence with deterministic lineage. Arrival in the process, recent local memory, or successful parsing does not make market input fresh.

Required proof:

- market input has explicit freshness evidence or an explicit freshness status of `unknown`;
- unknown freshness blocks normal trading and risk-increasing actions;
- stale market input blocks normal trading and risk-increasing actions;
- freshness lineage is replay-safe and does not depend on nondeterministic reducer logic such as `Date.now()` or `Math.random()`;
- CoreTrustReport exposes market input freshness status when available.

Current/future modules:

- current: `core/freshness/freshness-guard.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/market/market-input-freshness.ts`
- tests: `tests/scenarios/*`

### LAW-070 — Sequence gaps block market trust

Sequence gaps block market trust.

A proven gap, out-of-order sequence, duplicated conflicting sequence, or monotonicity violation in market input blocks market trust until the kernel has accepted recovery evidence. Sequence integrity is evidence for trust, not a UI warning.

Required proof:

- sequence gaps are represented as blocking market input status;
- proven sequence violation prevents market input from contributing to `TRUSTED`;
- recovery requires accepted evidence, not local memory or frontend override;
- sequence/gap findings are visible in CoreTrustReport, ActionGate reasons, and causality trace when available.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/trace/causality-trace.ts`
- future: `core/market/market-sequence.ts`
- tests: `tests/scenarios/*`

### LAW-071 — Duplicate market input is idempotent, not state-changing

Duplicate market input is idempotent, not state-changing.

A duplicate market observation identity does not create a new canonical event, does not enter the canonical journal again, does not increment snapshot revision, does not run reducers again, and does not refresh market trust by repetition. A duplicate conflict is diagnostic/invariant evidence.

Required proof:

- duplicate market input is detected before reducer execution;
- duplicate market input does not mutate runtime state;
- duplicate market input does not update freshness by replaying the same evidence;
- duplicate conflict is reported as diagnostic/invariant failure evidence;
- idempotency remains recoverable from the canonical journal.

Current/future modules:

- current: `core/runtime/event-index.ts`
- current: `core/events/validate-domain-event.ts`
- current: `core/invariants/engine.invariants.ts`
- future: `core/market/market-input-index.ts`
- tests: `tests/scenarios/*`

### LAW-072 — Unknown market input is not corruption by default

Unknown market input is not corruption by default.

`unknown market input != corruption`; proven mismatch, proven gap, proven invalidity, or proven sequence violation may be corruption or compromise evidence depending on severity. Unknown input may keep market trust blocked or `UNCERTAIN`, but it must not be falsely reported as `COMPROMISED` or `PANIC`.

Required proof:

- unknown market input status is represented as unknown;
- unknown market input does not produce fake `TRUSTED`;
- unknown market input blocks risk without falsely marking corruption;
- proven mismatch/gap/sequence violation is distinguished from missing evidence.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/integrity/integrity-report.ts`
- future: `core/market/market-input.ts`
- tests: `tests/scenarios/*`

### LAW-073 — Proven market input mismatch may compromise trust

Proven market input mismatch may compromise trust.

If market input has accepted evidence that contradicts canonical history, hash-chain evidence, causality trace, freshness lineage, sequence rules, or exchange truth, the kernel must treat that as trust-affecting evidence. Severity determines whether the resulting state is `UNCERTAIN`, `RECOVERABLE`, `COMPROMISED`, or `PANIC`.

Required proof:

- proven market input mismatch is machine-readable trust evidence;
- mismatch blocks normal trading and risk-increasing actions;
- mismatch is visible in CoreTrustReport and ActionGate reasons;
- severity is explicit and does not silently downgrade corruption evidence to freshness-only warning.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/integrity/integrity-report.ts`
- current: `core/gates/src/action-gate.ts`
- future: `core/market/market-input-integrity.ts`
- tests: `tests/scenarios/*`

### LAW-074 — Market input cannot grant trading permission

Market input cannot grant trading permission.

Market input may contribute evidence, but it cannot authorize trading. Normal trading remains forbidden unless bootstrap, exchange truth, position, freshness, health truth, provenance, integrity, replay, Kernel Authority, CoreTrustReport, and ActionGate all permit the action.

Required proof:

- market input does not bypass ActionGate;
- market input does not bypass Kernel Authority or CoreTrustReport;
- fresh or valid market input alone does not permit trading;
- market input cannot convert `UNCERTAIN`, `RECOVERABLE`, `COMPROMISED`, `HALTED`, or `PANIC` into trading permission by itself.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/permissions/permission-ledger.ts`
- future: `core/market/market-input.ts`
- tests: `tests/scenarios/*`

### LAW-075 — Observability before live ingestion

Observability before live ingestion.

The kernel must be able to observe, validate, audit, replay, trace, and explain market input before any live ingestion or execution path is introduced. Wave 9 is an integrity layer for market input, not live V1 integration, exchange websocket integration, order placement, strategy logic, or trading.

Required proof:

- market input scenarios are observable and auditable without live trading;
- market input evidence appears in trust, verdict, and trace outputs when available;
- no API keys, live exchange websocket, order placement, trading terminal, or UI controls are required by this law;
- observability does not weaken ActionGate, trust, replay, or integrity checks.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/trace/causality-trace.ts`
- future: `core/market/market-input.ts`
- tests: `tests/scenarios/*`



### LAW-076 — UI is read-only

UI is read-only.

The user interface observes core state, reports, traces, verdicts, and mock scenario outputs. It does not author canonical state, trust, permission, replay, integrity, provenance, market truth, or recovery truth. A UI view is an observation surface, not a kernel authority.

Required proof:

- UI code may read canonical core outputs but must not write core state directly;
- UI state, layout state, client memory, route state, browser storage, or visualization state is not canonical evidence;
- UI-originated requests remain requests and must pass core validation and ActionGate when they affect risk or state;
- mock-first observable UI work must not introduce execution, trading controls, live market authority, or exchange keys.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/trace/causality-trace.ts`
- current: `core/permissions/permission-ledger.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-077 — UI cannot mutate Core state

UI cannot mutate Core state.

The only accepted cause of core state mutation remains a validated canonical event processed through core rules. UI interactions, frontend callbacks, observable stream subscriptions, mock panel state, and persisted UI preferences cannot mutate runtime snapshot, journal, trust state, integrity evidence, or permissions.

Required proof:

- UI interactions do not bypass event validation, idempotency, reducers, replay, integrity, Kernel Authority, or ActionGate;
- UI layout persistence cannot change snapshot revision, canonical journal, hash chain, causality trace, CoreTrustReport, or ActionGate verdict;
- observable subscriptions are read paths, not mutation paths;
- any future UI-originated command is still non-authoritative until accepted by core as a valid event or action request.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/events/validate-domain-event.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/system/journal.ts`
- current: `core/runtime/event-index.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-078 — UI cannot compute trust

UI cannot compute trust.

Trust is evaluated by Kernel Authority and expressed through CoreTrustReport. The frontend may display trust state and reasons returned by the core, but it must not derive, recalculate, override, downgrade, upgrade, cache-as-authority, or synthesize kernel trust.

Required proof:

- trust state shown by UI is sourced from CoreTrustReport or canonical core output;
- frontend logic cannot convert `UNCERTAIN`, `RECOVERABLE`, `COMPROMISED`, `HALTED`, or `PANIC` into `TRUSTED`;
- UI filters, grouping, labels, badges, colors, or charts do not change trust semantics;
- stale or missing UI data must not be presented as fresh trust.

Current/future modules:

- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-079 — UI cannot compute permissions

UI cannot compute permissions.

Permissions are produced by the core through Kernel Authority, CoreTrustReport, ActionGate, and Permission Ledger evidence. UI may display allowed/denied decisions and reasons, but it may not calculate permission, grant permission, hide blocking reasons, or transform a denied action into an allowed action.

Required proof:

- UI-displayed permission state is read from canonical core verdicts;
- every denied action remains denied unless core emits a new canonical verdict;
- permission ledger entries remain audit evidence, not frontend-controlled permission;
- UI affordances may be disabled or hidden for safety, but hiding or showing controls is not a core permission decision.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/kernel/core-trust-report.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-080 — UI cannot bypass ActionGate

UI cannot bypass ActionGate.

No UI action, mock scenario, observable stream, websocket-like feed, local dev panel, or visualization control may bypass ActionGate for any unsafe or risk-increasing action. ActionGate remains the required decision boundary for action permission.

Required proof:

- UI cannot call unsafe state-changing paths that skip ActionGate;
- mock scenarios cannot declare ActionGate success by frontend convention;
- ActionGate verdict reasons remain machine-readable and auditable;
- observable streams do not become an implicit allow channel.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/permissions/permission-ledger.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-081 — Core remains single source of truth

Core remains single source of truth.

The canonical state of the system is the core's journal-derived snapshot, integrity evidence, trust report, and gate verdicts. UI state, mock scenario controls, frontend caches, layout persistence, observable stream buffers, and browser storage are not a second source of truth.

Required proof:

- frontend persistence is never used as canonical core state;
- mock scenario state must be represented through deterministic accepted events or explicit non-canonical fixtures;
- observable output can be reconstructed from core state and accepted scenario inputs;
- conflicts between UI memory and core output are resolved in favor of core output.

Current/future modules:

- current: `core/system/journal.ts`
- current: `core/state/src/types.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/integrity/snapshot-hash-chain.ts`
- current: `core/trace/causality-trace.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-082 — Observable streams are informational only

Observable streams are informational only.

Observable streams expose core state, reports, traces, health, verdicts, and mock scenario observations for display and audit. They do not grant permission, mutate state, certify freshness, repair trust, reconcile exchange truth, or execute recovery/trading actions.

Required proof:

- stream delivery does not imply trust, freshness, connectivity, permission, or execution;
- dropped, delayed, duplicated, or reordered observable messages do not mutate canonical core state;
- observable stream status is health/diagnostic information, not core authority;
- stream consumers must treat core identifiers, revisions, verdicts, and traces as read-only evidence.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/health/runtime-health-snapshot.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/trace/causality-trace.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-083 — Mock scenarios must preserve deterministic replay

Mock scenarios must preserve deterministic replay.

Mock-first UI work may introduce deterministic scenario inputs for observation, but those inputs must not use nondeterministic reducer or replay-sensitive logic. Mock scenarios must be replay-safe and must not obscure causality, hash-chain continuity, provenance, or ActionGate decisions.

Required proof:

- mock scenario events have stable identity, deterministic payloads, and explicit provenance or fixture provenance;
- mock scenario execution does not depend on `Date.now()`, `Math.random()`, mutable runtime memory, UI timing, or browser-only state for replay-sensitive decisions;
- mock scenario outputs can be replayed to the same canonical state and trust evidence;
- mock-first work does not introduce live market ingestion, V1 connection, execution, trading, or exchange keys.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/system/journal.ts`
- current: `core/integrity/snapshot-hash-chain.ts`
- current: `core/trace/causality-trace.ts`
- future: `apps/core-ui-api/mock-scenarios/*`
- tests: `tests/scenarios/*`

### LAW-084 — UI layout persistence must not affect Core semantics

UI layout persistence must not affect Core semantics.

Persistence of panels, tabs, filters, columns, viewport, graph layout, selection, local preferences, or visual grouping is frontend-only state. It must not change core state, event order, snapshot revision, trust report, permission verdict, freshness, provenance, hash-chain evidence, or causality trace.

Required proof:

- layout persistence is not included in canonical journal unless a future explicit core event law says otherwise;
- restoring UI layout does not replay, skip, reorder, or mutate core events;
- UI filters do not hide mandatory machine-readable denial reasons from canonical outputs;
- visual grouping does not imply causal grouping unless core trace evidence says so.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/trace/causality-trace.ts`
- current: `core/gates/src/action-gate.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-085 — Visualization must not alter computation

Visualization must not alter computation.

Visualization is an observation and explanation layer. Charts, graphs, timelines, colors, animations, grouping, filters, highlighting, and step-through displays must not alter reducers, replay, event validation, integrity checks, trust evaluation, permission verdicts, or recovery recommendations.

Required proof:

- rendering order is not event order unless backed by core trace evidence;
- visual emphasis is not severity unless backed by CoreTrustReport, IntegrityReport, ActionGate verdict, or scenario audit evidence;
- visualization does not call mutation paths as a side effect of reading data;
- visualization cannot transform mock observation into execution or trading permission.

Current/future modules:

- current: `core/transitions/src/reducers.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/integrity/integrity-report.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/trace/causality-trace.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### Wave 10A observable UI invariants

The following invariants are required for Observable UI work:

1. UI observes; Core decides;
2. UI state is never canonical core state;
3. UI cannot mutate core state without a validated core event/action path;
4. UI cannot compute trust or permissions;
5. UI cannot bypass ActionGate;
6. observable streams are informational only;
7. mock scenarios must preserve deterministic replay;
8. UI layout persistence must not affect core semantics;
9. visualization must not alter computation;
10. mock-first observable UI work must not introduce V1, live market, websocket authority, execution, trading, exchange keys, order placement, or frontend authority.

### Wave 10A red lines

The kernel must not:

- treat frontend state, UI layout persistence, browser storage, stream buffers, or visual labels as authority;
- introduce execution semantics, trading controls, live trading language, websocket authority, exchange keys, order placement, or frontend authority through UI work;
- let observable streams grant permission, certify trust, certify freshness, mutate state, or bypass ActionGate;
- let mock scenarios use nondeterministic replay-sensitive logic;
- let visualization alter computation, trust, permissions, integrity, replay, provenance, or causality.


### LAW-086 — Core UI API is read-only

Core UI API is read-only.

The Core UI API is an observation surface over canonical core outputs. It may expose snapshots, CoreTrustReport, ActionGate verdicts, Permission Ledger entries, integrity evidence, causality traces, replay status, scenario audit outputs, and mock observable streams. It must not author canonical state, mutate runtime snapshot, rewrite journal history, alter trust, grant permission, or create market truth.

Required proof:

- API handlers that serve UI observations are read-only with respect to canonical core state;
- API responses are derived from core-owned evidence and do not synthesize authority in the API layer;
- API read models cannot change snapshot revision, canonical journal entries, hash-chain evidence, causality trace, trust state, or ActionGate verdict;
- mock-first API work does not introduce execution, order placement, live market semantics, websocket authority, exchange keys, V1, V2, strategy logic, or trading controls.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/trace/causality-trace.ts`
- current: `core/integrity/integrity-report.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-087 — API cannot mutate Core state outside canonical events

API cannot mutate Core state outside canonical events.

No UI-facing API route, mock observable endpoint, polling endpoint, scenario endpoint, layout endpoint, or stream endpoint may mutate core state directly. If a future API request has state impact, it remains only a request until the core accepts a validated canonical event or ActionGate-approved action path.

Required proof:

- API route state, request cache, response cache, session state, and client state are not canonical core state;
- API endpoints cannot write to runtime snapshot, canonical journal, hash chain, causality trace, trust report, or permission decision as a side effect of observation;
- any future state-affecting API path must pass event validation, idempotency, replay/integrity constraints, Kernel Authority trust evaluation, and ActionGate where applicable;
- read-only UI/API delivery must not add an alternate mutation channel.

Current/future modules:

- current: `core/contracts/src/events.ts`
- current: `core/events/validate-domain-event.ts`
- current: `core/runtime/event-index.ts`
- current: `core/system/journal.ts`
- current: `core/transitions/src/reducers.ts`
- current: `core/gates/src/action-gate.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-088 — API cannot bypass ActionGate

API cannot bypass ActionGate.

A UI/API endpoint may display a verdict, but it may not replace, override, pre-approve, cache-as-authority, or bypass ActionGate. Any unsafe, recovery, risk-increasing, or future execution-adjacent request must remain subject to the canonical ActionGate verdict.

Required proof:

- API responses cannot transform a denied core verdict into an allowed permission;
- API convenience flags, frontend affordances, route guards, mock scenario controls, and websocket-like notifications are not ActionGate;
- every denied action exposed through the API retains machine-readable reasons and auditability;
- observable UI/API work does not weaken ActionGate semantics from earlier waves.

Current/future modules:

- current: `core/gates/src/action-gate.ts`
- current: `core/kernel/kernel-authority.ts`
- current: `core/kernel/core-trust-report.ts`
- current: `core/permissions/permission-ledger.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-089 — Read-only UI/API preserves replay determinism

Read-only UI/API preserves replay determinism.

Observation must not alter replay results. API reads, UI polling, mock scenario playback, visualization refreshes, subscriptions, cached responses, and layout persistence must not introduce nondeterministic inputs into reducer, replay-sensitive logic, hash-chain evidence, causality trace, or canonical trust evaluation.

Required proof:

- `Date.now()`, `Math.random()`, browser state, request timing, polling order, websocket-like notification timing, and UI layout state are not used as canonical replay evidence;
- mock scenarios used for UI/API observation have deterministic fixtures or event sources;
- replay of the same canonical journal produces the same snapshot, trust evidence, causality trace, and verdict regardless of UI/API observation activity;
- observing the core cannot change the history being observed.

Current/future modules:

- current: `core/system/journal.ts`
- current: `core/runtime/src/runtime-engine.ts`
- current: `core/integrity/snapshot-hash-chain.ts`
- current: `core/trace/causality-trace.ts`
- current: `core/kernel/kernel-authority.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-090 — Observable streams are not websocket authority

Observable streams are not websocket authority.

A stream exposed for UI observation is informational only. It is not an exchange websocket, not a market authority, not a permission authority, not a trust authority, and not an execution channel. Stream delivery state must not be treated as canonical connectivity, market freshness, exchange truth, or trading readiness.

Required proof:

- stream connected/disconnected state is not equivalent to exchange connectivity or health truth;
- stream messages cannot create market truth, exchange truth, trust state, permission, or canonical events by themselves;
- dropped, delayed, duplicated, or reordered UI stream messages do not mutate core state or corrupt replay;
- no websocket authority, live market semantics, API keys, order placement, or trading terminal behavior is introduced.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/freshness/freshness-guard.ts`
- current: `core/exchange-truth/exchange-truth.ts`
- current: `core/gates/src/action-gate.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-091 — No live market semantics in read-only UI/API

No live market semantics in read-only UI/API.

Wave 10B UI/API work is mock-first and read-only. It must not describe or behave as live market ingestion, live exchange websocket integration, order execution, trading terminal operation, live strategy operation, or V1/V2 bridge activation.

Required proof:

- UI/API names, reports, examples, and documentation do not imply live market authority or execution;
- mock market-like observations remain fixtures or deterministic scenario outputs, not live market data;
- any future live ingestion requires separate constitutional, validation, provenance, freshness, integrity, and ActionGate review;
- no exchange keys, order placement, live trading, strategy execution, or websocket authority are introduced by this law.

Current/future modules:

- current: `core/market/market-input.ts`
- current: `core/provenance/provenance.ts`
- current: `core/kernel/core-trust-report.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### LAW-092 — API serialization and visualization must not alter computation

API serialization and visualization must not alter computation.

Formatting canonical evidence for UI/API consumption must preserve meaning. JSON serialization, DTO mapping, field ordering for display, labels, colors, charts, grouping, pagination, filtering, and visualization must not change the underlying trust state, permission verdict, replay evidence, hash-chain evidence, causality trace, provenance, freshness, market-input status, or health truth.

Required proof:

- UI/API DTOs retain machine-readable reasons and canonical identifiers needed for audit;
- display-only transformations are clearly non-authoritative;
- sorting, filtering, pagination, or grouping cannot hide denial reasons in a way that changes semantics;
- visualization refresh or layout persistence cannot change computation.

Current/future modules:

- current: `core/kernel/core-trust-report.ts`
- current: `core/gates/src/action-gate.ts`
- current: `core/permissions/permission-ledger.ts`
- current: `core/trace/causality-trace.ts`
- current: `core/integrity/integrity-report.ts`
- future: `apps/core-ui-api/*`
- tests: `tests/scenarios/*`

### Wave 10B read-only UI/API invariants

- UI/API observation is read-only and cannot mutate core state.
- API responses display canonical core evidence; they do not compute trust or permissions.
- API endpoints cannot bypass ActionGate or transform denied verdicts into allowed decisions.
- Replay determinism is preserved regardless of UI polling, subscriptions, visualization, or mock scenario observation.
- Observable streams are informational only and are not websocket authority.
- Mock-first UI/API outputs must not introduce live market semantics.
- API serialization, DTO mapping, and visualization must preserve machine-readable denial reasons and canonical evidence identifiers.
- Core remains the single source of truth.

### Wave 10B red lines

- no execution semantics;
- no trading controls;
- no live trading language;
- no live market semantics;
- no websocket authority;
- no frontend authority;
- no API authority over trust or permission;
- no API mutation of core state outside canonical events;
- no ActionGate bypass;
- no replay, trust, provenance, integrity, or freshness bypass.

### Wave 9 market input integrity invariants

The following invariants are required for Market Input Integrity work:

1. market input is evidence, not truth by default;
2. market input must be validated before canonical journaling or reducer execution;
3. market input must carry provenance or explicit unknown provenance status;
4. market input freshness is explicit and never assumed from arrival;
5. sequence gaps, out-of-order input, and proven sequence violations block market trust;
6. duplicate market input is idempotent and cannot mutate state twice;
7. unknown market input blocks risk but is not corruption by default;
8. proven market input mismatch, gap, or sequence violation may compromise trust depending on severity;
9. market input cannot grant trading permission by itself;
10. observability must precede live ingestion or execution;
11. market input evidence must preserve replay determinism and must not depend on `Date.now()`, `Math.random()`, mutable runtime memory, UI state, or a second source of truth;
12. market input evidence must not break Wave 7 hash-chain/causality semantics or Wave 8 provenance/metadata semantics.

### Wave 9 red lines

Market Input Integrity must not introduce:

- V1 live integration;
- V2 integration;
- exchange websocket connection as a required runtime path;
- API keys;
- order placement;
- execution;
- trading;
- UI controls;
- ActionGate bypass;
- trust bypass;
- replay bypass;
- integrity bypass;
- market data treated as fresh or trusted by default;
- nondeterministic reducer or replay-sensitive logic;
- a second source of truth.

## 5. Review rule

A change is acceptable only if it increases the provability of the kernel or preserves it while making the implementation clearer.

A change is not acceptable when it makes the system more convenient by hiding uncertainty, skipping validation, weakening replay, bypassing the gate, accepting invalid events, silently trusting local memory, hiding denial reasons, mutating state from Kernel Authority, treating metadata as a mutable side bag, allowing risk-increasing actions without provenance, or allowing frontend/V1/V2/strategy authority.

## 6. Required evidence for task delivery

Every task that touches MBG Core v0.1 must include:

1. changed files;
2. tests;
3. exact verification commands;
4. risk list;
5. statement of which core laws are strengthened or preserved.
6. statement of what was intentionally not implemented when a task is constitution-only.

## 7. Open questions

1. What is the final canonical event envelope for v0.1: `eventId`, `eventType`, `eventVersion`, `schemaVersion`, `timestamp`, `source`, `causationId`, `correlationId`, and `payload`?
2. Historical note for integration with Cold Start Unknown: before that task, PR35 started from `flat + clear`; in MBG Core v0.1 this is corrected to `unknown + blocked`.
3. What exact system status model should replace or extend current `bootstrapping | healthy | degraded | halted`?
4. Is replay verification mandatory on every runtime start in v0.1?
5. Where should the applied-event idempotency index live: journal metadata, snapshot metadata, or a separate kernel store?
6. Which invariant severities are canonical: blocking vs panic vs recoverable?
7. What TTLs define fresh exchange truth and fresh market data?
8. What is the minimum accepted metadata contract for a live order?
9. Should duplicate `eventId` with different payload be `COMPROMISED` or immediate `PANIC`?
10. Should `CoreTrustReport` be a pure function over evidence, or may it read runtime state directly?
11. For Wave 2, should failed bootstrap recovery events have a dedicated event type or reuse an existing system event envelope?
12. What exact event identity fields are canonical for duplicate detection beyond `eventId`?
13. What TTLs are canonical for each ExchangeTruth source: account, position, open orders, fills, and connectivity?
14. What TTLs are canonical for market data by symbol and market venue?
15. Which health state vocabulary is canonical for API health: `unknown`, `blocked`, `degraded`, `healthy`, or a stricter enum?
16. Which future event type records a successful fresh exchange reconcile without implementing Metadata as Events in Wave 3?
17. What exact canonical serialization defines stable event hashes?
18. What exact canonical serialization defines deterministic snapshot hashes?
19. Which hash algorithm is canonical for v0.1 artifacts?
20. Which severity boundary separates hash-backed `COMPROMISED` from `PANIC`?
21. What exact canonical event schema represents metadata/provenance events in Wave 8?
22. What is the canonical set of provenance fields required for risk-increasing actions?
23. What is the canonical market observation envelope for Wave 9: source, venue, symbol, sequence, observedAt evidence, receivedAt evidence, provenance, causationId, correlationId, and payload?
24. Which sequence/gap rules are canonical per market input source and venue?
25. What TTLs or freshness lineage rules are canonical for each market input type?
26. Which severity boundary separates unknown market input, market trust block, `COMPROMISED`, and `PANIC`?
27. What exact read-only Core UI API DTO schema preserves canonical trust, verdict, trace, provenance, integrity, freshness, and market-input evidence without creating frontend or API authority?

## 8. Machine-readable companion

The machine-readable companion is proposed at:

- `core/kernel/kernel-constitution.ts`

It contains stable law ids, trust states, authority exclusions, law-to-module mappings, Wave 2 constitution markers, Wave 3 ExchangeTruth/freshness/health-truth markers, Wave 4 trust markers, Wave 5 recovery/quarantine/permission markers, Wave 7 hash-chain/causality markers, and Wave 8 provenance/metadata-as-events markers, and Wave 9 market input integrity markers, Wave 10A observable UI markers, and Wave 10B read-only UI/API markers. It does not change runtime behavior.
