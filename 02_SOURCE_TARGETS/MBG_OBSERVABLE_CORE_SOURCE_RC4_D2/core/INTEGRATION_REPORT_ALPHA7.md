# INTEGRATION_REPORT_ALPHA7

## 1. Base package

Base package used:

```text
mbg-core-v0.1-alpha6.zip
```

Integration target:

```text
mbg-core-v0.1-alpha7.zip
```

## 2. Roles integrated

- Role 2 — CORE_CONSTITUTION / Wave 8 laws.
- Role 4 — Metadata Event Model / ProvenanceRef / reducer / idempotency.
- Role 5 — CausalityTrace provenance visibility.
- Role 6 — Trust / CoreTrustReport / ActionGate / RecoveryPlanner provenance policy.
- Role 7 — Wave 8 Scenario Audit.

## 3. Files changed

```text
CORE_CONSTITUTION.md
core/contracts/src/actions.ts
core/contracts/src/events.ts
core/events/validate-domain-event.ts
core/gates/src/action-gate.ts
core/integrity/integrity-report.ts
core/kernel/core-trust-report.ts
core/kernel/kernel-authority.ts
core/kernel/kernel-constitution.ts
core/recovery/recovery-planner.ts
core/runtime/src/idempotency.ts
core/runtime/src/runtime-engine.ts
core/state/src/types.ts
core/trace/causality-trace.ts
core/transitions/src/reducers.ts
package-lock.json
package.json
tests/scenarios/audit-runtime.ts
tests/scenarios/bootstrap-fsm.ts
tests/scenarios/cold-start-unknown.ts
tests/scenarios/core-action-gate-verdict.ts
tests/scenarios/core-causality-trace.ts
tests/scenarios/core-constitution.test.mjs
tests/scenarios/core-freshness.ts
tests/scenarios/exchange-truth.ts
tests/scenarios/gate-scenarios.ts
tests/scenarios/kernel-authority.ts
tests/scenarios/recovery-planner.ts
tests/scenarios/snapshot-hash-chain.ts
tests/scenarios/wave2-scenario-audit.ts
tests/scenarios/wave3-scenario-audit.ts
tests/scenarios/wave4-scenario-audit.ts
tests/scenarios/wave5-scenario-audit.ts
tests/scenarios/wave7-scenario-audit.ts
DELIVERY_REPORT_WAVE8_CAUSALITY_PROVENANCE.md
DELIVERY_REPORT_WAVE8_PROVENANCE_TRUST.md
DELIVERY_REPORT_WAVE8_ROLE4_METADATA_EVENT_MODEL.md
DELIVERY_REPORT_WAVE8_SCENARIO_AUDIT.md
tests/scenarios/wave8-causality-provenance.ts
tests/scenarios/wave8-metadata-as-events-audit.ts
tests/scenarios/wave8-metadata-reducer.ts
tests/scenarios/wave8-provenance-trust.ts
```

## 4. Semantic decisions

- Role 2 constitution delivery integrated.
- LAW-059 — Explicit Provenance Principle integrated.
- LAW-060 — Replay Is Sacred integrated.
- LAW-061 — Observable First integrated.
- LAW-062 — Metadata as Events integrated.
- LAW-063 — Metadata is Provenance Evidence integrated.
- LAW-064 — Missing Provenance Blocks Risk integrated.
- LAW-065 — Unknown provenance is not corruption by default integrated.
- Role 0 follow-up fixes applied:
  - Base code corrected to mbg-core-v0.1-alpha6.
  - Canonical causality path corrected to core/trace/causality-trace.ts.
  - Canonical hash-chain path corrected to core/integrity/snapshot-hash-chain.ts.
  - Integrity report path confirmed as core/integrity/integrity-report.ts.
  - future provenance module remains future-only.
- Role 4 metadata/provenance event model integrated as canonical event-sourced provenance foundation.
- Canonical event names preserved:
  - metadata.provenance.attached
  - metadata.provenance.recorded
  - metadata.provenance.action_recorded
  - metadata.provenance.trade_recorded
  - metadata.provenance.fill_recorded
  - metadata.provenance.pnl_recorded
  - metadata.provenance.mismatch_detected
- Role 5 remains canonical owner of core/trace/causality-trace.ts.
- CausalityTrace exposes provenanceChain, metadataEvents, originRef, parentProvenanceIds, provenanceCompleteness, provenanceTraceSummary.
- CausalityTrace remains read-only and does not mutate snapshot, write events, compute trust, or become a source of truth.
- Role 6 provenance trust policy integrated into CoreTrustReport, KernelAuthority, ActionGate and RecoveryPlanner.
- Risk-increasing action without valid provenance is DENY.
- Recovery / cancel / reduce-only / diagnostic actions are not wrongly blocked by missing provenance.
- Missing provenance and unknown provenance are evidence gaps, not corruption by default.
- Proven inconsistent / replay mismatch provenance can affect trust and block risk.
- evaluateAction is read-only.
- dispatchAction keeps Permission Ledger side effects.
- Legacy audits were updated to include explicit provenance where they expect risk-increasing PLACE_ORDER to be allowed.

## 5. Conflicts found

- Role 4/5 overlap around provenance visibility in causality trace.
- Role 4/6 overlap around provenance state versus provenance trust policy.
- Legacy scenario tests expected PLACE_ORDER allow after alpha3/4/5 readiness without provenance.
- Permission ledger audit expected evaluateAction to write ledger entries, conflicting with read-only evaluateAction semantics.

## 6. Conflicts resolved

- Preserved Role 5 ownership for core/trace/causality-trace.ts.
- Preserved Role 6 ownership for trust / ActionGate / KernelAuthority / RecoveryPlanner.
- Kept one canonical provenance system in snapshot/reducer/runtime.
- Updated allow-path tests to provide explicit provenance before risk-increasing PLACE_ORDER.
- Updated ledger audit to use dispatchAction for side-effectful permission ledger recording.
- Preserved read-only evaluateAction semantics.

## 7. Conflicts escalated to Role 0

None.

## 8. Tests run

```bash
npm ci
npm run typecheck
npm test
npm run test:core-constitution
npm run test:core:metadata-events
npm run test:wave8:causality-provenance
npm run test:core:provenance-trust
npm run test:wave8:scenario-audit
npm run test:core:snapshot-hash-chain
npm run test:core:causality-trace
npm run test:core:integrity-trust
npm run test:wave7:scenario-audit
npm run verify
```

Additional verify coverage executed through `npm run verify`:

```text
cold-start-unknown
bootstrap-fsm
core-event-validation
core-idempotency
wave2-scenario-audit
exchange-truth
core-freshness
core-health-truth
wave3-scenario-audit
kernel-authority
core-trust-report
core-action-gate-verdict
wave4-scenario-audit
recovery-planner
core-quarantine
core-permission-ledger
wave5-scenario-audit
canonical-audit-checklist
audit-runtime
```

## 9. Verify result

```text
npm run verify — PASS
```

Final Wave 8 audit:

```text
npm run test:wave8:scenario-audit — 14/14 PASS
```

Wave 7 audit:

```text
npm run test:wave7:scenario-audit — 18/18 PASS
```

## 10. Known follow-ups

- No blocking follow-ups for alpha7 release.
- Future provenance module remains future-only:
  - future: core/provenance/provenance.ts

## 11. Red-line preservation statement

ActionGate not weakened.
Replay determinism preserved.
unknown hash != corruption preserved.
unknown provenance != corruption preserved.
Metadata does not grant permission.
No V1 integration added.
No live trading added.
No execution added.
No UI controls added.
No duplicate hash-chain system.
No duplicate causality system.
No duplicate provenance system.
No second source of truth introduced.
No duplicate hash-chain / causality / provenance system left.

## 12. Canonical ownership preservation

- Snapshot Hash Chain: core/integrity/snapshot-hash-chain.ts
- Causality Trace: core/trace/causality-trace.ts
- Integrity Report: core/integrity/integrity-report.ts
- Provenance event model: core/contracts/src/events.ts, core/state/src/types.ts, core/transitions/src/reducers.ts, core/runtime/src/idempotency.ts
- Provenance trust policy: core/kernel/core-trust-report.ts, core/kernel/kernel-authority.ts, core/gates/src/action-gate.ts, core/recovery/recovery-planner.ts
