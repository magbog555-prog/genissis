# MBG Core v0.1 — Definition of Done

Status: normative completion checklist for MBG Core v0.1  
Canonical base: `mbg-core-v0.1-alpha5`  
Scope: core trust kernel only

This document defines when **MBG Core v0.1** may be considered ready. It does not add runtime behavior, trading behavior, strategy logic, UI logic, or V1/V2 integration.

MBG Core v0.1 is done only when it can start safely, refuse unsafe action, explain why, preserve replayable state, quarantine bad data outside the main journal, and expose one canonical trust answer through the kernel trust chain.

## 1. Trust chain required for v0.1

The canonical trust chain is:

```text
snapshot + evidence
→ Kernel Authority
→ CoreTrustReport
→ ActionGate Verdict v2
```

The frontend, API caller, strategy, V1, V2, Signal Layer, Decision Engine, local process health, or direct exchange adapter must not compute or override kernel trust.

## 2. Must-have criteria for v0.1

All must-have criteria are release blockers. If any item fails, MBG Core v0.1 is not done.

### 2.1 Build, verification, and package hygiene

- [ ] All accepted alpha5 tests pass.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run verify` passes.
- [ ] The release package contains no `.env` file with real keys.
- [ ] The release package contains no real exchange keys, production secrets, private tokens, or committed runtime credentials.
- [ ] Live trading is not enabled by default.
- [ ] No live trading default may place, cancel, modify, or recover orders without an explicit future integration layer and ActionGate approval.
- [ ] Runtime data, local journals, local snapshots, and generated local artifacts are not shipped as trusted state.

### 2.2 Boundary and scope

- [ ] V1 is not inside the core.
- [ ] V2 is not inside the core.
- [ ] Signal Layer is not inside the core.
- [ ] Decision Engine is not inside the core.
- [ ] Strategy logic is not inside the core.
- [ ] UI does not calculate trust.
- [ ] UI may display CoreTrustReport, but must not derive its own trust state, trading permission, or recovery authority.
- [ ] Core modules do not depend on real exchange keys or live trading configuration.

### 2.3 State transition law

- [ ] All state changes go through accepted domain events.
- [ ] Reducers remain deterministic.
- [ ] Reducers do not read wall-clock time for trust/freshness decisions.
- [ ] Reducers do not read UI state, strategy state, live exchange state, or hidden mutable globals.
- [ ] Invalid events are rejected before reducer execution.
- [ ] Invalid events do not mutate snapshot state.
- [ ] Invalid events do not increase revision.
- [ ] Invalid events do not enter the canonical journal.
- [ ] Unknown event types do not enter the canonical journal.
- [ ] Schema violations do not enter the canonical journal.
- [ ] Duplicate events do not mutate state repeatedly.
- [ ] Idempotency conflicts do not mutate snapshot state and must be quarantined or recorded diagnostically outside the canonical journal.

### 2.4 Cold start and bootstrap

- [ ] Cold start begins with unknown state where truth is not yet proven.
- [ ] Cold start begins blocked for normal trading.
- [ ] Cold start without proven corruption is `UNCERTAIN`, not `COMPROMISED`.
- [ ] Bootstrap FSM is mandatory.
- [ ] Normal trading is impossible before bootstrap permits it.
- [ ] Bootstrap state and transition evidence are visible to Kernel Authority and CoreTrustReport.
- [ ] Bootstrap failures have machine-readable blocking reasons.

### 2.5 ExchangeTruth, freshness, and health truth

- [ ] ExchangeTruth is mandatory for normal trading.
- [ ] Unknown exchange truth forbids normal trading.
- [ ] Stale exchange truth forbids normal trading.
- [ ] Conflicting exchange truth forbids normal trading.
- [ ] Freshness Guard is mandatory for normal trading.
- [ ] Unknown freshness is not fresh.
- [ ] Stale market data forbids normal trading.
- [ ] Stale exchange freshness forbids normal trading.
- [ ] Freshness is calculated from explicit timestamps.
- [ ] HealthTruth does not lie.
- [ ] Unknown connection state is not healthy.
- [ ] `wsConnected` cannot be fake `true`.
- [ ] Health status must distinguish process liveness from trusted trading readiness.

### 2.6 Kernel Authority and CoreTrustReport

- [ ] Kernel Authority is the source of `trustState`.
- [ ] Kernel Authority is read-only and does not mutate state.
- [ ] Kernel Authority does not perform recovery.
- [ ] Kernel Authority does not authorize trades directly; it evaluates trust.
- [ ] CoreTrustReport is the main trust output of the core.
- [ ] CoreTrustReport reflects Kernel Authority output and must not become a second authority.
- [ ] CoreTrustReport includes at minimum: `revision`, `trustState`, `runtimeMode`, `tradingAllowed`, `allowedActionClasses`, `blockingReasons`, `nextRecoveryActions`, `bootstrap`, `exchangeTruth`, `freshness`, `healthTruth`, `replay`, `invariants`, `metadata`, `lastEvent`, and `lastTransition` when available.
- [ ] Frontend and external callers can rely on CoreTrustReport without recomputing trust independently.

### 2.7 ActionGate Verdict v2 and permissions

- [ ] ActionGate Verdict v2 explains `allow` and `deny`.
- [ ] Normal trading requires bootstrap, position, ExchangeTruth, freshness, HealthTruth, Kernel Authority trust, and ActionGate approval.
- [ ] There is no bypass where direct ActionGate allow ignores stale freshness, unknown health, missing ExchangeTruth, bootstrap block, or compromised replay.
- [ ] All prohibitions have machine-readable reasons.
- [ ] Blocking reasons include code, domain, severity, message, and evidence when available.
- [ ] Allowed action classes are explicit: `NORMAL`, `RISK_REDUCING`, `RECOVERY`, `DIAGNOSTIC`, `ADMIN`, or `NONE`.
- [ ] Recovery actions still pass through ActionGate.

### 2.8 Replay, invariants, and journal integrity

- [ ] Replay verification exists and is part of trust evaluation.
- [ ] Replay mismatch blocks normal trading.
- [ ] Canonical journal contains only accepted events.
- [ ] Quarantined records do not participate in normal replay.
- [ ] Invariant failures are reflected in trust evaluation and blocking reasons.
- [ ] Snapshot state is not trusted merely because it exists; it must be supported by journal, replay, invariants, ExchangeTruth, freshness, and health evidence.

### 2.9 Recovery Planner, Quarantine, and Permission Ledger

- [ ] Recovery Planner proposes recovery actions but does not execute them.
- [ ] Recovery Planner does not mutate state.
- [ ] Recovery Planner does not call a live exchange.
- [ ] Recovery Planner output is advisory and still subject to ActionGate.
- [ ] Quarantine stores bad, invalid, suspicious, unknown, or conflicting data outside the canonical journal.
- [ ] Quarantine does not mutate snapshot state.
- [ ] Quarantine does not increase revision.
- [ ] Quarantine does not participate in normal replay.
- [ ] Quarantine count and summary are available to CoreTrustReport and future recovery tooling.
- [ ] Permission Ledger records allow/deny decisions.
- [ ] Permission Ledger does not allow actions by itself.
- [ ] Permission Ledger does not bypass ActionGate.
- [ ] Permission Ledger does not mutate trading state.

## 3. Should-have criteria for v0.1

These criteria are strongly expected before declaring v0.1 final, but they may be accepted with explicit documented risk if all must-have criteria pass.

- [ ] `npm run verify` should include all core scenario audits from Waves 2–5.
- [ ] Scenario audit output should be clear enough for integration review without reading all source files.
- [ ] CoreTrustReport should include compact summaries for quarantine, permission ledger, and recovery planner status.
- [ ] Blocking reason codes should be stable and documented.
- [ ] Runtime diagnostic views should clearly distinguish:
  - process health;
  - health truth;
  - freshness;
  - exchange truth;
  - trust state;
  - permission verdict.
- [ ] Tests should include at least one negative case for every normal-trading precondition.
- [ ] The package should include a clean runbook path for local verification.
- [ ] Delivery reports should identify intentional non-goals and integration risks.
- [ ] No deprecated PR35/V1 naming should imply that V1 is part of MBG Core v0.1.
- [ ] Test fixtures should not rely on wall-clock assumptions unless the time is injected explicitly.

## 4. Later criteria for v0.2

These are explicitly not required for MBG Core v0.1 completion.

- [ ] V1 integration.
- [ ] V2 integration.
- [ ] Signal Layer.
- [ ] Decision Engine.
- [ ] Strategy runtime.
- [ ] UI implementation.
- [ ] Live trading enablement.
- [ ] Real exchange key management.
- [ ] Automatic recovery execution.
- [ ] Full durable quarantine backend.
- [ ] Full durable permission ledger backend.
- [ ] Advanced Recovery Planner with operator workflows.
- [ ] Multi-exchange authority.
- [ ] Cross-service distributed trust authority.
- [ ] Production deployment hardening.
- [ ] External observability dashboards.
- [ ] Formal schema registry for all future event versions beyond the v0.1 core set.

## 5. Release decision rule

MBG Core v0.1 may be called ready only when:

```text
all must-have criteria pass
+ accepted verification commands pass
+ no prohibited module is introduced
+ no unsafe action bypass exists
+ trust is computed only through Kernel Authority
+ CoreTrustReport is sufficient for external consumers
```

If a must-have item is waived, the release must not be called v0.1 ready. It must remain an alpha, release candidate, or explicitly marked limited build.

## 6. Non-goals for v0.1

MBG Core v0.1 is not a trading strategy, not a signal system, not a decision engine, not a UI, not a live trading bot, and not an automatic recovery operator.

Its purpose is narrower:

```text
start safely
preserve truthful state
reject bad input
quarantine bad data
verify replay
evaluate trust
explain permissions
suggest safe recovery steps
refuse unsafe action
```
