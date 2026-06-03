# INTEGRATION REPORT ALPHA4

## Package

- Base archive: `mbg-core-v0.1-alpha3.zip`
- Output package: `mbg-core-v0.1-alpha4.zip`
- Integration owner: role 8 / Integration Owner / Merge Engineer
- Integration mode: semantic merge, not archive replacement

## Merged roles

- Role 2.4 — Constitution Update
  - `CORE_CONSTITUTION.md`
  - `core/kernel/kernel-constitution.ts`
  - constitution test/script updates
- Role 4.4 — Kernel Authority
  - `core/kernel/kernel-authority.ts`
  - `tests/scenarios/kernel-authority.ts`
  - `test:core:kernel-authority`
  - `DELIVERY_REPORT_WAVE4_KERNEL_AUTHORITY.md`
- Role 5.4 — CoreTrustReport
  - `core/kernel/core-trust-report.ts`
  - `RuntimeEngine.getCoreTrustReport()`
  - `tests/scenarios/core-trust-report.ts`
  - `test:core:trust-report`
- Role 6.4 — ActionGate Verdict v2
  - `core/contracts/src/actions.ts`
  - `core/gates/src/action-gate.ts`
  - `tests/scenarios/core-action-gate-verdict.ts`
  - `test:core:action-gate-verdict`
- Role 7 — Wave 4 Scenario Audit
  - `tests/scenarios/wave4-scenario-audit.ts`
  - `test:wave4:scenario-audit`
  - delivery report

## Canonical trust chain

The final alpha4 trust chain is:

```text
snapshot + runtime evidence
→ Kernel Authority
→ CoreTrustReport
→ ActionGate Verdict v2
```

Kernel Authority is the only organ of core trust. It is a pure evaluator only:

- no event writes;
- no state mutation;
- no exchange calls;
- no recovery execution;
- no trading enablement.

CoreTrustReport displays the Kernel Authority result. It does not compute a second trust state.

ActionGate Verdict v2 uses Kernel Authority canonical trust state and explains action decisions. It does not replace Kernel Authority.

## Canonical trust states

Only the Kernel Authority canonical trust states are used:

```text
TRUSTED
RECOVERABLE
UNCERTAIN
COMPROMISED
HALTED
PANIC
```

Previous role-local states were removed from canonical expectations:

```text
trusted / restricted / untrusted / unknown
```

## Event commit pipeline preserved

Alpha2/alpha3 event safety pipeline remains intact:

```text
validate event
→ idempotency check
→ append journal
→ record idempotency
→ reduce snapshot
```

Invalid events still do not mutate journal, idempotency index, or snapshot.

Duplicate events still do not append journal, do not mutate snapshot, and do not change revision.

## Conflicts and semantic decisions

### 1. Cold start blocking states

Alpha4 ActionGate Verdict v2 returns a fuller machine-readable denial. Cold start now includes `market` / freshness as an additional blocking state because no fresh market data is proven yet.

Decision:

```text
cold start blockingStates:
bootstrap, exchangeTruth, position, risk, market
```

The system was not weakened:

- market/freshness blocking was not removed;
- market was not made fresh by default;
- ActionGate was not loosened.

### 2. ActionGate Verdict trust state casing/model

Alpha4 standardizes ActionGate Verdict trust state on Kernel Authority canonical states:

```text
TRUSTED, RECOVERABLE, UNCERTAIN, COMPROMISED, HALTED, PANIC
```

Previous role-6 local states `trusted/restricted/untrusted/unknown` were removed from canonical expectations.

### 3. Cold start replay semantics

Alpha4 distinguishes unknown/uninitialized replay from proven replay mismatch.

Empty cold start without journal/snapshot corruption is:

```text
UNCERTAIN
```

not:

```text
COMPROMISED
```

`COMPROMISED` requires evidence of replay mismatch, corrupted persistence, journal gap, impossible revision, idempotency conflict, or invariant breach after applied state.

Trading remains denied in cold start. This change only distinguishes “unknown truth” from “proven corruption.”

### 4. Existing alpha3 readiness model preserved

Alpha3 readiness remains enforced:

```text
bootstrap reconciled
+ position reconciled
+ exchangeTruth fresh
+ freshness ok
+ health truth acceptable
+ ActionGate allow
```

No tests were made easier by weakening runtime trust.

## Package scripts

Alpha4 package scripts include:

- `test:core:kernel-authority`
- `test:core:trust-report`
- `test:core:action-gate-verdict`
- `test:wave4:scenario-audit`

`npm run verify` includes all alpha1-alpha4 key checks.

## Verification results

All required commands were executed and passed:

```text
npm ci: PASS
npm run typecheck: PASS
npm test: PASS
npm run test:core-constitution: PASS
npm run test:core:cold-start: PASS
npm run test:core:bootstrap: PASS
npm run test:core:event-validation: PASS
npm run test:core:idempotency: PASS
npm run test:wave2:scenario-audit: PASS
npm run test:core:exchange-truth: PASS
npm run test:core:freshness: PASS
npm run test:core:health-truth: PASS
npm run test:wave3:scenario-audit: PASS
npm run test:core:kernel-authority: PASS
npm run test:core:trust-report: PASS
npm run test:core:action-gate-verdict: PASS
npm run test:wave4:scenario-audit: PASS 10/10
npm run audit:runtime: PASS
npm run verify: PASS / exit code 0
```

## Acceptance confirmations

Confirmed:

- `test:wave4:scenario-audit` passes 10/10.
- CoreTrustReport exists and contains the main trust conclusion.
- Kernel Authority determines `trustState`.
- ActionGate Verdict contains machine-readable denial reasons.
- Frontend does not need to calculate trust from raw flags.
- Kernel Authority does not mutate state.
- CoreTrustReport is not a second trust authority.
- ActionGate does not replace Kernel Authority.

## Explicit exclusions

Not added:

- V1;
- V2;
- Signal Layer;
- Decision Engine;
- strategy logic;
- UI;
- live trading;
- real exchange keys;
- Recovery Planner as a separate large system.
