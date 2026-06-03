# ALPHA5_ACCEPTANCE_REPORT

Status: accepted baseline report for `mbg-core-v0.1-alpha5`  
Role: Role 2 — Constitution Update / Core Constitution authority  
Scope: MBG Core v0.1 only

This report records alpha1 through alpha5 acceptance, the active kernel laws, required checks, strict prohibitions, remaining risks, and the next stage.

## 1. What entered alpha1

Alpha1 established the first canonical MBG Core v0.1 package.

Accepted alpha1 content:

- clean package baseline;
- `RUNBOOK.md`;
- `CORE_CONSTITUTION.md`;
- machine-readable constitution constants in `core/kernel/kernel-constitution.ts`;
- constitution scenario test;
- cold start is unknown / not trusted;
- risk and unsafe actions are blocked before trust is established;
- `PLACE_ORDER` is denied before reconcile;
- extended verification scripts;
- alpha1 integration patch and integration report.

Alpha1 constitutional meaning:

- the kernel must start safely;
- unknown is safer than fake confidence;
- the frontend, V1, strategies, Signal Layer, and Decision Engine are not authority;
- no trusted state means no normal trading action.

## 2. What entered alpha2

Alpha2 hardened event and bootstrap safety.

Accepted alpha2 content:

- Bootstrap FSM;
- Event Validation inside Core;
- Event Idempotency;
- Wave 2 Scenario Audit;
- Constitution Update;
- canonical event commit pipeline:

```text
validate event
→ idempotency check
→ append journal
→ record idempotency
→ reduce snapshot
```

Alpha2 constitutional meaning:

- bootstrap state governs trading readiness;
- invalid events do not enter the canonical journal;
- duplicate events do not append journal, do not mutate snapshot, and do not increase revision;
- reducers remain pure;
- validation is a core responsibility, not only an API responsibility;
- idempotency index must be recoverable from accepted canonical journal entries.

## 3. What entered alpha3

Alpha3 added truth and freshness requirements.

Accepted alpha3 content:

- ExchangeTruth Domain;
- Freshness Guard;
- Health Truth Cleanup;
- Wave 3 Scenario Audit;
- Constitution Update.

Alpha3 constitutional meaning:

- exchange truth outranks local memory;
- unknown, stale, or conflicted exchange truth forbids normal trading;
- stale market data forbids normal trading;
- health must not report fake truth;
- unknown connection state is not connected;
- `wsConnected` must not be fake true;
- local flat position is not trusted without fresh exchange reconcile;
- normal action requires bootstrap, position, exchangeTruth, freshness, health truth, and ActionGate.

## 4. What entered alpha4

Alpha4 centralized trust evaluation.

Accepted alpha4 content:

- Kernel Authority;
- CoreTrustReport;
- ActionGate Verdict v2;
- Wave 4 Scenario Audit;
- Constitution Update.

Canonical alpha4 trust chain:

```text
snapshot + runtime evidence
→ Kernel Authority
→ CoreTrustReport
→ ActionGate Verdict v2
```

Alpha4 constitutional meaning:

- Kernel Authority is the canonical trust evaluator;
- Kernel Authority must be pure and must not mutate state;
- CoreTrustReport is the canonical trust output;
- frontend must not calculate trust;
- V1 must not calculate core trust;
- every denied action must have machine-readable reasons;
- trust state must be explainable;
- ActionGate must use kernel trust state.

Canonical trust states:

```text
TRUSTED
RECOVERABLE
UNCERTAIN
COMPROMISED
HALTED
PANIC
```

Important accepted decision:

```text
cold start without proven corruption = UNCERTAIN, not COMPROMISED
```

## 5. What entered alpha5

Alpha5 added safe recovery planning, quarantine, and permission audit.

Accepted alpha5 content:

- Recovery Planner;
- Quarantine;
- Permission Ledger;
- Wave 5 Scenario Audit;
- Constitution Update.

Alpha5 constitutional meaning:

- invalid or suspicious data does not enter canonical journal;
- quarantined data does not mutate runtime state;
- quarantine is diagnostic, not canonical history;
- every ActionGate verdict must be auditable;
- Permission Ledger records allow and deny decisions;
- Permission Ledger records decisions but does not authorize actions by itself;
- Permission Ledger must not mutate trading state;
- Recovery Planner suggests actions but does not execute them;
- recovery actions must still pass ActionGate;
- normal trading remains forbidden until recovery conditions are satisfied;
- quarantine preserves rejected evidence outside canonical history.

## 6. Main kernel laws now active

The alpha5 kernel is governed by the following active law groups.

### State and event laws

- no event, no state change;
- invalid event never enters canonical journal;
- suspicious data must not enter canonical journal;
- duplicate event is not a new canonical event;
- duplicate event does not append journal;
- duplicate event does not increase revision;
- duplicate event does not run reducers;
- one accepted event identity can mutate runtime snapshot only once;
- reducers remain pure;
- no fill, no PnL;
- duplicate fill does not change PnL or position twice;
- duplicate reconcile does not change state twice;
- idempotency index must be recoverable from journal;
- `duplicate_conflict` is diagnostic / invariant failure.

### Bootstrap and readiness laws

- cold start is `UNCERTAIN` unless corruption is proven;
- bootstrap FSM governs trading readiness;
- bootstrap not reconciled forbids normal trading;
- bootstrap failed cannot transition to reconciled without recovery event;
- no trusted state means no normal trading action.

### Truth and freshness laws

- exchange truth outranks local memory;
- exchangeTruth unknown forbids normal trading;
- exchangeTruth stale forbids normal trading;
- exchangeTruth conflicted forbids normal trading;
- stale market data forbids normal trading;
- freshness unknown is stale for normal trading;
- unknown connection state is not connected;
- health must not report fake truth;
- `wsConnected` must not be fake true;
- local flat position is not trusted without fresh exchange reconcile.

### Trust evaluation laws

- Kernel Authority is the canonical trust evaluator;
- Kernel Authority must be pure;
- CoreTrustReport is the canonical trust output;
- trust state must be explainable;
- frontend must not calculate trust;
- V1 must not calculate core trust;
- ActionGate must use kernel trust state;
- every denied action must have machine-readable reasons.

### Recovery, quarantine, and audit laws

- quarantined data must not mutate runtime state;
- quarantine is diagnostic, not canonical history;
- quarantine must preserve rejected evidence;
- every ActionGate verdict must be auditable;
- Permission Ledger records allow and deny decisions;
- Permission Ledger must not mutate trading state;
- Recovery Planner suggests actions but does not execute them;
- recovery actions must still pass ActionGate;
- normal trading remains forbidden until recovery conditions are satisfied.

## 7. Required checks

The following checks must pass for alpha5 acceptance and future constitution-aligned work:

```bash
npm run test:core-constitution
npm run typecheck
```

The full alpha5 package verification is expected to include:

```bash
npm run verify
```

`npm run verify` currently covers the accumulated scenario suites through Wave 5, including cold start, bootstrap, event validation, idempotency, exchange truth, freshness, health truth, Kernel Authority, CoreTrustReport, ActionGate Verdict v2, Recovery Planner, Quarantine, Permission Ledger, and Wave 2 through Wave 5 scenario audits.

## 8. Strict prohibitions

The following remain strictly prohibited in alpha5:

- do not connect V1;
- do not connect V2;
- do not build Signal Layer;
- do not build Decision Engine;
- do not add strategy logic;
- do not add UI;
- do not enable live trading;
- do not add real exchange keys;
- do not mutate runtime state outside accepted domain events;
- do not append invalid, suspicious, duplicated, or quarantined data to the canonical journal;
- do not bypass ActionGate for unsafe or recovery actions;
- do not let frontend, UI state, V1, V2, strategy, Signal Layer, or Decision Engine calculate core trust;
- do not let Kernel Authority mutate state;
- do not let CoreTrustReport compute an alternate trust state;
- do not let Permission Ledger authorize actions by itself;
- do not let Recovery Planner execute actions automatically.

## 9. Remaining risks

The remaining risks are implementation and integration risks, not constitutional permission to weaken the kernel.

1. Recovery plans may be misread as permission to act. Mitigation: recovery actions must still pass ActionGate.
2. Quarantine may be accidentally treated as replay history. Mitigation: quarantine is diagnostic only and must remain outside canonical journal replay.
3. Permission Ledger may be misread as an authorization source. Mitigation: it records decisions only and must not grant permission.
4. Trust report consumers may use partial fields instead of the canonical trust result. Mitigation: CoreTrustReport remains canonical trust output and Kernel Authority remains canonical evaluator.
5. Freshness and health assumptions may drift if new event types are added without scenario tests. Mitigation: new event types must extend scenario audit and constitution mapping.
6. Documentation may lag implementation as future waves add modules. Mitigation: Role 2 remains the constitution source of truth and must normalize proposed law changes.
7. `npm run verify` can be long-running in constrained environments. Mitigation: required task-level checks remain `npm run test:core-constitution` and `npm run typecheck`, while integration owner should run the full verify suite.

## 10. Next stage

The next stage is not to add strategy or trading logic.

The next stage should preserve the alpha5 trust chain and build only on accepted kernel evidence:

```text
accepted canonical events
→ replayable runtime snapshot
→ exchange/freshness/health evidence
→ Kernel Authority
→ CoreTrustReport
→ ActionGate Verdict v2
→ Permission Ledger audit
→ Recovery Planner suggestions
→ Quarantine for rejected evidence
```

Future work should focus on tighter proof, scenario coverage, and integration hardening while preserving these boundaries:

- no V1/V2 authority;
- no strategy authority;
- no UI authority;
- no live trading;
- no automatic recovery execution;
- no state mutation outside accepted events.
